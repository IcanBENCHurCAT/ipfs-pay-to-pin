# Research: Chain Verification Indexer

## Decision 1: Storage for Processed Transactions (FR-005)
- **Decision**: SQLite Database (via Python's `sqlite3` or `SQLAlchemy`).
- **Rationale**: The gateway must prevent double-spends even after service restarts. An in-memory dictionary is volatile and would reset on reboot. SQLite offers lightweight, zero-configuration persistent storage suitable for the scale of a typical pinning gateway, avoiding the overhead of external databases like PostgreSQL.
- **Alternatives considered**:
  - *In-memory Dictionary*: Rejected because data is lost on server restart, enabling potential double-spend vulnerabilities.
  - *Redis/PostgreSQL*: Rejected as they add unnecessary operational overhead for a self-hosted IPFS gateway.

## Decision 2: Handling Node Unavailability and Rate Limits (FR-007)
- **Decision**: Implement exponential backoff for retries and allow multiple `algod` endpoints in configuration.
- **Rationale**: Network instability or rate limits (e.g. 429 Too Many Requests) can cause verification to temporarily fail. Exponential backoff (e.g., waiting 1s, 2s, 4s up to a maximum of 10s) gives the node time to recover. `algokit-utils` can be initialized with fallback nodes if the primary node is unreachable.
- **Alternatives considered**:
  - *Immediate Failure*: Rejected because it harms UX for transient network issues.
  - *Infinite Polling*: Rejected because it could exhaust server resources and tie up concurrent request slots.

## Decision 3: Handling Block Latency and Reorganizations (FR-006)
- **Decision**: Wait for the transaction to appear on-chain with a configurable timeout (e.g., 10 seconds), trusting standard Algorand finality.
- **Rationale**: Algorand offers instant transaction finality (transactions are final as soon as they are included in a block) and does not fork. Therefore, chain reorganizations are not a concern. The only latency is the time it takes for a block to be proposed and finalized (typically under 3 seconds). If the transaction is not found immediately, the indexer will poll every second up to 10 seconds.
- **Alternatives considered**:
  - *Waiting for multiple confirmations*: Rejected because Algorand does not require multiple confirmations (unlike Bitcoin or Ethereum).
