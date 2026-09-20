import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMcodeTurn, stopMcodeSession } from "./mcode";
import type { HarnessEvent } from "./types";

const sent: string[] = [];
let onLine: ((line: string) => void) | undefined;

vi.mock("./child", () => ({
  resolveMcodeBinary: async () => ({ path: "/fake/mcode" }),
  spawnChild: async () => undefined,
  killChild: async () => undefined,
  unwatchChild: () => undefined,
  watchChild: (
    _id: string,
    line: (l: string) => void,
    _exit: (c: number | null) => void,
  ) => {
    onLine = line;
  },
  writeChild: async (_id: string, line: string) => {
    sent.push(line);
  },
}));

function reply(id: number, result: unknown) {
  onLine!(JSON.stringify({ jsonrpc: "2.0", id, result }));
}
const parse = () => sent.map((s) => JSON.parse(s));
const waitFor = async (pred: () => boolean, label: string) => {
  for (let i = 0; i < 200; i++) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`timed out waiting for ${label}`);
};

async function handshake() {
  await waitFor(
    () => parse().some((m) => m.method === "initialize"),
    "initialize",
  );
  reply(parse().find((m) => m.method === "initialize")!.id, {
    protocolVersion: 1,
  });
  await waitFor(
    () => parse().some((m) => m.method === "session/new"),
    "session/new",
  );
  reply(parse().find((m) => m.method === "session/new")!.id, {
    sessionId: "S1",
    configOptions: [{ id: "model", currentValue: "MiniMax-M2" }],
    models: { currentModelId: "MiniMax-M2", availableModels: [] },
  });
}

describe("mcode live turn sequence", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("opens a session, sets the mode, and prompts", async () => {
    const events: HarnessEvent[] = [];
    const turn = sendMcodeTurn({
      sessionId: "t1",
      cwd: "/repo",
      model: "mcode:MiniMax-M2",
      modelSettings: {},
      runtimeMode: "supervised",
      text: "hey",
      attachments: [],
      onEvent: (e) => events.push(e),
    });
    await handshake();
    await waitFor(
      () => parse().some((m) => m.method === "session/set_mode"),
      "set_mode",
    );
    reply(parse().find((m) => m.method === "session/set_mode")!.id, {});
    await waitFor(
      () => parse().some((m) => m.method === "session/prompt"),
      "prompt",
    );
    const promptRequest = parse().find((m) => m.method === "session/prompt")!;
    expect(promptRequest.params.prompt).toEqual([
      { type: "text", text: "hey" },
    ]);
    reply(promptRequest.id, { stopReason: "end_turn" });
    await turn;
    expect(events.some((e) => e.type === "session.providerBound")).toBe(true);
    expect(
      events.some((e) => e.type === "message.completed"),
    ).toBe(true);
    await stopMcodeSession("t1");
  });
});
