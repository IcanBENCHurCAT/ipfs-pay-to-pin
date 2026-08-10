from dataclasses import dataclass
from typing import Optional


@dataclass
class PinResponse:
    cid: str
    status: str
    pin_expires_at: str
    size_bytes: int
    tx_id: Optional[str] = None
