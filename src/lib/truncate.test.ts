import { describe, expect, it } from "vitest";
import { truncateHead, truncateTail } from "./truncate";

describe("truncateTail", () => {
  it("shouldReturnTextUnchangedWhenWithinLimit", () => {
    expect(truncateTail("hello", 10)).toBe("hello");
  });

  it("shouldKeepLastCharsWhenOverLimit", () => {
    expect(truncateTail("hello world", 5)).toBe("world");
  });

  it("shouldReturnEmptyWhenLimitIsZero", () => {
    expect(truncateTail("hello", 0)).toBe("");
  });
});

describe("truncateHead", () => {
  it("shouldReturnTextUnchangedWhenWithinLimit", () => {
    expect(truncateHead("hello", 10)).toBe("hello");
  });

  it("shouldKeepFirstCharsWhenOverLimit", () => {
    expect(truncateHead("hello world", 5)).toBe("hello");
  });

  it("shouldReturnEmptyWhenLimitIsZero", () => {
    expect(truncateHead("hello", 0)).toBe("");
  });
});
