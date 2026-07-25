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

    # Protection & Limit Settings
    MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_FILE_SIZE_BYTES", str(50 * 1024 * 1024)))  # Default 50 MB
    RATE_LIMIT_PIN: str = os.getenv("RATE_LIMIT_PIN", "10/minute")
    TEMP_CHALLENGE_DIR: str = os.getenv("TEMP_CHALLENGE_DIR", "")

settings = Settings()
if not settings.TEMP_CHALLENGE_DIR:
    import tempfile
    settings.TEMP_CHALLENGE_DIR = os.path.join(tempfile.gettempdir(), "pay_to_pin_challenges")


