from enum import StrEnum


class HealthResponseStatus(StrEnum):
    DEGRADED = "degraded"
    OK = "ok"

    def __str__(self) -> str:
        return str(self.value)
