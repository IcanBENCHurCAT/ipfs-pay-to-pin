import { globalFileQueue } from './queue.js';
import { logger, incrementCounter } from './observability.js';

export interface BatchPinItem {
  filename: string;
  data: string; // base64 encoded
}

export interface BatchPinResult {
  cid: string;
  gateway_url: string;
  expires_at: string;
}

export interface BatchPinError {
  filename: string;
  error: string;
}

export interface BatchPinResponse {
  pins: (BatchPinResult | BatchPinError)[];
  total: number;
  succeeded: number;
  failed: number;
}

export interface BatchPinConfig {
  maxFiles: number;
  maxBytes: number;
  webhookUrl?: string; // Optional shared webhook URL for all files in the batch
}

/**
 * Decode base64 string to Buffer with payload size limit enforcement, or throw on invalid base64 or size limit exceeded.
 */
export function decodeBase64(data: string, maxBytes: number = 20 * 1024 * 1024): Buffer {
  // 🛡️ Sentinel: Unrestricted Base64 Payload Allocation Guard.
  // Validate base64 format and calculated decoded byte length mathematically O(1)
  // before calling Buffer.from(data, 'base64') to prevent memory exhaustion / OOM DoS attacks.
  if (!/^[A-Za-z0-9+/=\-_]+$/.test(data)) {
    throw new Error('Invalid base64 encoding in file data.');
  }

  const dataLen = data.length;
  let padding = 0;
  if (dataLen > 1) {
    if (data[dataLen - 1] === '=') {
      padding = data[dataLen - 2] === '=' ? 2 : 1;
    }
  }
  const estimatedBytes = Math.floor(((dataLen - padding) * 3) / 4);
  if (estimatedBytes > maxBytes) {
    throw new Error(`File payload size (${estimatedBytes} bytes) exceeds maximum allowed limit of ${maxBytes} bytes.`);
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > maxBytes) {
      throw new Error(`File payload size (${buffer.length} bytes) exceeds maximum allowed limit of ${maxBytes} bytes.`);
    }
    return buffer;
  } catch (err: any) {
    if (err?.message?.includes('exceeds maximum allowed limit')) {
      throw err;
    }
    throw new Error('Invalid base64 encoding in file data.');
  }
}

/**
 * Validate that the input array meets basic requirements.
 */
function validateBatchPayload(
  files: unknown[],
  config: BatchPinConfig
): { error: string } | { files: BatchPinItem[]; totalBytes: number } {
  // Must be an array
  if (!Array.isArray(files)) {
    return { error: 'Request body must be a JSON array of file objects.' };
  }

  // Check file count limit
  if (files.length === 0) {
    return { error: 'Batch must contain at least one file.' };
  }
  if (files.length > config.maxFiles) {
    return { error: `Batch exceeds maximum file count of ${config.maxFiles}.` };
  }

  const decoded: BatchPinItem[] = [];
  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Each item must be an object with filename and data
    if (!file || typeof file !== 'object') {
      return { error: `Item at index ${i} is not a valid object.` };
    }
    const obj = file as Record<string, unknown>;
    if (typeof obj.filename !== 'string' || obj.filename.trim().length === 0) {
      return { error: `Item at index ${i} is missing a valid 'filename' string.` };
    }
    if (typeof obj.data !== 'string' || obj.data.length === 0) {
      return { error: `Item at index ${i} is missing a valid 'data' string.` };
    }

    // Decode base64 and accumulate byte size
    // ⚡ Bolt: Calculate base64 decoded size mathematically to prevent
    // blocking the Node.js event loop with massive Buffer allocations during batch validation
    const dataStr = obj.data as string;
    const dataLen = dataStr.length;
    let padding = 0;
    if (dataLen > 1) {
        if (dataStr[dataLen - 1] === '=') {
            padding = dataStr[dataLen - 2] === '=' ? 2 : 1;
        }
    }
    const parsedBinaryBytes = Math.floor(((dataLen - padding) * 3) / 4);
    totalBytes += parsedBinaryBytes;

    decoded.push({
      filename: obj.filename,
      data: obj.data,
    });

    if (totalBytes > config.maxBytes) {
      return { error: `Total batch size (${totalBytes} bytes) exceeds maximum of ${config.maxBytes} bytes.` };
    }
  }

  return { files: decoded, totalBytes };
}

/**
 * Process a single file in the batch. Returns either a success result or an error.
 */
async function processSingleFile(file: BatchPinItem, webhookUrl?: string, maxBytes?: number): Promise<BatchPinResult | BatchPinError> {
  try {
    const buffer = decodeBase64(file.data, maxBytes);

    const queueItem = await globalFileQueue.addJob(file.filename, buffer, webhookUrl ? { webhookUrl } : undefined);

    return {
      cid: queueItem.cid,
      gateway_url: queueItem.gatewayUrl,
      expires_at: new Date(queueItem.expires_at).toISOString(),
    };
  } catch (err: any) {
    logger.warn({ filename: file.filename, error: err?.message || err }, '[Batch] Failed to pin individual file');
    return {
      filename: file.filename,
      error: err?.message || 'Unknown pinning error.',
    };
  }
}

/**
 * Handle a batch pin request.
 * Processes files concurrently and returns per-item results (partial success supported).
 */
export async function handleBatchPin(files: unknown[], config: BatchPinConfig, webhookUrl?: string): Promise<{ response: BatchPinResponse; statusCode: number }> {
  incrementCounter('batchPinRequests', { category: 'total' });

  // Validate payload
  const validation = validateBatchPayload(files, config);
  if ('error' in validation) {
    incrementCounter('batchPinRequests', { category: 'validation_error' });
    const statusCode = validation.error.includes('exceeds maximum') ? 400 : 422;
    return { response: { pins: [], total: 0, succeeded: 0, failed: 0 }, statusCode: statusCode };
  }

  const { files: decodedFiles, totalBytes } = validation;
  incrementCounter('batchPinRequests', { category: 'valid' });

  logger.info(
    { fileCount: decodedFiles.length, totalBytes, maxFiles: config.maxFiles, maxBytes: config.maxBytes },
    '[Batch] Processing batch pin request'
  );

  // Process all files concurrently — partial success is supported
  const results = await Promise.allSettled(
    decodedFiles.map((file) => processSingleFile(file, webhookUrl, config.maxBytes))
  );

  const pins: (BatchPinResult | BatchPinError)[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      // Could be success or error from processSingleFile
      const item = result.value;
      if ('cid' in item) {
        pins.push(item);
        succeeded++;
      } else {
        pins.push(item);
        failed++;
      }
    } else {
      // Unexpected crash in processing — report as error for this item
      pins.push({
        filename: decodedFiles[i].filename,
        error: result.reason?.message || 'Unexpected processing failure.',
      });
      failed++;
      logger.error({ index: i, error: result.reason }, '[Batch] Unexpected processing crash');
    }
  }

  const response: BatchPinResponse = {
    pins,
    total: decodedFiles.length,
    succeeded,
    failed,
  };

  const statusCode = failed === 0 ? 201 : 207; // 201 all success, 207 partial success
  if (failed > 0) {
    incrementCounter('batchPinRequests', { category: 'partial_success' });
  } else {
    incrementCounter('batchPinRequests', { category: 'full_success' });
  }

  return { response, statusCode };
}
