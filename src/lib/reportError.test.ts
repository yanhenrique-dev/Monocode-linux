// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("reportRejection returns a catch-compatible handler", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await Promise.reject(new Error("nope")).catch(reportRejection("orchestration"));
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toBe("[monocode:orchestration]");
  });

  it("debugLog prefixes the scope in dev/test", () => {
    const debugged = vi.spyOn(console, "debug").mockImplementation(() => {});
    debugLog("harness", "quiet");
    expect(debugged).toHaveBeenCalledWith("[monocode:harness]", "quiet");
  });
});
