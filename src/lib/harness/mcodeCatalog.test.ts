import { beforeEach, describe, expect, it, vi } from "vitest";
import { modelsFor, resetHarnessModelOverlays } from "../models";
import { refreshMcodeCatalog } from "./mcodeCatalog";

const lines = vi.hoisted(() => {
  let onLine: ((line: string) => void) | null = null;
  return {
    setOnLine(fn: (line: string) => void) {
      onLine = fn;
    },
    push(line: string) {
      onLine?.(line);
    },
  };
});

vi.mock("./child", () => ({
  resolveMcodeBinary: async () => ({ path: "/fake/mcode" }),
  spawnChild: async () => undefined,
  watchChild: (
    _id: string,
    onLine: (line: string) => void,
    _onExit: (code: number | null) => void,
  ) => {
    lines.setOnLine(onLine);
  },
  unwatchChild: () => undefined,
  killChild: async () => undefined,
  writeChild: async (_id: string, line: string) => {
    const request = JSON.parse(line) as { id: number; method: string };
    const result =
      request.method === "initialize"
        ? { protocolVersion: 1, agentCapabilities: {} }
        : request.method === "session/new"
          ? {
              sessionId: "s1",
              models: {
                currentModelId: "MiniMax-M2",
                availableModels: [
                  { modelId: "MiniMax-M2", name: "MiniMax M2" },
                  { modelId: "MiniMax-M2-Her", name: "Her" },
                ],
              },
            }
          : {};
    lines.push(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
  },
}));

vi.mock("../fs", async (importOriginal) => ({
  ...((await importOriginal<typeof import("../fs")>()) as object),
  homeDir: async () => "/home/test",
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetHarnessModelOverlays();
});

describe("mcode catalog discovery", () => {
  it("populates models from session/new with the current model first", async () => {
    await refreshMcodeCatalog();
    const models = modelsFor("mcode");
    expect(models.map((model) => model.id)).toEqual([
      "mcode:MiniMax-M2",
      "mcode:MiniMax-M2-Her",
    ]);
    expect(models[0]).toMatchObject({
      harness: "mcode",
      nativeId: "MiniMax-M2",
    });
  });
});
