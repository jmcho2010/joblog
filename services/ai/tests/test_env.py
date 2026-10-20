from datetime import UTC, datetime

import pytest

from app.env import EnvError, load_env


def test_T_00_empty_values_are_unset_and_app_env_defaults() -> None:
    env = load_env({"SUPABASE_URL": "", "GEMINI_API_KEY": ""})

    assert env.app_env == "development"
    assert env.supabase_url is None
    assert env.gemini_api_key is None


def test_T_00_clock_override_is_accepted_outside_production() -> None:
    env = load_env({"APP_ENV": "test", "CLOCK_NOW_OVERRIDE": "2026-10-13T00:00:00Z"})

    assert env.clock_now_override == datetime(2026, 10, 13, tzinfo=UTC)


def test_T_00_clock_override_is_rejected_in_production() -> None:
    with pytest.raises(EnvError, match="CLOCK_NOW_OVERRIDE"):
        load_env({"APP_ENV": "production", "CLOCK_NOW_OVERRIDE": "2026-10-13T00:00:00Z"})
