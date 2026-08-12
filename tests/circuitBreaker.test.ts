import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { circuitBreakerMiddleware } from '../src/middleware/circuitBreaker.js';
import { globalFileQueue } from '../src/queue.js';
import { Context, Next } from 'hono';

describe('Circuit Breaker Middleware', () => {
  let mockContext: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup a clean mock for Hono context and next function
    mockContext = {
      json: vi.fn().mockImplementation((body, status) => {
        return { body, status };
      }),
    } as unknown as Context;

    mockNext = vi.fn().mockResolvedValue(undefined) as unknown as Next;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('T020: allows request to pass when queue limits are not exceeded and service is healthy', async () => {
    vi.spyOn(globalFileQueue, 'getQueueSize').mockReturnValue(5);
    vi.spyOn(globalFileQueue, 'getMaxQueueSize').mockReturnValue(50);
    vi.spyOn(globalFileQueue, 'getQueueBytes').mockReturnValue(10000);
    vi.spyOn(globalFileQueue, 'getMaxQueueBytes').mockReturnValue(1000000);
    vi.spyOn(globalFileQueue, 'isHealthy').mockReturnValue(true);

    const result = await circuitBreakerMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockContext.json).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('T021: rejects request when queue size limit is reached', async () => {
    vi.spyOn(globalFileQueue, 'getQueueSize').mockReturnValue(50);
    vi.spyOn(globalFileQueue, 'getMaxQueueSize').mockReturnValue(50);
    vi.spyOn(globalFileQueue, 'getQueueBytes').mockReturnValue(10000);
    vi.spyOn(globalFileQueue, 'getMaxQueueBytes').mockReturnValue(1000000);
    vi.spyOn(globalFileQueue, 'isHealthy').mockReturnValue(true);

    const result = await circuitBreakerMiddleware(mockContext, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockContext.json).toHaveBeenCalledTimes(1);
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: "Service Unavailable",
        message: "Queue item limit reached. Please try again later.",
        queue_size: 50,
        max_queue_size: 50,
        retry_after_ms: 10000,
      },
      503
    );
    expect(result).toEqual({
      body: {
        error: "Service Unavailable",
        message: "Queue item limit reached. Please try again later.",
        queue_size: 50,
        max_queue_size: 50,
        retry_after_ms: 10000,
      },
      status: 503,
    });
  });

  it('T022: rejects request when queue bytes limit is reached', async () => {
    vi.spyOn(globalFileQueue, 'getQueueSize').mockReturnValue(5);
    vi.spyOn(globalFileQueue, 'getMaxQueueSize').mockReturnValue(50);
    vi.spyOn(globalFileQueue, 'getQueueBytes').mockReturnValue(1000000);
    vi.spyOn(globalFileQueue, 'getMaxQueueBytes').mockReturnValue(1000000);
    vi.spyOn(globalFileQueue, 'isHealthy').mockReturnValue(true);

    const result = await circuitBreakerMiddleware(mockContext, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockContext.json).toHaveBeenCalledTimes(1);
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: "Service Unavailable",
        message: "Queue byte capacity reached. Please try again later.",
        queue_bytes: 1000000,
        max_queue_bytes: 1000000,
        retry_after_ms: 10000,
      },
      503
    );
    expect(result).toEqual({
      body: {
        error: "Service Unavailable",
        message: "Queue byte capacity reached. Please try again later.",
        queue_bytes: 1000000,
        max_queue_bytes: 1000000,
        retry_after_ms: 10000,
      },
      status: 503,
    });
  });

  it('T023: rejects request when storage service is temporarily unhealthy', async () => {
    vi.spyOn(globalFileQueue, 'getQueueSize').mockReturnValue(5);
    vi.spyOn(globalFileQueue, 'getMaxQueueSize').mockReturnValue(50);
    vi.spyOn(globalFileQueue, 'getQueueBytes').mockReturnValue(10000);
    vi.spyOn(globalFileQueue, 'getMaxQueueBytes').mockReturnValue(1000000);
    vi.spyOn(globalFileQueue, 'isHealthy').mockReturnValue(false);

    const result = await circuitBreakerMiddleware(mockContext, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockContext.json).toHaveBeenCalledTimes(1);
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: "Service Unavailable",
        message: "Storage service is temporarily unavailable. Please try again later.",
        retry_after_ms: 30000,
      },
      503
    );
    expect(result).toEqual({
      body: {
        error: "Service Unavailable",
        message: "Storage service is temporarily unavailable. Please try again later.",
        retry_after_ms: 30000,
      },
      status: 503,
    });
  });
});
