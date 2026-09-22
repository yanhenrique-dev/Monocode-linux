/**
 * Leveled logger.
 *
 * `console.debug` calls scattered through notifications/harness emit noise
 * with no scope and no way to silence them. Route debug output through
 * `logDebug(scope, ...args)`; when `localStorage.monocode.debug` is unset,
 * debug lines stay silent in production and loud in DevTools only for the
 * scopes the developer opts into (`*` or comma-separated scope list).
 */

const DEBUG_KEY = "monocode.debug";

function debugScopes(): string[] | null {
  try {
    const raw = localStorage.getItem(DEBUG_KEY);
    if (!raw) return null;
    const scopes = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return scopes.length > 0 ? scopes : null;
  } catch {
    return null;
  }
}

function debugEnabled(scope: string): boolean {
  // SSR/tests without localStorage: keep debug visible, tests assert nothing.
  if (typeof localStorage === "undefined") return true;
  const scopes = debugScopes();
  if (!scopes) return false;
  return scopes.includes("*") || scopes.includes(scope);
}

/** Scoped debug line. Silent unless `localStorage.monocode.debug` allows it. */
export function logDebug(scope: string, ...args: unknown[]): void {
  if (debugEnabled(scope)) console.debug(`[${scope}]`, ...args);
}

/** Scoped warning. Always emitted. */
export function logWarn(scope: string, ...args: unknown[]): void {
  console.warn(`[${scope}]`, ...args);
}
