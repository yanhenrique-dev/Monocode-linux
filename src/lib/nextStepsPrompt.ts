import { extractJsonObject, limitSection } from "./jsonText";

/**
 * A suggested follow-up for the user, not a command MonoCode runs. The prompt
 * is placed in the composer for review; the user presses send.
 */
export type NextStepSuggestion = {
  /** Button text. Short: 2 to 5 words. */
  label: string;
  /** Prefilled into the composer. A complete request, not an instruction to the agent about itself. */
  prompt: string;
};

const TRANSCRIPT_LIMIT = 12_000;
const LABEL_LIMIT = 48;
const PROMPT_LIMIT = 400;
/** The bar wraps and gets noisy past this. */
const MAX_SUGGESTIONS = 3;

const NEXT_STEPS_PROMPT = `You are looking at the end of a coding session in which an AI agent just finished a turn. Suggest what the user would most plausibly ask next.

Return JSON only, with exactly one key: suggestions, an array of 2 or 3 objects with exactly two keys, label and prompt.

- label: button text, 2-5 words, no trailing punctuation.
- prompt: the full message to place in the composer's input for the user to review and send. Write it as the user speaking, in the user's own language. Do not wrap it in quotes.

Ground every suggestion in what actually happened. Prefer the next concrete step over a summary or a thank-you. A suggestion must be actionable right now, given this state.

Order them by how likely the user is to want them first.

If the turn accomplished everything, suggest what comes after shipping it: verifying the change, writing the test that was skipped, documenting the decision, checking a related path. Never invent work that has no basis here, and never suggest something already done in the transcript.

Do not call tools. Reply with JSON only.`;

export function buildNextStepsPrompt(transcript: string): string {
  return `${NEXT_STEPS_PROMPT}\n\nEnd of session:\n${limitSection(transcript, TRANSCRIPT_LIMIT)}`;
}

export function cleanLabel(raw: string): string {
  const normalized = raw
    .trim()
    .split(/\r?\n/g)[0]
    ?.trim()
    .replace(/^['"`*_#]+|['"`*_#]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (normalized.length <= LABEL_LIMIT) return normalized;
  return `${normalized.slice(0, LABEL_LIMIT - 3).trimEnd()}...`;
}

export function cleanPrompt(raw: string): string {
  const normalized = raw
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .trim();
  if (!normalized || /[{}]/.test(normalized)) return "";
  return normalized.length <= PROMPT_LIMIT
    ? normalized
    : `${normalized.slice(0, PROMPT_LIMIT - 3).trimEnd()}...`;
}

/**
 * Parse the model's answer. Anything unusable is dropped rather than thrown,
 * so a partial answer still yields a shorter bar. Returns null only when
 * nothing survives.
 */
export function parseNextStepSuggestions(
  raw: string,
): NextStepSuggestion[] | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const suggestions = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return null;

  const out: NextStepSuggestion[] = [];
  const seen = new Set<string>();
  for (const entry of suggestions) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const label = cleanLabel(typeof rec.label === "string" ? rec.label : "");
    const prompt = cleanPrompt(
      typeof rec.prompt === "string" ? rec.prompt : "",
    );
    if (!label || !prompt) continue;
    // Two buttons that send the same text are one button.
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, prompt });
  }
  return out.length > 0 ? out : null;
}

/**
 * The tail of a conversation as plain text, newest last. Only the last
 * `maxBlocks` blocks are worth sending: the suggestion is about what just
 * happened, not the whole session.
 */
export function transcriptTail(
  blocks: readonly { role: string; text: string }[],
  maxBlocks = 24,
): string {
  return blocks
    .slice(-maxBlocks)
    .map((block) => ({ role: block.role, text: block.text.trim() }))
    .filter((block) => block.text.length > 0)
    .map((block) => `${block.role}: ${block.text}`)
    .join("\n\n");
}
