from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.health_response_status import HealthResponseStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.queue_metrics import QueueMetrics


T = TypeVar("T", bound="HealthResponse")


@_attrs_define
class HealthResponse:
    """
    Example:
        {'status': 'ok', 'ready': True, 'uptime': 3600, 'queue': {'size': 12, 'max_size': 1000, 'is_healthy': True},
            'timestamp': '2026-09-20T05:00:00.000Z'}

    Attributes:
        status (HealthResponseStatus | Unset): Overall gateway status.
        ready (bool | Unset): Whether the gateway is ready to process requests.
        uptime (int | Unset): Server uptime in seconds.
        queue (QueueMetrics | Unset):
        timestamp (datetime.datetime | Unset): ISO 8601 timestamp of this health check.
    """

    status: HealthResponseStatus | Unset = UNSET
    ready: bool | Unset = UNSET
    uptime: int | Unset = UNSET
    queue: QueueMetrics | Unset = UNSET
    timestamp: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        ready = self.ready

        uptime = self.uptime

        queue: dict[str, Any] | Unset = UNSET
        if not isinstance(self.queue, Unset):
            queue = self.queue.to_dict()

        timestamp: str | Unset = UNSET
        if not isinstance(self.timestamp, Unset):
            timestamp = self.timestamp.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if status is not UNSET:
            field_dict["status"] = status
        if ready is not UNSET:
            field_dict["ready"] = ready
        if uptime is not UNSET:
            field_dict["uptime"] = uptime
        if queue is not UNSET:
            field_dict["queue"] = queue
        if timestamp is not UNSET:
            field_dict["timestamp"] = timestamp

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.queue_metrics import QueueMetrics  # noqa: PLC0415

        d = dict(src_dict)
        _status = d.pop("status", UNSET)
        status: HealthResponseStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = HealthResponseStatus(_status)

        ready = d.pop("ready", UNSET)

        uptime = d.pop("uptime", UNSET)

        _queue = d.pop("queue", UNSET)
        queue: QueueMetrics | Unset
        if isinstance(_queue, Unset):
            queue = UNSET
        else:
            queue = QueueMetrics.from_dict(_queue)

        _timestamp = d.pop("timestamp", UNSET)
        timestamp: datetime.datetime | Unset
        if isinstance(_timestamp, Unset):
            timestamp = UNSET
        else:
            timestamp = datetime.datetime.fromisoformat(_timestamp)

        health_response = cls(
            status=status,
            ready=ready,
            uptime=uptime,
            queue=queue,
            timestamp=timestamp,
        )

        health_response.additional_properties = d
        return health_response

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
