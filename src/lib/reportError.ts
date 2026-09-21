export const ERROR_EVENT = "monocode-error";

export type ErrorReport = {
  scope: string;
  message: string;
};

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function debugEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("monocode:debug") === "1")
      return true;
  } catch {
    // Storage may be unavailable (private mode, SSR test); fall through.
  }
  return false;
}

/** DEV-only or opt-in debug log. No-op in production unless `monocode:debug=1`. */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (import.meta.env.DEV || debugEnabled()) {
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
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent<ErrorReport>(ERROR_EVENT, { detail: { scope, message } }),
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
