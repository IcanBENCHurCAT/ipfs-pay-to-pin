import sqlite3
import datetime
import os
from gateway.config import settings

def get_db_connection():
    """
    Get a connection to the SQLite database.
    """
    # Ensure the parent directory of the database exists
    db_dir = os.path.dirname(settings.DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Initialize the database schema.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create processed_transactions table for double-spend prevention
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
    
    # Create verification_challenges table
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


def is_transaction_processed(txn_id: str) -> bool:
    """
    Check if a transaction ID has already been processed to prevent double-spends.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM processed_transactions WHERE txn_id = ?",
        (txn_id,)
    )
    row = cursor.fetchone()
    conn.close()
    return row is not None

def record_transaction(txn_id: str, sender: str, receiver: str, amount: int, reference_id: str):
    """
    Record a verified transaction to prevent future double-spends.
    """
    conn = get_db_connection()
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
                datetime.datetime.utcnow().isoformat()
            )
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # Transaction already exists
        pass
    finally:
        conn.close()

def create_challenge(reference_id: str, expected_amount: int, escrow_address: str, ttl_seconds: int = 600):
    """
    Create a new verification challenge in the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    expires_at = (datetime.datetime.utcnow() + datetime.timedelta(seconds=ttl_seconds)).isoformat()
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

def get_challenge(reference_id: str) -> dict | None:
    """
    Retrieve a verification challenge from the database.
    """
    conn = get_db_connection()
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

def update_challenge_status(reference_id: str, status: str):
    """
    Update the status of a verification challenge.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE verification_challenges SET status = ? WHERE reference_id = ?",
        (status, reference_id)
    )
    conn.commit()
    conn.close()

