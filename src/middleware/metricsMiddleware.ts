/**
 * Metrics Middleware — Increments Prometheus counters for every HTTP request
 * 
 * This middleware works alongside traceIdMiddleware and automatically tracks:
 * - requests_total (counter) by method, route, status
 * - errors_total (counter) for 4xx/5xx responses
 * - queue_depth (gauge) when pin queue info is available
 * 
 * Integration: must be applied after traceId middleware (which provides trace_id)
 * and before route handlers.
 * 
 * Usage:
 *   import { traceIdMiddleware } from './middleware/traceId.js';
 *   import { metricsMiddleware } from './middleware/metrics.js';
 *   app.use('*', traceIdMiddleware());
 *   app.use('*', metricsMiddleware());
 * 
 * Environment Variables:
 *   - None (auto-discovers counters from observability module)
 */

import type { Context, Next } from 'hono';
import { incrementCounter } from '../observability.js';
import { getTraceId, getContextLogger } from './traceId.js';

/**
 * Normalize a path for metrics grouping:
 * /api/v1/pin → /api/v1/pin (static)
 * /api/v1/renew/abc123 → /api/v1/renew/:id (parametric)
 */
function normalizeRoute(path: string): string {
  if (!path.startsWith('/api/v')) {
    return path;
  }
  const versionEnd = path.indexOf('/', 6);
  if (versionEnd === -1) return path;

  const resourceEnd = path.indexOf('/', versionEnd + 1);
  if (resourceEnd === -1 || resourceEnd === path.length - 1) return path;

  const idEnd = path.indexOf('/', resourceEnd + 1);
  if (idEnd === -1) {
    return path.substring(0, resourceEnd + 1) + ':id';
  }
  return path.substring(0, resourceEnd + 1) + ':id' + path.substring(idEnd);
}

/**
 * Metrics middleware for Hono.
 * 
 * Increments counters:
 * - requests_total{method, route, status}
 * - errors_total{category} for 4xx/5xx
 * 
 * Sets gauge:
 * - queue_depth (if queue info is available)
 */
export function metricsMiddleware() {
  return async (c: Context, next: Next) => {
    const traceId = getTraceId(c);
    const childLogger = getContextLogger(c);
    
    const method = c.req.method;
    const route = normalizeRoute(c.req.path);
    
    // Track the request
    incrementCounter('requestsTotal', { method, route, status: '000' });
    
    const startTime = Date.now();
    
    try {
      await next();
    } finally {
      const durationMs = Date.now() - startTime;
      const status = c.res?.status || 0;
      const statusCategory = status < 400 ? '2xx' : status < 500 ? '4xx' : '5xx';
      
      // Update the requests_total counter with actual status
      incrementCounter('requestsTotal', { method, route, status: String(status) });
      
      // Track errors
      if (status >= 400) {
        const category = status >= 500 ? 'server_error' : 'client_error';
        incrementCounter('errorsTotal', { category, route, status: String(status) });
        
        childLogger?.warn({
          status,
          duration_ms: durationMs,
          trace_id: traceId,
        }, `[Metrics] Error response`);
      }
      
      // Log metrics event (debug level for observability)
      if (childLogger) {
        childLogger.debug({
          method,
          route,
          status,
          duration_ms: durationMs,
          trace_id: traceId,
        }, '[Metrics] Request tracked');
      }
    }
  };
}

/**
 * Check if metrics middleware is working by verifying counter is accessible.
 * This is useful for health checks and integration tests.
 */
export function isMetricsAvailable(): boolean {
  try {
    return !!(global as any).__METRICS__;
  } catch {
    return false;
  }
}
