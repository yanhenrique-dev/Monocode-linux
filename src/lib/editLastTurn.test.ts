import { describe, expect, it } from "vitest";
import {
  canEditLastTurn,
  harnessSupportsEditLastTurn,
  lastTurnRecall,
  lastUserTurnStartIndex,
  truncateBeforeLastUserTurn,
} from "./editLastTurn";
import type { Block, Session } from "./session";

function user(id: string, text: string, extra?: Partial<Block>): Block {
  return { id, role: "user", text, ...extra };
}

function session(blocks: Block[], extra?: Partial<Session>): Session {
  return {
    id: "s-1",
    cwd: "/workspace",
    harness: "opencode",
    title: "",
    blocks,
    busy: false,
    model: "",
    ...extra,
  };
}

describe("harnessSupportsEditLastTurn", () => {
  it("supports pi, omp, codex and opencode", () => {
    expect(harnessSupportsEditLastTurn("pi")).toBe(true);
    expect(harnessSupportsEditLastTurn("omp")).toBe(true);
    expect(harnessSupportsEditLastTurn("codex")).toBe(true);
    expect(harnessSupportsEditLastTurn("opencode")).toBe(true);
  });

  it("rejects other local harnesses", () => {
    expect(harnessSupportsEditLastTurn("claude")).toBe(false);
    expect(harnessSupportsEditLastTurn("cursor")).toBe(false);
  });
});

describe("lastUserTurnStartIndex", () => {
  it("skips internal orchestration turns", () => {
    const blocks = [
      user("u1", "first"),
      user("u2", "orchestrator ping", { internal: true }),
    ];
    expect(lastUserTurnStartIndex(blocks)).toBe(0);
  });

  it("returns -1 without user blocks", () => {
    expect(
      lastUserTurnStartIndex([{ id: "a", role: "assistant", text: "hi" }]),
    ).toBe(-1);
  });
});

describe("truncateBeforeLastUserTurn", () => {
  it("drops the latest user turn and everything after it", () => {
    const blocks = [
      user("u1", "first"),
      { id: "a1", role: "assistant", text: "answer" } as Block,
      user("u2", "second"),
    ];
    expect(truncateBeforeLastUserTurn(blocks).map((b) => b.id)).toEqual([
      "u1",
      "a1",
    ]);
  });
});

describe("lastTurnRecall", () => {
  it("returns text and attachments of the latest turn", () => {
    const attachments = [
      { id: "f", name: "a.ts", mimeType: "text/plain", kind: "file", size: 10 },
    ] as const;
    const recall = lastTurnRecall(
      session([user("u1", "hello", { attachments: [...attachments] })]),
    );
    expect(recall).toMatchObject({ text: "hello" });
    expect(recall?.attachments).toHaveLength(1);
  });

  it("returns null for empty turns", () => {
    expect(lastTurnRecall(session([user("u1", "  ")]))).toBeNull();
    expect(lastTurnRecall(session([]))).toBeNull();
  });
});

describe("canEditLastTurn", () => {
  it("allows idle opencode sessions with a last turn", () => {
    expect(canEditLastTurn(session([user("u1", "hi")]))).toBe(true);
  });

  it("blocks busy, queued and card turns", () => {
    expect(
      canEditLastTurn(session([user("u1", "hi")], { busy: true })),
    ).toBe(false);
    expect(
      canEditLastTurn(
        session([user("u1", "hi")], {
          queuedMessages: [
            { id: "q", text: "later", attachments: [] },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      canEditLastTurn(
        session([user("u1", "hi", { secondOpinion: { from: "claude", to: "codex" } })]),
      ),
    ).toBe(false);
  });

  it("requires a provider turn id for codex", () => {
    expect(
      canEditLastTurn(
        session([user("u1", "hi")], { harness: "codex", model: "" }),
      ),
    ).toBe(false);
    expect(
      canEditLastTurn(
        session([user("u1", "hi", { providerTurnId: "t-1" })], {
          harness: "codex",
          model: "",
        }),
      ),
    ).toBe(true);
  });
});
