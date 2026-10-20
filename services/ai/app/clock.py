from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    """The only place in the worker allowed to read the real time.

    `override` is the demo-mode clock (docs/design/RUNBOOK.md §5); env.py rejects it in production.
    """

    def __init__(self, override: datetime | None = None) -> None:
        self._override = override

    def now(self) -> datetime:
        return self._override if self._override is not None else datetime.now(UTC)


class FixedClock:
    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def now(self) -> datetime:
        return self._instant
