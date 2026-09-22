/**
 * Named truncation helpers.
 *
 * Slices like `text.slice(-200_000)` hide intent: is it a head or tail
 * cap, and why that size? Each call site now names the limit at the
 * declaration and calls the matching helper.
 */

/** Keep the last `maxChars` chars (streaming buffers). */
export function truncateTail(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  return text.length > maxChars ? text.slice(-maxChars) : text;
}

/** Keep the first `maxChars` chars (prompts, previews, titles). */
export function truncateHead(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** Streaming proposal buffer cap (useComposer). */
export const PROPOSAL_BUFFER_CHARS = 200_000;

/** Control-plane text buffer cap (useComposer, orchestration results). */
export const CONTROL_BUFFER_CHARS = 20_000;

/** Per-task result excerpt sent back to the lead. */
export const TASK_RESULT_EXCERPT_CHARS = 4_000;

/** Pending-question detail excerpt in orchestration summaries. */
export const PENDING_DETAIL_EXCERPT_CHARS = 2_000;

/** One-line user excerpt in handoff recaps. */
export const HANDOFF_USER_LINE_CHARS = 240;

/** Handoff brief / recap cap. */
export const HANDOFF_BRIEF_CHARS = 1_800;

/** Outgoing handoff prompt request cap. */
export const HANDOFF_REQUEST_CHARS = 1_500;

/** Assistant excerpt cap in deterministic handoffs. */
export const HANDOFF_ASSISTANT_CHARS = 500;

/** Plan / task excerpt cap in deterministic handoffs. */
export const HANDOFF_PLAN_CHARS = 400;

/** Git subject line cap (conventional ~72 cols). */
export const GIT_SUBJECT_CHARS = 72;

/** Harness stderr snippet cap (claude/codex/cursor/grok/opencode git). */
export const HARNESS_SNIPPET_CHARS = 240;
