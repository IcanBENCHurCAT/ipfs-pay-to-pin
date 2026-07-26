import { Context, Next } from 'hono';
import { globalFileQueue } from '../queue.js';

export async function circuitBreakerMiddleware(c: Context, next: Next) {
  if (globalFileQueue.getQueueSize() >= globalFileQueue.getMaxQueueSize()) {
    return c.json({
      error: "Service temporarily unavailable. Storage queue is at capacity.",
      queue_size: globalFileQueue.getQueueSize(),
      max_queue_size: globalFileQueue.getMaxQueueSize()
    }, 503);
  }
  await next();
}
