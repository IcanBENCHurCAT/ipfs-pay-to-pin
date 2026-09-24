from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="QueueMetrics")


@_attrs_define
class QueueMetrics:
    """
    Attributes:
        size (int | Unset): Current queue depth (pending pins).
        max_size (int | Unset): Maximum allowed queue depth.
        is_healthy (bool | Unset): Whether the queue is within healthy limits.
    """

    size: int | Unset = UNSET
    max_size: int | Unset = UNSET
    is_healthy: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        size = self.size

        max_size = self.max_size

        is_healthy = self.is_healthy

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if size is not UNSET:
            field_dict["size"] = size
        if max_size is not UNSET:
            field_dict["max_size"] = max_size
        if is_healthy is not UNSET:
            field_dict["is_healthy"] = is_healthy

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        size = d.pop("size", UNSET)

        max_size = d.pop("max_size", UNSET)

        is_healthy = d.pop("is_healthy", UNSET)

        queue_metrics = cls(
            size=size,
            max_size=max_size,
            is_healthy=is_healthy,
        )

        queue_metrics.additional_properties = d
        return queue_metrics

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
