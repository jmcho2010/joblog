import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

APP_ENVS = ("development", "test", "production")


class EnvError(ValueError):
    pass


@dataclass(frozen=True)
class Env:
    app_env: str
    supabase_url: str | None
    supabase_service_role_key: str | None
    gemini_api_key: str | None
    ai_enabled: bool | None
    sentry_dsn: str | None
    clock_now_override: datetime | None


def _parse_url(name: str, value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        raise EnvError(f"{name} must be an absolute URL")
    return value


def _parse_bool(name: str, value: str | None) -> bool | None:
    if value is None:
        return None
    if value not in ("true", "false"):
        raise EnvError(f"{name} must be 'true' or 'false'")
    return value == "true"


def _parse_aware_datetime(name: str, value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as error:
        raise EnvError(f"{name} must be an ISO 8601 datetime") from error
    if parsed.tzinfo is None:
        raise EnvError(f"{name} must include a UTC offset")
    return parsed


def load_env(source: Mapping[str, str] | None = None) -> Env:
    # Empty values (e.g. copied straight from .env.example) count as unset.
    raw = {key: value for key, value in (os.environ if source is None else source).items() if value}

    app_env = raw.get("APP_ENV", "development")
    if app_env not in APP_ENVS:
        raise EnvError(f"APP_ENV must be one of {', '.join(APP_ENVS)}")

    clock_now_override = _parse_aware_datetime("CLOCK_NOW_OVERRIDE", raw.get("CLOCK_NOW_OVERRIDE"))
    if app_env == "production" and clock_now_override is not None:
        # docs/design/RUNBOOK.md §5: a frozen clock must never reach production.
        raise EnvError("CLOCK_NOW_OVERRIDE must not be set when APP_ENV=production")

    return Env(
        app_env=app_env,
        supabase_url=_parse_url("SUPABASE_URL", raw.get("SUPABASE_URL")),
        supabase_service_role_key=raw.get("SUPABASE_SERVICE_ROLE_KEY"),
        gemini_api_key=raw.get("GEMINI_API_KEY"),
        ai_enabled=_parse_bool("AI_ENABLED", raw.get("AI_ENABLED")),
        sentry_dsn=raw.get("SENTRY_DSN"),
        clock_now_override=clock_now_override,
    )
