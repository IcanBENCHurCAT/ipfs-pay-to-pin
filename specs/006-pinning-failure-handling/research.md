# Research: Pinning Failure Handling

## Local Queue Implementation
- **Decision**: Use a simple in-memory array backed by local disk storage (`fs` writes) for the queue, rather than bringing in a heavy dependency like Redis or BullMQ.
- **Rationale**: The gateway is currently a lightweight Node.js/Hono process. We want to avoid adding external database dependencies (like Postgres or Redis) just for queuing file uploads, especially when files are large (up to 50MB) and keeping them in memory might cause OOM errors. By writing payloads to a `queue/` directory on disk and tracking their status in memory/sqlite, we remain stateless and lightweight.
- **Alternatives considered**: 
  - `bullmq` with Redis (rejected: requires Redis server).
  - SQLite for metadata, disk for payloads (accepted: we can just use disk for payloads and a simple JSON array or in-memory map for the queue metadata, or a simple SQLite table). Given the simplicity, we will use a basic disk-based queue.

## Circuit Breaker Implementation
- **Decision**: A simple Hono middleware `app.use('/api/v1/pin', circuitBreaker)` placed *before* `paymentMiddleware`.
- **Rationale**: The middleware can synchronously check the size of the `queue/` directory or an in-memory counter. If it exceeds `MAX_QUEUE_SIZE` (e.g., 50), it immediately returns `503 Service Unavailable`.
- **Alternatives considered**: Checking Pinata API status on every request (rejected: too slow, and Pinata doesn't have a reliable quota endpoint).
