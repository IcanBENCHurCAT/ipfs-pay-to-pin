from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PinStatusResponse")


@_attrs_define
class PinStatusResponse:
    """
    Example:
        {'pinned_at': '2026-09-20T05:00:00.000Z', 'expires_at': '2027-09-20T05:00:00.000Z', 'days_remaining': 365,
            'is_active': True, 'ttl_days': 365, 'renewals_count': 0, 'renewal_url':
            '/api/v1/renew?cid=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}

    Attributes:
        pinned_at (datetime.datetime | Unset): When the file was initially pinned.
        expires_at (datetime.datetime | Unset): When the retention period expires.
        days_remaining (int | Unset): Calculated days remaining until pin expires. Example: 365.
        is_active (bool | Unset): Whether the pin is currently active.
        ttl_days (int | Unset): Original TTL days purchased. Example: 365.
        renewals_count (int | Unset): Number of renewals applied.
        renewal_url (str | Unset): API path to renew this pin.
    """

    pinned_at: datetime.datetime | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    days_remaining: int | Unset = UNSET
    is_active: bool | Unset = UNSET
    ttl_days: int | Unset = UNSET
    renewals_count: int | Unset = UNSET
    renewal_url: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        pinned_at: str | Unset = UNSET
        if not isinstance(self.pinned_at, Unset):
            pinned_at = self.pinned_at.isoformat()

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        days_remaining = self.days_remaining

        is_active = self.is_active

        ttl_days = self.ttl_days

        renewals_count = self.renewals_count

        renewal_url = self.renewal_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if pinned_at is not UNSET:
            field_dict["pinned_at"] = pinned_at
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if days_remaining is not UNSET:
            field_dict["days_remaining"] = days_remaining
        if is_active is not UNSET:
            field_dict["is_active"] = is_active
        if ttl_days is not UNSET:
            field_dict["ttl_days"] = ttl_days
        if renewals_count is not UNSET:
            field_dict["renewals_count"] = renewals_count
        if renewal_url is not UNSET:
            field_dict["renewal_url"] = renewal_url

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _pinned_at = d.pop("pinned_at", UNSET)
        pinned_at: datetime.datetime | Unset
        if isinstance(_pinned_at, Unset):
            pinned_at = UNSET
        else:
            pinned_at = datetime.datetime.fromisoformat(_pinned_at)

        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at, Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)

        days_remaining = d.pop("days_remaining", UNSET)

        is_active = d.pop("is_active", UNSET)

        ttl_days = d.pop("ttl_days", UNSET)

        renewals_count = d.pop("renewals_count", UNSET)

        renewal_url = d.pop("renewal_url", UNSET)

        pin_status_response = cls(
            pinned_at=pinned_at,
            expires_at=expires_at,
            days_remaining=days_remaining,
            is_active=is_active,
            ttl_days=ttl_days,
            renewals_count=renewals_count,
            renewal_url=renewal_url,
        )

        pin_status_response.additional_properties = d
        return pin_status_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
