/**
 * Shared UI timing constants (ms).
 *
 * Copy feedback, hover delays, and save debounce previously lived as magic
 * numbers scattered across surfaces/chrome (1500 vs 2000 for the same
 * "copied" flash). Import from here instead of inlining a literal.
 */

/** How long the "copied" / "saved" flash stays visible. */
export const COPY_FEEDBACK_MS = 1500;

/** Hover-intent delay for diff previews and submenu open. */
export const HOVER_DELAY_MS = 300;

/** Submenu close grace period on pointer leave. */
export const SUBMENU_CLOSE_DELAY_MS = 180;

/** “Reveal secret” flash in SettingsView. */
export const SECRET_REVEAL_MS = 1800;

/** Nudge flush delay for workspace events. */
export const WORKSPACE_NUDGE_MS = 150;

/** Splash removal delay on boot. */
export const SPLASH_REMOVE_MS = 180;

/**
 * Splash minimum display. The splash is dismissed on the first paint of the
 * app, so a fast boot would flash the logo for a couple of frames and read as
 * a glitch. Holding it this long reads as intentional instead.
 */
export const MIN_SPLASH_MS = 600;

/**
 * How long to keep holding the splash before fading it.
 *
 * Returns 0 as soon as the boot has already outlasted the minimum, so a slow
 * machine never pays the delay twice. A `shownAt` of 0 (no stamp) also
 * returns 0 rather than guessing: never hold the splash on a missing
 * measurement.
 */
export function splashFadeDelay(shownAt: number, now: number): number {
  if (!(shownAt > 0)) return 0;
  return Math.max(0, MIN_SPLASH_MS - Math.max(0, now - shownAt));
}

/** Watched-files invalidate delay after git changes. */
export const GIT_INVALIDATE_DELAY_MS = 150;

/** Draft persist debounce per session. */
export const DRAFT_FLUSH_DELAY_MS = 500;
