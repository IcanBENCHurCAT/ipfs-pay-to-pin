import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { logger } from './observability.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookEventType = 'pin.completed' | 'pin.failed' | 'pin.expired';

export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'RATE_LIMITED';

export interface WebhookPayload {
  event: WebhookEventType;
  cid: string;
  filename: string;
  gateway_url?: string;
  error?: string;
  timestamp: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhook_url: string;
  event: WebhookEventType;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  attempts: number;
  next_retry_at: number | null;
  last_error: string | null;
  created_at: number;
  delivered_at: number | null;
  cid?: string;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelaysMs: number[]; // exponential backoff delays
  timeoutMs: number;
}

// ─── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WebhookConfig = {
  maxRetries: 3,
  retryDelaysMs: [0, 30_000, 120_000], // 0s, 30s, 2min
  timeoutMs: 5_000,
};

// ─── Supabase Migration (run once) ───────────────────────────────────────────

export const WEBHOOK_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  webhook_url TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at BIGINT,
  last_error TEXT,
  created_at BIGINT NOT NULL,
  delivered_at BIGINT,
  cid TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
  ON public.webhook_deliveries(status) WHERE status IN ('PENDING', 'FAILED', 'TIMED_OUT', 'RATE_LIMITED');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_cid
  ON public.webhook_deliveries(cid) WHERE cid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_url_event
  ON public.webhook_deliveries(webhook_url, event);
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateDeliveryId(): string {
  return `wh_${Date.now()}_${randomBytes(4).toString('hex').substring(0, 5)}`;
}

function isTerminalStatus(status: WebhookDeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'FAILED';
}

