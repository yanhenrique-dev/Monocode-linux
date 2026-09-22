import { describe, expect, it } from "vitest";
import { formatCompactRelative, formatShortDate } from "./displayFormat";

describe("formatCompactRelative", () => {
  it("shouldReturnEmptyWhenValueIsNotPositive", () => {
    expect(formatCompactRelative(0, 1000)).toBe("");
    expect(formatCompactRelative(-5, 1000)).toBe("");
  });

  it("shouldReturnNowWhenUnderAMinute", () => {
    expect(formatCompactRelative(1000, 30_000)).toBe("now");
  });

  it("shouldReturnMinutesWhenUnderAnHour", () => {
    expect(formatCompactRelative(1000, 301_000)).toBe("5m");
  });

  it("shouldReturnHoursAndMinutesWhenUnderADay", () => {
    expect(formatCompactRelative(1000, 2 * 3_600_000 + 3 * 60_000 + 1000)).toBe(
      "2h 3m",
    );
  });

  it("shouldReturnDaysWhenUnderAWeek", () => {
    expect(formatCompactRelative(1000, 3 * 86_400_000 + 1000)).toBe("3d");
  });
});

describe("formatShortDate", () => {
  it("shouldReturnEmptyWhenValueIsNotPositive", () => {
    expect(formatShortDate(0)).toBe("");
  });

  it("shouldFormatDateWithoutThrowing", () => {
    expect(formatShortDate(Date.now()).length).toBeGreaterThan(0);
  });
});
