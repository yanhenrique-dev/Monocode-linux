import { describe, expect, it } from "vitest";
import { searchTranscriptBlocks } from "./transcriptSearch";
import type { Block } from "./session";

const blocks: Block[] = [
  { id: "u1", role: "user", text: "How do I reset the cache?" },
  {
    id: "t1",
    role: "tool",
    text: "rm -rf cache",
    tool: { kind: "shell", status: "completed", title: "Clear cache dir" },
  },
  { id: "a1", role: "assistant", text: "Cache cleared successfully." },
  { id: "s1", role: "system", text: "Cache notice" },
];

describe("searchTranscriptBlocks", () => {
  it("matches user, assistant and tool text case-insensitively", () => {
    const hits = searchTranscriptBlocks(blocks, "cache");
    expect(hits.map((hit) => hit.blockId)).toEqual(["u1", "t1", "a1"]);
  });

  it("matches tool titles", () => {
    const hits = searchTranscriptBlocks(blocks, "clear cache dir");
    expect(hits.map((hit) => hit.blockId)).toEqual(["t1"]);
  });

  it("skips system blocks and empty queries", () => {
    expect(searchTranscriptBlocks(blocks, "notice")).toEqual([]);
    expect(searchTranscriptBlocks(blocks, "   ")).toEqual([]);
    expect(searchTranscriptBlocks(blocks, "missing")).toEqual([]);
  });

  it("trims excerpts to one line", () => {
    const hits = searchTranscriptBlocks(blocks, "reset");
    expect(hits).toEqual([
      { blockId: "u1", role: "user", excerpt: "reset the cache?" },
    ]);
  });
});
