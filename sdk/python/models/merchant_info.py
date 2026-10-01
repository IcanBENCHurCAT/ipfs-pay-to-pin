from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="MerchantInfo")


@_attrs_define
class MerchantInfo:
    """
    Attributes:
        name (str | Unset):
        description (str | Unset):
        icon (str | Unset):
        image (str | Unset):
        contact (str | Unset):
    """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    icon: str | Unset = UNSET
    image: str | Unset = UNSET
    contact: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        icon = self.icon

        image = self.image

        contact = self.contact

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if icon is not UNSET:
            field_dict["icon"] = icon
        if image is not UNSET:
            field_dict["image"] = image
        if contact is not UNSET:
            field_dict["contact"] = contact

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        icon = d.pop("icon", UNSET)

        image = d.pop("image", UNSET)

        contact = d.pop("contact", UNSET)

        merchant_info = cls(
            name=name,
            description=description,
            icon=icon,
            image=image,
            contact=contact,
        )

        merchant_info.additional_properties = d
        return merchant_info

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
