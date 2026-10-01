from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="AgentCardResponseCapabilities")


@_attrs_define
class AgentCardResponseCapabilities:
    """
    Attributes:
        streaming (bool | Unset):
        push_notifications (bool | Unset):
    """

    streaming: bool | Unset = UNSET
    push_notifications: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        streaming = self.streaming

        push_notifications = self.push_notifications

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if streaming is not UNSET:
            field_dict["streaming"] = streaming
        if push_notifications is not UNSET:
            field_dict["pushNotifications"] = push_notifications

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        streaming = d.pop("streaming", UNSET)

        push_notifications = d.pop("pushNotifications", UNSET)

        agent_card_response_capabilities = cls(
            streaming=streaming,
            push_notifications=push_notifications,
        )

        agent_card_response_capabilities.additional_properties = d
        return agent_card_response_capabilities

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
