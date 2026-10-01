from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="AgentCardResponseSupportedInterfacesItem")


@_attrs_define
class AgentCardResponseSupportedInterfacesItem:
    """
    Attributes:
        url (str | Unset):
        protocol_binding (str | Unset):
        protocol_version (str | Unset):
    """

    url: str | Unset = UNSET
    protocol_binding: str | Unset = UNSET
    protocol_version: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        url = self.url

        protocol_binding = self.protocol_binding

        protocol_version = self.protocol_version

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if url is not UNSET:
            field_dict["url"] = url
        if protocol_binding is not UNSET:
            field_dict["protocolBinding"] = protocol_binding
        if protocol_version is not UNSET:
            field_dict["protocolVersion"] = protocol_version

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url", UNSET)

        protocol_binding = d.pop("protocolBinding", UNSET)

        protocol_version = d.pop("protocolVersion", UNSET)

        agent_card_response_supported_interfaces_item = cls(
            url=url,
            protocol_binding=protocol_binding,
            protocol_version=protocol_version,
        )

        agent_card_response_supported_interfaces_item.additional_properties = d
        return agent_card_response_supported_interfaces_item

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
