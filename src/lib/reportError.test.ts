// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDebugScopes } from "./debugScopes";

import {
  ERROR_EVENT,
  debugLog,
  errorMessage,
  reportError,
  reportRejection,
  type ErrorReport,
} from "./reportError";

describe("reportError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefixes the scope and emits a window event", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: ErrorReport[] = [];
    const onError = (event: Event) =>
      seen.push((event as CustomEvent<ErrorReport>).detail);
    window.addEventListener(ERROR_EVENT, onError);

    reportError("turn-stop", new Error("boom"));

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toBe("[monocode:turn-stop]");
    expect(seen).toEqual([{ scope: "turn-stop", message: "boom" }]);
    window.removeEventListener(ERROR_EVENT, onError);
  });

  it("stringifies non-Error values without throwing", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportError("draft", "db locked")).not.toThrow();
    expect(errorMessage("db locked")).toBe("db locked");
    expect(errorMessage(undefined)).toBe("undefined");
    expect(errorMessage(Object.create(null))).toBe("Unknown error");
    expect(() => reportError("draft", Object.create(null))).not.toThrow();
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("reportRejection returns a catch-compatible handler", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await Promise.reject(new Error("nope")).catch(
      reportRejection("orchestration"),
    );
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toBe("[monocode:orchestration]");
  });

  it("debugLog prefixes the scope in dev/test", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    debugLog("harness", "quiet");
    expect(debugged).toHaveBeenCalledWith("[monocode:harness]", "quiet");
  });
});

describe("debugLog scope gate", () => {
  // import.meta.env.DEV is true under vitest and the source short-circuits on
  // it. Stub it off so the shared scope list is what decides.
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("stays silent with no scopes allowed", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    debugLog("turn-stop");
    expect(debugged).not.toHaveBeenCalled();
  });

  it("emits for a scope the shared list allows", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    saveDebugScopes(["turn-stop"]);
    debugLog("turn-stop");
    expect(debugged).toHaveBeenCalledWith("[monocode:turn-stop]");
  });

  it("stays silent for a scope the list does not allow", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    saveDebugScopes(["harness"]);
    debugLog("turn-stop");
    expect(debugged).not.toHaveBeenCalled();
  });

  // Regression: this used to read a second, unrelated key, so turning the
  // list on in Settings did nothing for reportError's own debug lines.
  it("no longer reads the retired monocode:debug flag", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    localStorage.setItem("monocode:debug", "1");
    debugLog("turn-stop");
    expect(debugged).not.toHaveBeenCalled();
  });
});
