from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PinResponse:
    cid: str
    status: str
    pin_expires_at: str
    size_bytes: int
    tx_id: str | None = None
    gateway_url: str | None = None
