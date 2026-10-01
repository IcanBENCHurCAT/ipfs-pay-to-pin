from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PinRequest")


@_attrs_define
class PinRequest:
    """
    Example:
        {'filename': 'document.pdf', 'data': 'base64_encoded_file_data_here'}

    Attributes:
        filename (str): The name of the file to pin (e.g., "document.pdf").
        data (str): Base64-encoded file data. Maximum payload size: 20 MB before encoding. The Base64-encoded length
            must not exceed 20 * 1024 * 1024 characters.
    """

    filename: str
    data: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        filename = self.filename

        data = self.data

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "filename": filename,
                "data": data,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        filename = d.pop("filename")

        data = d.pop("data")

        pin_request = cls(
            filename=filename,
            data=data,
        )

        pin_request.additional_properties = d
        return pin_request

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
