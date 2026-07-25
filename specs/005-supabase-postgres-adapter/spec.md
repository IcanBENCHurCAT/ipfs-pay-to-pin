# Feature Specification: Pluggable Supabase Postgres & SQLite Database Adapters

**Feature Branch**: `005-supabase-postgres-adapter`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "spec-out how to use supabase for the cloud-deployed version and maintain sqlite for local testing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Environment-Based Pluggable Database Abstraction (Priority: P1) 🎯 MVP

As a gateway operator, I want the system to dynamically select between a Supabase Postgres backend (for cloud deployments like Heroku) and a local SQLite backend (for local development and testing) based on environment configuration (`DATABASE_ADAPTER`), so that local testing remains zero-config and fast while cloud deployments persist state safely across dyno restarts.

**Why this priority**: Heroku ephemeral storage wipes local SQLite files upon daily dyno restarts. Connecting to Supabase Postgres is critical for production state persistence without requiring heavy local infrastructure during development.

**Independent Test**: Can be tested locally by switching `DATABASE_ADAPTER=sqlite` to run unit tests against SQLite, then setting `DATABASE_ADAPTER=supabase` (or `postgres`) with valid connection credentials to verify table creation and query execution against Supabase.

**Acceptance Scenarios**:

1. **Given** `DATABASE_ADAPTER` is set to `sqlite` (or left unset), **When** the gateway starts up, **Then** it initializes and queries the local SQLite database file at `DATABASE_PATH`.
2. **Given** `DATABASE_ADAPTER` is set to `supabase` (or `postgres`) with a valid `SUPABASE_DATABASE_URL` (or `SUPABASE_URL` + `SUPABASE_KEY`), **When** the gateway starts up, **Then** it connects to Supabase Postgres, verifies/creates the required database tables (`processed_transactions`, `verification_challenges`), and uses Supabase for all state operations.
3. **Given** an invalid or unreachable Supabase database URL, **When** the gateway starts up, **Then** it raises a clear configuration error on startup rather than failing mid-request.

---

### User Story 2 - Transaction & Challenge Persistence Parity (Priority: P2)

As a production gateway host, I want both SQLite and Supabase database adapters to implement the exact same interface for double-spend checking (`is_transaction_processed`), transaction recording (`record_transaction`), and challenge lifecycle tracking (`create_challenge`, `get_challenge`, `update_challenge_status`), so that API business logic in `main.py` remains completely agnostic to the database backend.

**Why this priority**: Decoupling the database driver from API routing ensures zero regression risk and zero code duplication across endpoints.

**Independent Test**: Can be tested by running the entire `pytest` suite twice—once with `DATABASE_ADAPTER=sqlite` and once with `DATABASE_ADAPTER=supabase` (or mock Supabase client)—confirming 100% test passage in both modes.

**Acceptance Scenarios**:

1. **Given** a payment transaction verified on cloud, **When** `record_transaction` is invoked on the Supabase adapter, **Then** the transaction record is inserted into Supabase Postgres with identical schema constraints (52-char `txn_id`, sender, receiver, microALGO amount, reference_id, ISO timestamp).
2. **Given** an existing `txn_id` recorded in Supabase, **When** `is_transaction_processed` is called with that `txn_id`, **Then** it returns `True`, preventing double-spends on cloud-deployed instances.

---

### Edge Cases

- What happens if the Supabase Postgres connection drops temporarily during a request?
- How are timezone formats handled between SQLite string ISO timestamps and Postgres `TIMESTAMPTZ`?
- What happens if Supabase connection pooling (e.g. Supavisor on port 6543 vs direct port 5432) is used?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an abstract `DatabaseAdapter` base class (or interface) defining uniform database methods: `init_db()`, `is_transaction_processed(txn_id)`, `record_transaction(...)`, `create_challenge(...)`, `get_challenge(reference_id)`, and `update_challenge_status(reference_id, status)`.
- **FR-002**: System MUST implement `SQLiteDatabaseAdapter` as the default local backend wrapping `sqlite3`.
- **FR-003**: System MUST implement `SupabaseDatabaseAdapter` supporting direct Async/Sync Postgres connections (via `psycopg2`/`asyncpg` or Supabase Python SDK `supabase-py`).
- **FR-004**: Gateway configuration (`config.py`) MUST parse `DATABASE_ADAPTER` (values: `sqlite`, `supabase`, `postgres`), `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_DATABASE_URL` (Postgres connection string).
- **FR-005**: Factory function `get_database_adapter()` MUST return the appropriate adapter instance based on `settings.DATABASE_ADAPTER`.
- **FR-006**: Both adapters MUST enforce identical column definitions and constraints for `processed_transactions` and `verification_challenges`.

### Key Entities

- **Database Adapter Factory**: Instantiates the selected database backend on startup.
- **SQLite Database Adapter**: Manages local SQLite connection files (`gateway.db`).
- **Supabase Database Adapter**: Manages cloud Postgres connections/REST API interactions with Supabase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% test coverage and parity across both SQLite and Supabase database adapters for all double-spend and challenge lifecycle scenarios.
- **SC-002**: Local testing execution time remains `< 1 second` for unit test suites using SQLite.
- **SC-003**: Zero downtime database failover/reconnection handling for Supabase Postgres connections during cloud deployment dyno restarts.

## Assumptions

- SQLite will remain the default for local development and unit testing (`DATABASE_ADAPTER=sqlite`).
- Supabase provides standard PostgreSQL connection strings (e.g., `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres` or transaction pooler port `6543`).
- Database migration schemas will be kept simple enough to execute `CREATE TABLE IF NOT EXISTS` safely across both SQLite and PostgreSQL dialects without requiring complex ORM migration frameworks for v1.
