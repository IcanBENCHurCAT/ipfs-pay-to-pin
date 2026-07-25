import sqlite3
import datetime
import os
from abc import ABC, abstractmethod
from gateway.config import settings

class BaseDatabaseAdapter(ABC):
    """
    Abstract Base Class for Gateway Database Adapters.
    """
    @abstractmethod
    def init_db(self):
        pass

    @abstractmethod
    def is_transaction_processed(self, txn_id: str) -> bool:
        pass

    @abstractmethod
    def record_transaction(self, txn_id: str, sender: str, receiver: str, amount: int, reference_id: str):
        pass

    @abstractmethod
    def create_challenge(self, reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600):
        pass

    @abstractmethod
    def get_challenge(self, reference_id: str) -> dict | None:
        pass

    @abstractmethod
    def update_challenge_status(self, reference_id: str, status: str):
        pass

    @abstractmethod
    def delete_transaction(self, txn_id: str):
        pass


class SQLiteDatabaseAdapter(BaseDatabaseAdapter):
    """
    SQLite implementation for local development and testing.
    """
    def get_db_connection(self):
        db_dir = os.path.dirname(settings.DATABASE_PATH)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            
        conn = sqlite3.connect(settings.DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_transactions (
                txn_id TEXT PRIMARY KEY,
                sender TEXT NOT NULL,
                receiver TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reference_id TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS verification_challenges (
                reference_id TEXT PRIMARY KEY,
                expected_amount INTEGER NOT NULL,
                escrow_address TEXT NOT NULL,
                status TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()

    def is_transaction_processed(self, txn_id: str) -> bool:
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM processed_transactions WHERE txn_id = ?",
            (txn_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return row is not None

    def record_transaction(self, txn_id: str, sender: str, receiver: str, amount: int, reference_id: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO processed_transactions (txn_id, sender, receiver, amount, reference_id, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    txn_id,
                    sender,
                    receiver,
                    amount,
                    reference_id,
                    datetime.datetime.now(datetime.UTC).isoformat()
                )
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass
        finally:
            conn.close()

    def create_challenge(self, reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        expires_at = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=ttl_seconds)).isoformat()
        try:
            cursor.execute(
                """
                INSERT INTO verification_challenges (reference_id, expected_amount, escrow_address, status, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (reference_id, expected_amount, escrow_address, "PENDING", expires_at)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass
        finally:
            conn.close()

    def get_challenge(self, reference_id: str) -> dict | None:
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM verification_challenges WHERE reference_id = ?",
            (reference_id,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    def update_challenge_status(self, reference_id: str, status: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE verification_challenges SET status = ? WHERE reference_id = ?",
            (status, reference_id)
        )
        conn.commit()
        conn.close()

    def delete_transaction(self, txn_id: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM processed_transactions WHERE txn_id = ?", (txn_id,))
        conn.commit()
        conn.close()


class SupabaseDatabaseAdapter(BaseDatabaseAdapter):
    """
    Supabase Postgres implementation for production / cloud deployments.
    Uses psycopg2 connection pooling or direct SQL queries.
    """
    def __init__(self):
        self.db_url = settings.SUPABASE_DATABASE_URL

    def get_db_connection(self):
        import psycopg2
        import psycopg2.extras
        if not self.db_url:
            raise ValueError("SUPABASE_DATABASE_URL is not configured.")
        
        db_url = self.db_url
        if "sslmode=" not in db_url:
            separator = "&" if "?" in db_url else "?"
            db_url += f"{separator}sslmode=require"

        conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
        return conn


    def init_db(self):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_transactions (
                txn_id VARCHAR(52) PRIMARY KEY,
                sender VARCHAR(58) NOT NULL,
                receiver VARCHAR(58) NOT NULL,
                amount BIGINT NOT NULL,
                reference_id VARCHAR(64) NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS verification_challenges (
                reference_id VARCHAR(64) PRIMARY KEY,
                expected_amount BIGINT NOT NULL,
                escrow_address VARCHAR(58) NOT NULL,
                status VARCHAR(20) NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()

    def is_transaction_processed(self, txn_id: str) -> bool:
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM processed_transactions WHERE txn_id = %s",
            (txn_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return row is not None

    def record_transaction(self, txn_id: str, sender: str, receiver: str, amount: int, reference_id: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO processed_transactions (txn_id, sender, receiver, amount, reference_id, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (txn_id) DO NOTHING
                """,
                (
                    txn_id,
                    sender,
                    receiver,
                    amount,
                    reference_id,
                    datetime.datetime.now(datetime.UTC)
                )
            )
            conn.commit()
        finally:
            conn.close()

    def create_challenge(self, reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=ttl_seconds)
        try:
            cursor.execute(
                """
                INSERT INTO verification_challenges (reference_id, expected_amount, escrow_address, status, expires_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (reference_id) DO NOTHING
                """,
                (reference_id, expected_amount, escrow_address, "PENDING", expires_at)
            )
            conn.commit()
        finally:
            conn.close()

    def get_challenge(self, reference_id: str) -> dict | None:
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM verification_challenges WHERE reference_id = %s",
            (reference_id,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            record = dict(row)
            if isinstance(record.get("expires_at"), datetime.datetime):
                record["expires_at"] = record["expires_at"].isoformat()
            return record
        return None

    def update_challenge_status(self, reference_id: str, status: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE verification_challenges SET status = %s WHERE reference_id = %s",
            (status, reference_id)
        )
        conn.commit()
        conn.close()

    def delete_transaction(self, txn_id: str):
        conn = self.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM processed_transactions WHERE txn_id = %s", (txn_id,))
        conn.commit()
        conn.close()


def get_database_adapter() -> BaseDatabaseAdapter:
    """
    Factory function returning the configured DatabaseAdapter instance.
    """
    adapter_name = settings.DATABASE_ADAPTER.lower()
    if adapter_name in ("supabase", "postgres", "postgresql"):
        return SupabaseDatabaseAdapter()
    return SQLiteDatabaseAdapter()


# Backward-compatible module-level helper functions delegating to active adapter
def init_db():
    return get_database_adapter().init_db()

def is_transaction_processed(txn_id: str) -> bool:
    return get_database_adapter().is_transaction_processed(txn_id)

def record_transaction(txn_id: str, sender: str, receiver: str, amount: int, reference_id: str):
    return get_database_adapter().record_transaction(txn_id, sender, receiver, amount, reference_id)

def create_challenge(reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600):
    return get_database_adapter().create_challenge(reference_id, expected_amount, escrow_address, ttl_seconds)

def get_challenge(reference_id: str) -> dict | None:
    return get_database_adapter().get_challenge(reference_id)

def update_challenge_status(reference_id: str, status: str):
    return get_database_adapter().update_challenge_status(reference_id, status)

def delete_transaction(txn_id: str):
    return get_database_adapter().delete_transaction(txn_id)
