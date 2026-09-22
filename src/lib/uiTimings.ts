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

/** Watched-files invalidate delay after git changes. */
export const GIT_INVALIDATE_DELAY_MS = 150;

/** Draft persist debounce per session. */
export const DRAFT_FLUSH_DELAY_MS = 500;
