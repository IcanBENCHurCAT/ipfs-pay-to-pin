import os

class Settings:
    ALGORAND_NETWORK: str = os.getenv("ALGORAND_NETWORK", "localnet")
    ESCROW_ADDRESS: str = os.getenv("ESCROW_ADDRESS", "MOCKED_ESCROW_ADDRESS")

settings = Settings()
