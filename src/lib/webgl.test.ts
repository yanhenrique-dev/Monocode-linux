import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetWebGL2Support, supportsWebGL2 } from "./webgl";

describe("supportsWebGL2", () => {
  beforeEach(resetWebGL2Support);
  it("reports true when the probe returns a context", () => {
    expect(supportsWebGL2(() => ({}))).toBe(true);
  });

  it("reports false when the probe returns null", () => {
    expect(supportsWebGL2(() => null)).toBe(false);
  });

  it("reports false when the probe throws", () => {
    expect(
      supportsWebGL2(() => {
        throw new Error("no canvas");
      }),
    ).toBe(false);
  });

  it("reports false without a DOM", () => {
    expect(supportsWebGL2()).toBe(false);
  });

  it("caches the DOM probe until reset", () => {
    let context: unknown = {};
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => context }),
    });
    try {
      expect(supportsWebGL2()).toBe(true);
      context = null;
      expect(supportsWebGL2()).toBe(true);
      resetWebGL2Support();
      expect(supportsWebGL2()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
