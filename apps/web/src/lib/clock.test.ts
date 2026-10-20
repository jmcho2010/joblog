import { describe, expect, it } from "vitest";
import { FixedClock, SystemClock } from "./clock";

describe("clock", () => {
  it("T-00 FixedClock returns the fixed instant", () => {
    const clock = new FixedClock(new Date("2026-10-13T00:00:00Z"));

    expect(clock.now().toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("T-00 SystemClock returns the override instant when given", () => {
    const clock = new SystemClock(new Date("2026-10-13T00:00:00Z"));

    expect(clock.now().toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });
});
