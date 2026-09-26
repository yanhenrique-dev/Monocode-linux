import { debugEnabled } from "./debugScopes";

/**
 * Leveled logger.
 *
 * `console.debug` calls scattered through notifications/harness emit noise
 * with no scope and no way to silence them. Route debug output through
 * `logDebug(scope, ...args)`; when debug is off, lines stay silent in
 * production and loud in DevTools only for the scopes the developer opts into
 * (`*` or a comma-separated scope list). The gate itself lives in
 * `debugScopes.ts` so `reportError` can share it.
 */

/** Scoped warning. Always emitted. */
export function logWarn(scope: string, ...args: unknown[]): void {
  console.warn(`[${scope}]`, ...args);
}

/** Scoped debug line. Silent unless debug scopes allow it. */
export function logDebug(scope: string, ...args: unknown[]): void {
  if (debugEnabled(scope)) console.debug(`[${scope}]`, ...args);
}