/**
 * Validate that a URL is safe to deliver to (no localhost/internal).
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const hostname = parsed.hostname;
    // Block localhost, loopback, link-local, private ranges
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    if (/^10\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    if (/^0\.0\.0\.0/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Webhook Delivery Service ────────────────────────────────────────────────

export class WebhookDeliveryService {
  private supabase: SupabaseClient | null = null;
  private config: WebhookConfig;
  private enabled: boolean;

  constructor(config?: Partial<WebhookConfig>, supabaseUrl?: string, supabaseKey?: string) {
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
    this.enabled =
      typeof process.env.WEBHOOK_ENABLED !== 'undefined'
        ? process.env.WEBHOOK_ENABLED === 'true'
        : true;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    }
  }

  /**
   * Track a webhook delivery attempt in the database.
   */
  async trackDelivery(record: Omit<WebhookDeliveryRecord, 'id' | 'created_at'>): Promise<WebhookDeliveryRecord> {
    const fullRecord: WebhookDeliveryRecord = {
      ...record,
      id: generateDeliveryId(),
      created_at: Date.now(),
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('webhook_deliveries')
        .insert({
          webhook_url: fullRecord.webhook_url,
          event: fullRecord.event,
          payload: fullRecord.payload,
          status: fullRecord.status,
          attempts: fullRecord.attempts,
          next_retry_at: fullRecord.next_retry_at,
          last_error: fullRecord.last_error,
          created_at: fullRecord.created_at,
          delivered_at: fullRecord.delivered_at,
          cid: fullRecord.cid,
        });
      if (error) {
        logger.error({ error: error.message, webhookUrl: record.webhook_url }, '[Webhook] Failed to track delivery in Supabase.');
      }
    }

    return fullRecord;
  }

  /**
   * Query delivery records by CID.
   */
  async getDeliveriesByCid(cid: string): Promise<WebhookDeliveryRecord[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('cid', cid)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ cid, error: error.message }, '[Webhook] Failed to query deliveries.');
      return [];
    }

    return (data || []).map((row) => this.rowToRecord(row));
  }

  /**
   * Query pending deliveries for the batch processor (called by queue worker).
   */
  async getPendingDeliveries(limit: number = 50): Promise<WebhookDeliveryRecord[]> {
    if (!this.supabase) return [];

    const now = Date.now();
    const { data, error } = await this.supabase
      .from('webhook_deliveries')
      .select('*')
      .or(`status.eq.PENDING,status.neq.DELIVERED.and(next_retry_at.is.null,next_retry_at.lt.${now})`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error({ error: error.message }, '[Webhook] Failed to query pending deliveries.');
      return [];
    }

    return (data || []).map((row) => this.rowToRecord(row));
  }

  /**
   * Deliver a single webhook synchronously (fire-and-forget at the call site).
   * Returns the HTTP status code or 0 on network error.
   */
  async deliver(record: WebhookDeliveryRecord): Promise<{ status: number; error?: string }> {
    if (!isSafeUrl(record.webhook_url)) {
      await this.trackDelivery({
        ...record,
        status: 'FAILED',
        attempts: record.attempts + 1,
        last_error: 'Unsafe URL blocked',
        delivered_at: null,
      });
      return { status: 0, error: 'Unsafe URL blocked' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(record.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': record.event,
          'X-Webhook-Attempt': String(record.attempts + 1),
          'X-Webhook-Id': record.id,
        },
        body: JSON.stringify(record.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const error = `HTTP ${res.status}: ${body}`;

        if (res.status === 429 || res.status === 503) {
          // Rate limited or temporarily unavailable — schedule retry
          await this.trackDelivery({
            ...record,
            status: res.status === 429 ? 'RATE_LIMITED' : 'TIMED_OUT',
            attempts: record.attempts + 1,
            last_error: error,
            delivered_at: null,
            next_retry_at: this.calculateNextRetry(record.attempts + 1),
          });
          return { status: res.status, error };
        }

        await this.trackDelivery({
          ...record,
          status: 'FAILED',
          attempts: record.attempts + 1,
          last_error: error,
          delivered_at: null,
        });
        return { status: res.status, error };
      }

      // Success — update to DELIVERED
      await this.trackDelivery({
        ...record,
        status: 'DELIVERED',
        attempts: record.attempts + 1,
        delivered_at: Date.now(),
        last_error: null,
      });

      return { status: res.status };
    } catch (err: any) {
      clearTimeout(timeoutId);

      const errorMessage = err?.code === 'ABORT_ERR' || err?.name === 'AbortError'
        ? `Request timed out after ${this.config.timeoutMs}ms`
        : err?.message || String(err);

      // Timeout or network error — schedule retry if under limit
      if (record.attempts + 1 < this.config.maxRetries) {
        await this.trackDelivery({
          ...record,
          status: 'TIMED_OUT',
          attempts: record.attempts + 1,
          last_error: errorMessage,
          delivered_at: null,
          next_retry_at: this.calculateNextRetry(record.attempts + 1),
        });
      } else {
        await this.trackDelivery({
          ...record,
          status: 'FAILED',
          attempts: record.attempts + 1,
          last_error: errorMessage,
          delivered_at: null,
        });
      }

      return { status: 0, error: errorMessage };
    }
  }

  /**
   * Process all pending deliveries in the queue (batch processor).
   * Returns count of delivered/failed.
   */
  async processPending(): Promise<{ delivered: number; failed: number; skipped: number }> {
    const pending = await this.getPendingDeliveries(20); // batch size
    let delivered = 0;
    let failed = 0;
    let skipped = 0;

    for (const record of pending) {
      if (record.status === 'DELIVERED') {
        skipped++;
        continue;
      }

      // Check if retry delay has elapsed
      if (record.next_retry_at && record.next_retry_at > Date.now()) {
        skipped++;
        continue;
      }

      const result = await this.deliver(record);
      if (result.status >= 200 && result.status < 300) {
        delivered++;
      } else {
        failed++;
      }
    }

    return { delivered, failed, skipped };
  }

  /**
   * Fire a webhook for a pin event. Called from queue processing.
   * Returns true if at least one delivery was queued successfully.
   */
  async fire(
    eventType: WebhookEventType,
    cid: string,
    filename: string,
    gatewayUrl: string,
    webhookUrl: string,
    error?: string
  ): Promise<boolean> {
    if (!this.enabled) {
      logger.info({ eventType }, '[Webhook] Disabled, skipping delivery.');
      return false;
    }

    if (!isSafeUrl(webhookUrl)) {
      logger.warn({ eventType, url: webhookUrl }, '[Webhook] Blocked unsafe URL.');
      return false;
    }

    const payload: WebhookPayload = {
      event: eventType,
      cid,
      filename,
      gateway_url: gatewayUrl || undefined,
      error: error || undefined,
      timestamp: new Date().toISOString(),
    };

    const record: Omit<WebhookDeliveryRecord, 'id' | 'created_at'> = {
      webhook_url: webhookUrl,
      event: eventType,
      payload,
      status: 'PENDING',
      attempts: 0,
      next_retry_at: 0,
      last_error: null,
      delivered_at: null,
      cid,
    };

    await this.trackDelivery(record);
    logger.info({ eventType, webhookUrl: webhookUrl.substring(0, 60) + '...' }, '[Webhook] Queued delivery.');
    return true;
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private calculateNextRetry(attempt: number): number {
    const index = Math.min(attempt, this.config.retryDelaysMs.length - 1);
    return Date.now() + this.config.retryDelaysMs[index];
  }

  private rowToRecord(row: Record<string, unknown>): WebhookDeliveryRecord {
    return {
      id: row.id as string,
      webhook_url: row.webhook_url as string,
      event: row.event as WebhookEventType,
      payload: (row.payload as WebhookPayload) || {},
      status: (row.status as WebhookDeliveryStatus) || 'PENDING',
      attempts: Number(row.attempts) || 0,
      next_retry_at: row.next_retry_at ? Number(row.next_retry_at) : null,
      last_error: row.last_error as string | null,
      created_at: Number(row.created_at) || Date.now(),
      delivered_at: row.delivered_at ? Number(row.delivered_at) : null,
      cid: row.cid as string | undefined,
    };
  }
}

// ─── Singleton instance (used by queue) ──────────────────────────────────────

export const webhookService = new WebhookDeliveryService(
  process.env.NODE_ENV !== 'test'
    ? {
        maxRetries: 3,
        retryDelaysMs: [0, 30_000, 120_000],
        timeoutMs: 5_000,
      }
    : undefined,
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export default webhookService;
