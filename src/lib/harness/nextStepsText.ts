import {
  buildNextStepsPrompt,
  parseNextStepSuggestions,
  transcriptTail,
  type NextStepSuggestion,
} from "../nextStepsPrompt";
import { runClaudeTextPrompt } from "./claudeText";
import { runCodexTextPrompt } from "./codexText";
import { runCursorTextPrompt } from "./cursorText";
import { runGrokTextPrompt } from "./grokText";
import { runOpenCodeTextPrompt } from "./opencodeText";
import { PI_FLAVOR, OMP_FLAVOR, type PiFlavor } from "./piFlavor";
import { runTextPrompt as runPiTextPrompt } from "./piText";
import type { HarnessId } from "../session";

/**
 * Suggest follow-ups for the turn that just finished.
 *
 * This is a short side-channel call on the same cheap text model the sidebar
 * title uses, not on the session's model: a title costs a few hundred tokens
 * on haiku, and doing that per turn would be noise next to the agent run that
 * just happened. The session's own model, plan, and tools are untouched.
 *
 * Failure is silent by design. A timeout, a missing binary, or an unparseable
 * answer returns null and the caller keeps the static shortcuts. Nothing here
 * ever surfaces an error to the user, and nothing blocks the turn that
 * already finished.
 */

const TIMEOUT_MS = 20_000;

type TextRunner = (input: {
  cwd: string;
  providerAccountId?: string;
  prompt: string;
  timeoutMs: number;
}) => Promise<string>;

/**
 * The runners are not uniform: cursor, opencode and grok take no
 * providerAccountId and require an explicit timeout; pi takes a flavor before
 * the input. Each entry adapts to the single shape above.
 */
const RUNNERS: Partial<Record<HarnessId, TextRunner>> = {
  claude: (input) => runClaudeTextPrompt(input),
  codex: (input) => runCodexTextPrompt(input),
  cursor: ({ cwd, prompt, timeoutMs }) =>
    runCursorTextPrompt({ cwd, prompt, timeoutMs }),
  grok: ({ cwd, prompt, timeoutMs }) =>
    runGrokTextPrompt({ cwd, prompt, timeoutMs }),
  opencode: ({ cwd, prompt, timeoutMs }) =>
    runOpenCodeTextPrompt({ cwd, prompt, timeoutMs }),
  pi: piRunner(PI_FLAVOR),
  omp: piRunner(OMP_FLAVOR),
};

function piRunner(flavor: PiFlavor): TextRunner {
  return ({ cwd, prompt, timeoutMs }) =>
    runPiTextPrompt(flavor, { cwd, prompt, timeoutMs });
}

export function supportsNextSteps(harness: HarnessId): boolean {
  return harness in RUNNERS;
}

export async function generateNextStepSuggestions(input: {
  harness: HarnessId;
  cwd: string;
  /** The tail of the conversation, most recent last. */
  transcript: string;
  providerAccountId?: string;
}): Promise<NextStepSuggestion[] | null> {
  const run = RUNNERS[input.harness];
  if (!run) return null;
  try {
    const output = await run({
      cwd: input.cwd,
      providerAccountId: input.providerAccountId,
      prompt: buildNextStepsPrompt(input.transcript),
      timeoutMs: TIMEOUT_MS,
    });
    return parseNextStepSuggestions(output);
  } catch (error) {
    console.debug("[monocode] next-step suggestions", error);
    return null;
  }
}

/**
 * Suggestions for a turn that just finished, guarded so a slow answer can
 * never land against the wrong turn.
 *
 * The key is session plus generation, so a superseded answer is recognised and
 * dropped, and a turn that somehow settles twice only spends one call. A
 * failure commits nothing: the caller keeps the static shortcuts, and nothing
 * is surfaced to the user.
 */
const requested = new Set<string>();

export function nextStepSuggestionKey(
  sessionId: string,
  generation: number,
): string {
  return `${sessionId}:${generation}`;
}

export async function requestNextStepSuggestions(input: {
  sessionId: string;
  generation: number;
  harness: HarnessId;
  cwd: string;
  providerAccountId?: string;
  blocks: readonly { role: string; text: string }[];
  commit: (key: string, suggestions: NextStepSuggestion[]) => void;
}): Promise<void> {
  const key = nextStepSuggestionKey(input.sessionId, input.generation);
  if (requested.has(key)) return;
  if (!supportsNextSteps(input.harness)) return;
  requested.add(key);

  const suggestions = await generateNextStepSuggestions({
    harness: input.harness,
    cwd: input.cwd,
    transcript: transcriptTail(input.blocks),
    providerAccountId: input.providerAccountId,
  });
  if (suggestions) input.commit(key, suggestions);
}

/** Test seam: the guard is module state, not per-session. */
export function resetNextStepSuggestionGuard(): void {
  requested.clear();
}
