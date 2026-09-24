from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="RenewResponse")


@_attrs_define
class RenewResponse:
    """
    Example:
        {'status': 'success', 'message': 'Payment verified. Pin extended for 365 days.', 'cid':
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', 'expires_at': '2028-09-20T05:00:00.000Z',
            'renewals_count': 2}

    Attributes:
        status (str | Unset): Status descriptor.
        message (str | Unset): Result message confirming renewal.
        cid (str | Unset): The IPFS CID that was renewed.
        expires_at (datetime.datetime | Unset): New expiration timestamp (365 days from renewal).
        renewals_count (int | Unset): Total number of renewals applied.
    """

    status: str | Unset = UNSET
    message: str | Unset = UNSET
    cid: str | Unset = UNSET
    expires_at: datetime.datetime | Unset = UNSET
    renewals_count: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status = self.status

        message = self.message

        cid = self.cid

        expires_at: str | Unset = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()

        renewals_count = self.renewals_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if status is not UNSET:
            field_dict["status"] = status
        if message is not UNSET:
            field_dict["message"] = message
        if cid is not UNSET:
            field_dict["cid"] = cid
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if renewals_count is not UNSET:
            field_dict["renewals_count"] = renewals_count

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = d.pop("status", UNSET)

        message = d.pop("message", UNSET)

        cid = d.pop("cid", UNSET)

        _expires_at = d.pop("expires_at", UNSET)
        expires_at: datetime.datetime | Unset
        if isinstance(_expires_at, Unset):
            expires_at = UNSET
        else:
            expires_at = datetime.datetime.fromisoformat(_expires_at)

        renewals_count = d.pop("renewals_count", UNSET)

        renew_response = cls(
            status=status,
            message=message,
            cid=cid,
            expires_at=expires_at,
            renewals_count=renewals_count,
        )

        renew_response.additional_properties = d
        return renew_response

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
