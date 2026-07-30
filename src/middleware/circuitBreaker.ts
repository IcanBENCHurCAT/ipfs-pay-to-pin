import { Context, Next } from 'hono';
import { globalFileQueue } from '../queue.js';

export async function circuitBreakerMiddleware(c: Context, next: Next) {
  const queueSize = globalFileQueue.getQueueSize();
  const maxQueueSize = globalFileQueue.getMaxQueueSize();
  const queueBytes = globalFileQueue.getQueueBytes();
  const maxQueueBytes = globalFileQueue.getMaxQueueBytes();

  if (queueSize >= maxQueueSize) {
    console.warn(`[CircuitBreaker] Queue size full (${queueSize}/${maxQueueSize}), rejecting request`);
    return c.json({
      error: "Service Unavailable",
      message: "Queue item limit reached. Please try again later.",
      queue_size: queueSize,
      max_queue_size: maxQueueSize,
      retry_after_ms: 10000,
    }, 503);
  }

  if (queueBytes >= maxQueueBytes) {
    console.warn(`[CircuitBreaker] Queue bytes full (${queueBytes}/${maxQueueBytes}), rejecting request`);
    return c.json({
      error: "Service Unavailable",
      message: "Queue byte capacity reached. Please try again later.",
      queue_bytes: queueBytes,
      max_queue_bytes: maxQueueBytes,
      retry_after_ms: 10000,
    }, 503);
  }

  if (!globalFileQueue.isHealthy()) {
    console.warn("[CircuitBreaker] Storage service is temporarily unhealthy, rejecting request");
    return c.json({
      error: "Service Unavailable",
      message: "Storage service is temporarily unavailable. Please try again later.",
      retry_after_ms: 30000,
    }, 503);
  }

  await next();
}
