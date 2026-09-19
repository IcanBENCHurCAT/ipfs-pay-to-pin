/**
 * Trace ID Middleware — Injects a unique trace_id into every request/response
 * 
 * This middleware:
 * 1. Checks for an existing X-Trace-Id header (from upstream)
 * 2. If not present, generates a new trace_id (UUID v4)
 * 3. Attaches trace_id to the request context via c.set()
 * 4. Adds X-Trace-Id header to every response
 * 5. Logs every request with its trace_id
 * 
 * The trace_id is available to downstream handlers and the structured logger
 * via the observability module's pino instance with bound child logger.
 */

import type { Context, Next } from 'hono';
import { logger } from '../observability.js';

/**
 * Generate a trace ID. Uses crypto.randomUUID() if available (Node 14.17+),
 * otherwise falls back to crypto.randomBytes.
 */
function generateTraceId(): string {
  try {
    return require('crypto').randomUUID();
  } catch {
    const bytes = require('crypto').randomBytes(16);
    return `${bytes.toString('hex').substring(0, 8)}-${bytes.toString('hex').substring(8, 12)}-4${bytes.toString('hex').substring(13, 16)}-a${bytes.toString('hex').substring(17, 20)}-${bytes.toString('hex').substring(20, 32)}`;
  }
}

/**
 * Trace ID middleware for Hono.
 * 
 * Usage in Hono app:
 *   import { traceIdMiddleware } from './middleware/traceId.js';
 *   app.use('*', traceIdMiddleware);
 * 
 * The trace_id is attached to:
 * - Request: c.get('trace_id')
 * - Response header: X-Trace-Id
 * - Log context: via pino child logger with trace_id bound
 * 
 * Environment Variables:
 * - TRACE_ID_HEADER: Header name for trace ID (default: "X-Trace-Id")
 */

export function traceIdMiddleware() {
  return async (c: Context, next: Next) => {
    const headerName = process.env.TRACE_ID_HEADER || 'X-Trace-Id';
    
    // Check for existing trace ID (from upstream proxy or client)
    let traceId = c.req.header(headerName);
    
    if (!traceId) {
      traceId = generateTraceId();
    }
    
    // Store trace_id in Hono context
    c.set('trace_id', traceId);
    
    // Create a child logger bound to this trace_id for use in downstream handlers
    const childLogger = logger.child({ trace_id: traceId });
    c.set('logger', childLogger);
    
    // Attach trace_id to response header for client-side debugging
    c.header(headerName, traceId);
    
    // Set Traceparent header if OpenTelemetry is active (W3C Trace Context)
    const traceParent = (c.get('otel_traceparent') as string | undefined) || '';
    if (traceParent) {
      c.header('Traceparent', traceParent);
    }
    
    // Request logging
    const startTime = Date.now();
    childLogger.info({
      method: c.req.method,
      path: c.req.path,
      trace_id: traceId,
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    }, '[HTTP] Request received');
    
    try {
      await next();
    } finally {
      // Response logging
      const duration = Date.now() - startTime;
      const status = c.res?.status || 0;
      
      childLogger.info({
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration,
        trace_id: traceId,
      }, `[HTTP] Response sent`);
    }
  };
}

/**
 * Get the trace_id from Hono context.
 * Returns null if trace_id middleware hasn't run.
 */
export function getTraceId(c: Context): string | null {
  return c.get('trace_id') || null;
}

/**
 * Get the trace-bound logger from Hono context.
 * Returns null if trace_id middleware hasn't run.
 */
export function getContextLogger(c: Context) {
  return c.get('logger') || null;
}
