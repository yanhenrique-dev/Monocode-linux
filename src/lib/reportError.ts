import { debugEnabled } from "./debugScopes";

export const ERROR_EVENT = "monocode-error";

export type ErrorReport = {
  scope: string;
  message: string;
};

/** Human-readable message for any thrown value. Never throws: values
 * without a primitive conversion (e.g. `Object.create(null)`) fall back
 * to a safe message instead of raising inside the reporter. */
export function errorMessage(error: unknown): string {
  try {
    if (error instanceof Error) return error.message || error.name;
    return String(error);
  } catch {
    return "Unknown error";
  }
}

/**
 * DEV-only or opt-in debug log.
 *
 * `import.meta.env.DEV` still short-circuits for local work. The opt-in path
 * is the shared `monocode.debug` scope list, the same gate `logDebug` uses --
 * it used to be a second, unrelated key (`monocode:debug=1`) that setting
 * either one never affected the other.
 */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (import.meta.env.DEV || debugEnabled(scope)) {
    console.debug(`[monocode:${scope}]`, ...args);
  }
}

/**
 * Single funnel for background failures that previously vanished into
 * `.catch(console.error)`. Always logs with a scope prefix and emits a
 * window event so a toast/telemetry listener can surface it without
 * coupling every caller to UI state.
 */
export function reportError(scope: string, error: unknown): void {
  const message = errorMessage(error);
  console.error(`[monocode:${scope}]`, error);
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent<ErrorReport>(ERROR_EVENT, {
          detail: { scope, message },
        }),
      );
    }
  } catch {
    // Reporting must never throw: the log line above already preserved it.
  }
}

/** Curried `.catch()` handler: `.catch(reportRejection("turn-stop"))`. */
export function reportRejection(scope: string): (reason: unknown) => void {
  return (reason: unknown) => reportError(scope, reason);
}
