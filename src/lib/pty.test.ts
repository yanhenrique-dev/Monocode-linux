import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() =>
  vi.fn(
    async (
      _command: string,
      _args?: Record<string, unknown>,
    ): Promise<unknown> => undefined,
  ),
);
const listen = vi.hoisted(() =>
  vi.fn(
    async (
      _event: string,
      _handler: (event: { payload: unknown }) => void,
    ) => () => {},
  ),
);

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

import {
  decodePtyChunk,
  killAllPtys,
  killPty,
  spawnPty,
  subscribePty,
  trimReplay,
} from "./pty";

const KB = 1024;

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
});

afterEach(async () => {
  await killAllPtys();
});

function emitPtyData(id: string, data: string) {
  const handler = listen.mock.calls.find(([event]) => event === "pty-data")?.[1];
  if (!handler) throw new Error("pty-data listener not registered");
  handler({ payload: { id, data } });
}

function emitPtyExit(id: string, code: number | null) {
  const handler = listen.mock.calls.find(([event]) => event === "pty-exit")?.[1];
  if (!handler) throw new Error("pty-exit listener not registered");
  handler({ payload: { id, code } });
}

describe("trimReplay", () => {
  it("keeps a small buffer whole", () => {
    const sizes = [KB, KB, KB];
    expect(trimReplay(sizes, 3 * KB)).toEqual({ drop: 0, bytes: 3 * KB });
  });

  it("drops oldest chunks once the byte budget is exceeded", () => {
    // Ten 32KB chunks is 320KB, over the 256KB budget.
    const sizes = Array(10).fill(32 * KB);
    const { drop, bytes } = trimReplay(sizes, 320 * KB);
    expect(drop).toBe(2);
    expect(bytes).toBe(256 * KB);
  });

  it("bounds a flood of tiny chunks by count", () => {
    const sizes = Array(250).fill(4);
    const { drop } = trimReplay(sizes, 1000);
    expect(sizes.length - drop).toBe(200);
  });

  it("keeps the newest chunk even when it alone exceeds the budget", () => {
    const sizes = [KB, 512 * KB];
    const { drop, bytes } = trimReplay(sizes, 513 * KB);
    expect(drop).toBe(1);
    expect(bytes).toBe(512 * KB);
  });

  it("never drops the only chunk", () => {
    const sizes = [512 * KB];
    expect(trimReplay(sizes, 512 * KB)).toEqual({ drop: 0, bytes: 512 * KB });
  });
});

describe("decodePtyChunk", () => {
  it("decodes valid base64", () => {
    const chunk = decodePtyChunk(btoa("hello"));
    expect(chunk).not.toBeNull();
    expect(new TextDecoder().decode(chunk!)).toBe("hello");
  });

  it("drops malformed payloads instead of throwing", () => {
    expect(decodePtyChunk("!!!not-base64!!!")).toBeNull();
  });
});

describe("spawn failure cleanup", () => {
  it("clears current local state when pty_spawn rejects", async () => {
    invoke.mockRejectedValueOnce(new Error("spawn failed"));
    const onData = vi.fn();
    const unsubscribe = subscribePty("failed", onData, vi.fn());

    await expect(spawnPty("failed", "/tmp", 80, 24)).rejects.toThrow(
      "spawn failed",
    );
    emitPtyData("failed", btoa("handler"));
    unsubscribe();

    expect(onData).not.toHaveBeenCalled();
    emitPtyData("failed", btoa("stale"));
    const replacementData = vi.fn();
    const unsubscribeReplacement = subscribePty(
      "failed",
      replacementData,
      vi.fn(),
    );
    unsubscribeReplacement();

    expect(replacementData).not.toHaveBeenCalled();
  });

  it("preserves second-generation handlers when first spawn rejects", async () => {
    let spawnCount = 0;
    let rejectFirst: (error: Error) => void = () => {};
    invoke.mockImplementation((command: string) => {
      if (command !== "pty_spawn") return Promise.resolve(undefined);
      spawnCount += 1;
      if (spawnCount > 1) return Promise.resolve(undefined);
      return new Promise<undefined>((_, reject) => {
        rejectFirst = reject;
      });
    });

    const firstData = vi.fn();
    const unsubscribeFirst = subscribePty("shared", firstData, vi.fn());
    const firstSpawn = spawnPty("shared", "/tmp", 80, 24);
    const firstResult = firstSpawn.catch((error: unknown) => error);

    const secondData = vi.fn();
    const unsubscribeSecond = subscribePty("shared", secondData, vi.fn());
    await expect(spawnPty("shared", "/tmp", 80, 24)).resolves.toEqual(
      expect.any(String),
    );

    const firstError = new Error("first failed");
    rejectFirst(firstError);
    await expect(firstResult).resolves.toBe(firstError);
    unsubscribeFirst();

    emitPtyData("shared", btoa("replacement"));
    unsubscribeSecond();
    expect(firstData).not.toHaveBeenCalled();
    expect(secondData).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(secondData.mock.calls[0]![0])).toBe(
      "replacement",
    );
  });
});

describe("pty generation ownership", () => {
  it("preserves replacement state when first-generation kill is stale", async () => {
    const id = "stale-kill";
    const firstData = vi.fn();
    const firstExit = vi.fn();
    const unsubscribeFirst = subscribePty(id, firstData, firstExit);
    const firstGeneration = await spawnPty(id, "/tmp", 80, 24);

    const secondData = vi.fn();
    const secondExit = vi.fn();
    const unsubscribeSecond = subscribePty(id, secondData, secondExit);
    const secondGeneration = await spawnPty(id, "/tmp", 80, 24);
    expect(secondGeneration).not.toBe(firstGeneration);

    await killPty(id, firstGeneration);

    expect(invoke).toHaveBeenCalledWith("pty_kill", {
      id,
      generation: firstGeneration,
    });
    emitPtyData(id, btoa("second"));
    emitPtyExit(id, 0);
    expect(firstData).not.toHaveBeenCalled();
    expect(firstExit).not.toHaveBeenCalled();
    expect(secondData).toHaveBeenCalledOnce();
    expect(secondExit).toHaveBeenCalledWith(0);

    unsubscribeFirst();
    unsubscribeSecond();
    emitPtyData(id, btoa("detached"));
    const probeData = vi.fn();
    const unsubscribeProbe = subscribePty(id, probeData, vi.fn());
    expect(probeData).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(probeData.mock.calls[0]![0])).toBe(
      "detached",
    );
    unsubscribeProbe();
  });
});
