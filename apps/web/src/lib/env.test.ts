import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("env", () => {
  it("T-00 treats empty values as unset and defaults APP_ENV", () => {
    const env = parseEnv({ SUPABASE_URL: "", CRON_KEY: "" });

    expect(env.APP_ENV).toBe("development");
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.CRON_KEY).toBeUndefined();
  });

  it("T-00 accepts CLOCK_NOW_OVERRIDE outside production", () => {
    const env = parseEnv({ APP_ENV: "test", CLOCK_NOW_OVERRIDE: "2026-10-13T00:00:00Z" });

    expect(env.CLOCK_NOW_OVERRIDE?.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("T-00 rejects CLOCK_NOW_OVERRIDE when APP_ENV=production", () => {
    expect(() =>
      parseEnv({ APP_ENV: "production", CLOCK_NOW_OVERRIDE: "2026-10-13T00:00:00Z" }),
    ).toThrow(/CLOCK_NOW_OVERRIDE/);
  });
});
