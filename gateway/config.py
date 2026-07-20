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

settings = Settings()

