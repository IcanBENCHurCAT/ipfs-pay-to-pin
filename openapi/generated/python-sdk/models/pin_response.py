from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PinResponse")


@_attrs_define
class PinResponse:
    """
    Example:
        {'status': 'success', 'message': 'Payment verified. File successfully pinned to IPFS for 365 days.', 'filename':
            'document.pdf', 'ipfs_cid': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 'gateway_url':
            'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 'pinned_at':
            '2026-09-20T05:00:00.000Z', 'expires_at': '2027-09-20T05:00:00.000Z', 'ttl_days': 365, 'renewal_url':
            '/api/v1/renew?cid=bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'}

    Attributes:
        cid (str | Unset): The IPFS CID for the pinned file (e.g., bafybeig...).
        ipfs_cid (str | Unset): Alias for cid.
        gateway_url (str | Unset): Public gateway URL to immediately access the pinned file.
        pinned_at (datetime.datetime | Unset): ISO 8601 timestamp when the file was pinned.
        expires_at (datetime.datetime | Unset): ISO 8601 timestamp when the 365-day retention expires.
        ttl_days (int | Unset): Time-to-live in days. Always 365 for initial pin. Example: 365.
        status (str | Unset): Status descriptor (e.g., "success").
        message (str | Unset): Detailed result message.
        filename (str | Unset): The original filename.
        renewal_url (str | Unset): API path to renew this pin.
    """

    cid: str | Unset = UNSET
    ipfs_cid: str | Unset = UNSET
    gateway_url: str | Unset = UNSET
    pinned_at: datetime.datetime | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    ttl_days: int | Unset = UNSET
    status: str | Unset = UNSET
    message: str | Unset = UNSET
    filename: str | Unset = UNSET
    renewal_url: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cid = self.cid

        ipfs_cid = self.ipfs_cid

        gateway_url = self.gateway_url

        pinned_at: str | Unset = UNSET
        if not isinstance(self.pinned_at, Unset):
            pinned_at = self.pinned_at.isoformat()

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        ttl_days = self.ttl_days

        status = self.status

        message = self.message

        filename = self.filename

        renewal_url = self.renewal_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if cid is not UNSET:
            field_dict["cid"] = cid
        if ipfs_cid is not UNSET:
            field_dict["ipfs_cid"] = ipfs_cid
        if gateway_url is not UNSET:
            field_dict["gateway_url"] = gateway_url
        if pinned_at is not UNSET:
            field_dict["pinned_at"] = pinned_at
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if ttl_days is not UNSET:
            field_dict["ttl_days"] = ttl_days
        if status is not UNSET:
            field_dict["status"] = status
        if message is not UNSET:
            field_dict["message"] = message
        if filename is not UNSET:
            field_dict["filename"] = filename
        if renewal_url is not UNSET:
            field_dict["renewal_url"] = renewal_url

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        cid = d.pop("cid", UNSET)

        ipfs_cid = d.pop("ipfs_cid", UNSET)

        gateway_url = d.pop("gateway_url", UNSET)

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

        ttl_days = d.pop("ttl_days", UNSET)

        status = d.pop("status", UNSET)

        message = d.pop("message", UNSET)

        filename = d.pop("filename", UNSET)

        renewal_url = d.pop("renewal_url", UNSET)

        pin_response = cls(
            cid=cid,
            ipfs_cid=ipfs_cid,
            gateway_url=gateway_url,
            pinned_at=pinned_at,
            expires_at=expires_at,
            ttl_days=ttl_days,
            status=status,
            message=message,
            filename=filename,
            renewal_url=renewal_url,
        )

        pin_response.additional_properties = d
        return pin_response

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
