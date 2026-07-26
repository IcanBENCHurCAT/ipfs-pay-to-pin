# Implementation Plan: Pinning Failure Handling

## Technical Context

We are implementing a Local Buffer Queue and a Circuit Breaker middleware to handle Pinata storage failures gracefully.
- The `src/index.ts` currently handles POST `/api/v1/pin` and directly calls `pinFileToStorage` synchronously.
- We need to decouple this into a producer-consumer pattern.
- The queue will be a simple in-memory list of `UploadJob` objects, with the actual binary payload saved to a local `queue/` directory.

## Proposed Changes

### Queue Service & Background Worker

#### [NEW] `src/queue.ts`
- Implement a `FileQueue` class.
- Methods: `addJob(filename, buffer)`, `getQueueSize()`, `processJobs()`.
- Uses `fs` to write the buffer to a temporary file in `queue/`.
- Maintains an in-memory array of pending jobs.
- Implements `processJobs()` which pulls from the array, calls `pinFileToStorage`, and upon success, deletes the file from disk and removes the job from the array. If it fails, it leaves it in the array for the next interval.

### Circuit Breaker Middleware

#### [MODIFY] `src/index.ts`
- Import `FileQueue` and instantiate it.
- Start the background worker using `setInterval(queue.processJobs, 10000)`.
- Add a new middleware *before* `paymentMiddleware`:
  ```typescript
  app.use('/api/v1/pin', async (c, next) => {
    if (fileQueue.getQueueSize() > 50) { // e.g. MAX_QUEUE_ITEMS
      return c.json({ error: "Service temporarily unavailable. Storage queue is at capacity." }, 503);
    }
    await next();
  });
  ```
- Update the `POST /api/v1/pin` handler:
  Instead of `await pinFileToStorage(...)`, it will call `fileQueue.addJob(filename, buffer)`.
  It will then return a 201 Created immediately with a "pending" status or a locally derived mock CID (which Pinata will respect if it's identical bytes, though Pinata assigns its own CIDv1 anyway).

## Constitution Check
- **Compliance**: This architecture directly fulfills Principle 5.1 (Circuit Breaker) and 5.2 (Local Buffer Queue).
- **Tech Stack**: Uses standard Node.js `fs` and in-memory structures, avoiding heavy external dependencies in line with our lightweight gateway design.

## Verification Plan

### Automated Tests
- N/A - Testing will be done manually or via existing integration tests updated to wait for async processing.

### Manual Verification
- Test Circuit Breaker by lowering `MAX_QUEUE_ITEMS` to 1, submitting two requests, and verifying the second gets a 503.
- Test Async Buffer by providing a broken Pinata JWT, verifying the 201 response, and watching the worker retry.
