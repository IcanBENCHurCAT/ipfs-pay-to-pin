# Architectural & Technical Plan: Pluggable Supabase Postgres & SQLite Database Adapters

**Branch**: `005-supabase-postgres-adapter` | **Date**: 2026-07-25 | **Spec**: [specs/005-supabase-postgres-adapter/spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/ipfs-pay-to-pin/specs/005-supabase-postgres-adapter/spec.md)

## Summary

Implement a pluggable database architecture in `gateway/database.py` allowing the gateway to seamlessly run on **SQLite** for local development/testing and **Supabase (Postgres)** for production/cloud deployments (e.g. Heroku).

## Technical Architecture

```mermaid
graph TD
    A[FastAPI Gateway: main.py] -->|Queries| B[get_database_adapter]
    B -->|DATABASE_ADAPTER=sqlite| C[SQLiteDatabaseAdapter]
    B -->|DATABASE_ADAPTER=supabase| D[SupabaseDatabaseAdapter]
    C -->|Reads/Writes| E[(Local SQLite: gateway.db)]
    D -->|Postgres / REST API| F[(Cloud Supabase Postgres)]
```

### Key Design Pattern: Adapter Pattern
We extract the current `sqlite3` direct calls into an abstract interface `BaseDatabaseAdapter`. 

```python
class BaseDatabaseAdapter(ABC):
    @abstractmethod
    def init_db(self): pass
    @abstractmethod
    def is_transaction_processed(self, txn_id: str) -> bool: pass
    @abstractmethod
    def record_transaction(self, txn_id: str, sender: str, receiver: str, amount: int, reference_id: str): pass
    @abstractmethod
    def create_challenge(self, reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600): pass
    @abstractmethod
    def get_challenge(self, reference_id: str) -> dict | None: pass
    @abstractmethod
    def update_challenge_status(self, reference_id: str, status: str): pass
```

## Schema Parity & DDL Mapping

| Field | SQLite Type | PostgreSQL / Supabase Type | Notes |
| :--- | :--- | :--- | :--- |
| **processed_transactions** | | | |
| `txn_id` | `TEXT PRIMARY KEY` | `VARCHAR(52) PRIMARY KEY` | 52-char Algorand Txn Hash |
| `sender` | `TEXT NOT NULL` | `VARCHAR(58) NOT NULL` | Algorand Address |
| `receiver` | `TEXT NOT NULL` | `VARCHAR(58) NOT NULL` | Gateway Escrow Address |
| `amount` | `INTEGER NOT NULL` | `BIGINT NOT NULL` | microALGOs |
| `reference_id` | `TEXT NOT NULL` | `VARCHAR(64) NOT NULL` | Challenge reference UUID |
| `timestamp` | `TEXT NOT NULL` | `TIMESTAMPTZ NOT NULL` | UTC Timestamp |
| **verification_challenges**| | | |
| `reference_id` | `TEXT PRIMARY KEY` | `VARCHAR(64) PRIMARY KEY` | Unique challenge ID |
| `expected_amount` | `INTEGER NOT NULL` | `BIGINT NOT NULL` | microALGOs required |
| `escrow_address` | `TEXT NOT NULL` | `VARCHAR(58) NOT NULL` | Target Escrow Address |
| `status` | `TEXT NOT NULL` | `VARCHAR(20) NOT NULL` | PENDING, VERIFIED, REJECTED, EXPIRED |
| `expires_at` | `TEXT NOT NULL` | `TIMESTAMPTZ NOT NULL` | Expiration time |

## Configuration Environment Variables

- `DATABASE_ADAPTER`: `sqlite` (default) or `supabase` (or `postgres`).
- `DATABASE_PATH`: Path to SQLite file (`gateway.db`).
- `SUPABASE_DATABASE_URL`: Postgres URI (e.g. `postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres` or Transaction Pooler port `6543`).
- `SUPABASE_URL`: Optional Supabase project API URL (e.g. `https://[REF].supabase.co`).
- `SUPABASE_KEY`: Optional Supabase Service Role API key.
