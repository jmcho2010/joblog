from app.clock import SystemClock
from app.env import load_env


def main() -> None:
    env = load_env()
    clock = SystemClock(env.clock_now_override)
    # The worker loop is T-02; this entry point only proves env validation and the clock wiring.
    print(f"jobLog AI worker: not implemented yet (APP_ENV={env.app_env}, now={clock.now()})")


if __name__ == "__main__":
    main()
