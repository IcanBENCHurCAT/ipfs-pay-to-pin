import os
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

class Settings:
    ALGORAND_NETWORK: str = os.getenv("ALGORAND_NETWORK", "localnet")
    ESCROW_ADDRESS: str = os.getenv("ESCROW_ADDRESS", "MOCKED_ESCROW_ADDRESS")
    ESCROW_APP_ID: int = int(os.getenv("ESCROW_APP_ID", "0"))
    
    ALGOD_ADDRESS: str = os.getenv("ALGOD_ADDRESS", "http://localhost:4001")
    ALGOD_TOKEN: str = os.getenv("ALGOD_TOKEN", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

    STORAGE_ADAPTER: str = os.getenv("STORAGE_ADAPTER", "local")
    PINATA_JWT: str = os.getenv("PINATA_JWT", "")
    PINATA_ENDPOINT: str = os.getenv("PINATA_ENDPOINT", "https://api.pinata.cloud/pinning/pinFileToIPFS")
    # Storage settings from main
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local")
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "tmp/mock_storage")

    # Database Configuration
    DATABASE_ADAPTER: str = os.getenv("DATABASE_ADAPTER", "sqlite")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "gateway.db")
    SUPABASE_DATABASE_URL: str = os.getenv("SUPABASE_DATABASE_URL", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # Fallback Algod nodes (comma-separated list)
    ALGOD_FALLBACK_ADDRESSES: str = os.getenv("ALGOD_FALLBACK_ADDRESSES", "")



settings = Settings()

