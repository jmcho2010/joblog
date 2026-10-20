from datetime import UTC, datetime

from app.clock import FixedClock, SystemClock


def test_T_00_fixed_clock_returns_fixed_instant() -> None:
    instant = datetime(2026, 10, 13, tzinfo=UTC)

    assert FixedClock(instant).now() == instant


def test_T_00_system_clock_returns_override_when_given() -> None:
    instant = datetime(2026, 10, 13, tzinfo=UTC)

    assert SystemClock(instant).now() == instant
