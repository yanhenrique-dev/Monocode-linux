import { describe, expect, it } from "vitest";
import { MIN_SPLASH_MS, splashFadeDelay } from "./uiTimings";

const SHOWN_AT = 1_000;

describe("splashFadeDelay", () => {
  it("does not hold the splash when there is no stamp", () => {
    // A missing measurement must never turn into a blind 600ms hold.
    expect(splashFadeDelay(0, 100)).toBe(0);
    expect(splashFadeDelay(0, MIN_SPLASH_MS)).toBe(0);
  });

  it("holds the full minimum on an instant boot", () => {
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT)).toBe(MIN_SPLASH_MS);
  });

  it("holds only the remainder when the boot partly covered it", () => {
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT + 150)).toBe(MIN_SPLASH_MS - 150);
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT + 500)).toBe(MIN_SPLASH_MS - 500);
  });

  it("stops holding at exactly the minimum", () => {
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT + MIN_SPLASH_MS)).toBe(0);
  });

  it("never holds again once a slow boot has already outlasted it", () => {
    // The whole point: a 4s boot shows for 4s, not 4.6s.
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT + 4_000)).toBe(0);
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT + 60_000)).toBe(0);
  });

  it("clamps a clock that reads behind the stamp", () => {
    // now < shownAt would otherwise produce MIN_SPLASH_MS + drift.
    expect(splashFadeDelay(SHOWN_AT, SHOWN_AT - 400)).toBe(MIN_SPLASH_MS);
    expect(splashFadeDelay(SHOWN_AT, 0)).toBe(MIN_SPLASH_MS);
  });

  it("decreases monotonically as the boot takes longer", () => {
    const delays = [0, 100, 300, 599, 600, 900, 5_000].map((elapsed) =>
      splashFadeDelay(SHOWN_AT, SHOWN_AT + elapsed),
    );
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeLessThanOrEqual(delays[i - 1]);
    }
    expect(delays[0]).toBe(MIN_SPLASH_MS);
    expect(delays[delays.length - 1]).toBe(0);
  });
});
