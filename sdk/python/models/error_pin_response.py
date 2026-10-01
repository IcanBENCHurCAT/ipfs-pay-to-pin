from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ErrorPinResponse")


@_attrs_define
class ErrorPinResponse:
    """
    Example:
        {'error': 'Pinning failed', 'message': 'Failed to process file upload. Please try again later.',
            'refund_initiated': True, 'refund_tx_id': 'TXID1234567890abcdef'}

    Attributes:
        error (str | Unset): Error code or summary.
        message (str | Unset): Human-readable error description.
        refund_initiated (bool | Unset): Whether a refund was automatically initiated.
        refund_tx_id (str | Unset): The on-chain refund transaction ID (if applicable).
    """

    error: str | Unset = UNSET
    message: str | Unset = UNSET
    refund_initiated: bool | Unset = UNSET
    refund_tx_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        error = self.error

        message = self.message

        refund_initiated = self.refund_initiated

        refund_tx_id = self.refund_tx_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if error is not UNSET:
            field_dict["error"] = error
        if message is not UNSET:
            field_dict["message"] = message
        if refund_initiated is not UNSET:
            field_dict["refund_initiated"] = refund_initiated
        if refund_tx_id is not UNSET:
            field_dict["refund_tx_id"] = refund_tx_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        error = d.pop("error", UNSET)

        message = d.pop("message", UNSET)

        refund_initiated = d.pop("refund_initiated", UNSET)

        refund_tx_id = d.pop("refund_tx_id", UNSET)

        error_pin_response = cls(
            error=error,
            message=message,
            refund_initiated=refund_initiated,
            refund_tx_id=refund_tx_id,
        )

        error_pin_response.additional_properties = d
        return error_pin_response

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
