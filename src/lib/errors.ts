/**
 * Central error reporting for fire-and-forget promise paths.
 *
 * `promise.catch(console.error)` swallows the scope: DevTools shows a bare
 * error with no hint which feature dropped it. `reportError` keeps the same
 * console output but prefixes the scope and optional context, and returns a
 * rejection handler so call sites stay one-liners:
 *
 *   void work(id).catch(reportError("SessionPane.hydrate", { sessionId: id }));
 */

export type ErrorContext = Record<string, unknown>;

/** Build a `.catch` handler that logs with scope + context. */
export function reportError(scope: string, context?: ErrorContext) {
  return (error: unknown): void => {
    if (context && Object.keys(context).length > 0) {
      console.error(`[${scope}]`, error, context);
    } else {
      console.error(`[${scope}]`, error);
    }
  };
}

/** Throw a scoped lookup failure (replaces `.find(...)!.field`). */
export function findOrThrow<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
  what: string,
): T {
  const found = items.find(predicate);
  if (!found) throw new Error(`${what} not found`);
  return found;
}

/** Narrow an `Event` to `KeyboardEvent` without an `as` cast. */
export function isKeyboardEvent(event: Event): event is KeyboardEvent {
  return (
    typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent
  );
}

/** Narrow an `Event` to `CustomEvent<T>` without an `as` cast. */
export function isCustomEvent<T>(event: Event): event is CustomEvent<T> {
  return (
    typeof CustomEvent !== "undefined" && event instanceof CustomEvent
  );
}

/**
 * Narrow an `unknown` element to an `HTMLDivElement` without an `as` cast.
 * CodeMirror's `view.scrollDOM` is typed as `HTMLElement`; overscroll lock
 * needs the div subtype.
 */
export function asHtmlDivElement(
  element: HTMLElement | null,
): HTMLDivElement | null {
  if (typeof HTMLDivElement === "undefined" || element == null) return null;
  return element instanceof HTMLDivElement ? element : null;
}
