import type { Block } from "./session";

export type TranscriptHit = {
  blockId: string;
  role: Block["role"];
  excerpt: string;
};

const MAX_HITS = 50;
const EXCERPT_CHARS = 120;

function excerptFor(text: string, needle: string): string {
  const lower = text.toLowerCase();
  const at = lower.indexOf(needle);
  const line = (
    at < 0 ? text.split(/\r?\n/, 1)[0] : text.slice(at).split(/\r?\n/, 1)[0]
  ).trim();
  return line.length > EXCERPT_CHARS
    ? `${line.slice(0, EXCERPT_CHARS - 1)}…`
    : line;
}

/**
 * In-transcript find: the virtualized list unmounts off-screen turns, so the
 * webview find cannot see them. Match user/assistant text and tool titles,
 * newest last; callers navigate with revealBlock.
 */
export function searchTranscriptBlocks(
  blocks: Block[],
  query: string,
  limit = MAX_HITS,
): TranscriptHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: TranscriptHit[] = [];
  for (const block of blocks) {
    if (hits.length >= limit) break;
    if (block.role !== "user" && block.role !== "assistant" && block.role !== "tool") {
      continue;
    }
    const haystacks = [block.text, block.tool?.title ?? ""];
    const index = haystacks.findIndex((text) =>
      text.toLowerCase().includes(needle),
    );
    if (index < 0) continue;
    hits.push({
      blockId: block.id,
      role: block.role,
      excerpt: excerptFor(haystacks[index], needle),
    });
  }
  return hits;
}
