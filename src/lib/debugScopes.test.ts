// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEBUG_SCOPES_CHANGE_EVENT,
  debugEnabled,
  loadDebugScopesRaw,
  parseDebugScopes,
  saveDebugScopes,
  subscribeDebugScopes,
} from "./debugScopes";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseDebugScopes", () => {
  it("returns null when nothing is allowed", () => {
    expect(parseDebugScopes("")).toBeNull();
    expect(parseDebugScopes("   ")).toBeNull();
    expect(parseDebugScopes(" , , ")).toBeNull();
  });

  it("trims and drops empty parts", () => {
    expect(parseDebugScopes(" harness , inbox ,")).toEqual([
      "harness",
      "inbox",
    ]);
  });

  it("keeps the wildcard as a plain scope", () => {
    expect(parseDebugScopes("*")).toEqual(["*"]);
  });
});

describe("saveDebugScopes", () => {
  it("normalizes to a bare comma join", () => {
    saveDebugScopes(["harness", " inbox ", ""]);
    expect(loadDebugScopesRaw()).toBe("harness,inbox");
  });

  it("stores an empty string when every scope is dropped", () => {
    saveDebugScopes(["", "  "]);
    expect(localStorage.getItem("monocode.debug")).toBe("");
  });

  it("notifies subscribers", () => {
    const onChange = vi.fn();
    const release = subscribeDebugScopes(onChange);
    saveDebugScopes(["harness"]);
    expect(onChange).toHaveBeenCalledOnce();
    release();
    saveDebugScopes(["inbox"]);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("debugEnabled", () => {
  it("is off with nothing stored", () => {
    expect(debugEnabled("harness")).toBe(false);
  });

  it("allows only the listed scopes", () => {
    saveDebugScopes(["harness"]);
    expect(debugEnabled("harness")).toBe(true);
    expect(debugEnabled("inbox")).toBe(false);
  });

  it("allows everything for the wildcard", () => {
    saveDebugScopes(["*"]);
    expect(debugEnabled("anything")).toBe(true);
    expect(debugEnabled("")).toBe(true);
  });

  it("treats a blank list as off, not as a wildcard", () => {
    localStorage.setItem("monocode.debug", "  ,  ");
    expect(debugEnabled("harness")).toBe(false);
  });
});

describe("loadDebugScopesRaw", () => {
  it("is referentially stable, so useSyncExternalStore can compare it", () => {
    saveDebugScopes(["harness"]);
    // A parsed array here would hand the store a new reference on every read
    // and re-render forever; the raw string is a primitive.
    expect(loadDebugScopesRaw()).toBe(loadDebugScopesRaw());
  });

  it("returns empty string when storage throws", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(loadDebugScopesRaw()).toBe("");
    getItem.mockRestore();
  });
});

describe("DEBUG_SCOPES_CHANGE_EVENT", () => {
  it("is namespaced like the other settings events", () => {
    expect(DEBUG_SCOPES_CHANGE_EVENT).toBe("monocode:debug-scopes-change");
  });
});
