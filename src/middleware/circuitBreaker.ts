import { Context, Next } from 'hono';
import { globalFileQueue } from '../queue.js';

export async function circuitBreakerMiddleware(c: Context, next: Next) {
  const queueSize = globalFileQueue.getQueueSize();
  const maxQueueSize = globalFileQueue.getMaxQueueSize();

  if (queueSize >= maxQueueSize) {
    console.warn(`[CircuitBreaker] Queue full (${queueSize}/${maxQueueSize}), rejecting request`);
    return c.json({
      error: "Service Unavailable",
      message: "Queue is full. Please try again later.",
      queue_size: queueSize,
      max_queue_size: maxQueueSize,
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
