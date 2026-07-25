# Tasks: Pluggable Supabase Postgres & SQLite Database Adapters

**Input**: Design documents from `/specs/005-supabase-postgres-adapter/`

## Phase 1: Setup & Configuration Updates

- [x] T001 Update environment configuration in `gateway/config.py` to include `DATABASE_ADAPTER`, `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_KEY`
- [x] T002 Add `psycopg2-binary` (or `asyncpg` / `supabase`) to `requirements.txt` for Postgres/Supabase connectivity


---

## Phase 2: Core Abstraction & SQLite Refactoring

- [x] T003 Create `BaseDatabaseAdapter` abstract base class in `gateway/database.py` with standard CRUD and query methods
- [x] T004 Refactor existing SQLite functions into `SQLiteDatabaseAdapter` subclass in `gateway/database.py`

---

## Phase 3: Supabase Postgres Adapter Implementation

- [x] T005 Implement `SupabaseDatabaseAdapter` in `gateway/database.py` supporting table auto-initialization (`CREATE TABLE IF NOT EXISTS`) and Postgres DDL queries
- [x] T006 Implement factory function `get_database_adapter()` in `gateway/database.py` to return the active adapter based on settings


---

## Phase 4: Gateway Integration & Testing

- [x] T007 Update startup initialization and API endpoints in `gateway/main.py` to use `get_database_adapter()`
- [x] T008 Update test fixtures in `tests/test_gateway.py` to verify adapter isolation and test both SQLite and Supabase mock adapters
- [x] T009 Run full test suite via `pytest` to confirm 100% test passage
