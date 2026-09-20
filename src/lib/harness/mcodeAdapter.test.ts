import { describe, expect, it } from "vitest";
import { ensureMcodeRegistered } from "./mcodeAdapter";
import { getHarness } from "./registry";

describe("mcode adapter registration", () => {
  it("registers a live, non-steerable adapter with catalog refresh", () => {
    ensureMcodeRegistered();
    const adapter = getHarness("mcode");
    expect(adapter?.live).toBe(true);
    expect(adapter?.canSteer).toBe(false);
    expect(typeof adapter?.refreshCatalog).toBe("function");
    expect(typeof adapter?.sendTurn).toBe("function");
  });
});
