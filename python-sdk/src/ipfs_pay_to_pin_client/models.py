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


@dataclass
class PinStatusResponse:
    pinned_at: str
    expires_at: str
    days_remaining: int
    is_active: bool
    ttl_days: int
    renewals_count: int
    renewal_url: str
