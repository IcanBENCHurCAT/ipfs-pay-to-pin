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

    # Storage settings
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "local")
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "tmp/mock_storage")

settings = Settings()
