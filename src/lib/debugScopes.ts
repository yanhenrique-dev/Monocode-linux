/**
 * One debug gate for the whole app.
 *
 * There used to be two, and neither knew about the other: `monocode.debug`
 * held a comma-separated scope list for `logDebug`, and `monocode:debug` was
 * a plain "1" for `debugLog`. Turning one on did nothing for the other, and
 * neither was reachable from the UI. This module is the single gate both
 * consume, so the experimental settings can offer one honest switch.
 *
 * The value is a comma-separated scope list, or `*` for everything -- the
 * format `logger.ts` already used, kept so existing values keep working.
 *
 * `loadDebugScopesRaw` is the store snapshot and returns a primitive on
 * purpose. Returning a parsed array would hand `useSyncExternalStore` a fresh
 * reference on every read, and since it compares snapshots with `Object.is`
 * that renders forever.
 */

const DEBUG_KEY = "monocode.debug";

export const DEBUG_SCOPES_DEFAULT = "*";
export const DEBUG_SCOPES_CHANGE_EVENT = "monocode:debug-scopes-change";

/** The stored list, verbatim. Empty string means debug is off. */
export function loadDebugScopesRaw(): string {
  try {
    return window.localStorage.getItem(DEBUG_KEY) ?? "";
  } catch {
    // Storage can throw: denied cookies, sandbox, private mode. Debug being
    // unreachable is not worth breaking a call site over.
    return "";
  }
}

/** Splits the stored list. Null when nothing is allowed. */
export function parseDebugScopes(raw: string): string[] | null {
  const scopes = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : null;
}

export function saveDebugScopes(scopes: readonly string[]): void {
  try {
    const value = scopes
      .map((scope) => scope.trim())
      .filter(Boolean)
      .join(",");
    window.localStorage.setItem(DEBUG_KEY, value);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(DEBUG_SCOPES_CHANGE_EVENT));
}

export function subscribeDebugScopes(onStoreChange: () => void): () => void {
  window.addEventListener(DEBUG_SCOPES_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(DEBUG_SCOPES_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** `*` is the wildcard. */
export function debugEnabled(scope: string): boolean {
  // SSR/tests without localStorage: keep debug visible, tests assert nothing.
  if (typeof window === "undefined") return true;
  const scopes = parseDebugScopes(loadDebugScopesRaw());
  if (!scopes) return false;
  return scopes.includes("*") || scopes.includes(scope);
}
