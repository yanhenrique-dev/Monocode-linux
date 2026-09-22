import { describe, expect, it } from "vitest";
import {
  asHtmlDivElement,
  findOrThrow,
  isCustomEvent,
  isKeyboardEvent,
} from "./errors";

describe("findOrThrow", () => {
  it("shouldReturnMatchingEntry", () => {
    expect(findOrThrow([1, 2, 3], (n) => n === 2, "number")).toBe(2);
  });

  it("shouldThrowWithScopeWhenMissing", () => {
    expect(() => findOrThrow([1], (n) => n === 9, "tab")).toThrow(
      "tab not found",
    );
  });

  it("shouldPreserveFalsyMatches", () => {
    expect(findOrThrow([0, 1], (n) => n === 0, "zero")).toBe(0);
    expect(findOrThrow([false, true], (b) => !b, "flag")).toBe(false);
    expect(findOrThrow(["", "x"], (s) => s === "", "blank")).toBe("");
  });
});

describe("isKeyboardEvent", () => {
  it("shouldRejectPlainEvents", () => {
    expect(isKeyboardEvent(new Event("keydown"))).toBe(false);
  });
});

describe("isCustomEvent", () => {
  it("shouldAcceptCustomEvents", () => {
    expect(isCustomEvent(new CustomEvent("x", { detail: 1 }))).toBe(true);
  });

  it("shouldRejectPlainEvents", () => {
    expect(isCustomEvent(new Event("x"))).toBe(false);
  });
});

describe("asHtmlDivElement", () => {
  it("shouldReturnNullWhenNull", () => {
    expect(asHtmlDivElement(null)).toBeNull();
  });
});
