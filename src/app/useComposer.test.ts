// @vitest-environment happy-dom
// Characterization tests (remove-technical-debt Phase 1): pin the observed
// guard-clause contract of useComposer.onSubmit before any restructuring.
// These assert what the code DOES today, not what it should do.
import { act, createElement, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const asyncMocks = vi.hoisted(() => ({
  prepareAttachments: vi.fn(),
  preparePrompt: vi.fn(),
  steerHarnessTurn: vi.fn(),
}));

vi.mock("../lib/orchestration", () => ({
  orchestrator: {
    submissionError: vi.fn(),
    forSession: vi.fn(),
    run: vi.fn(),
    observe: vi.fn(),
    prompt: vi.fn((_sessionId: string, text: string) => text),
  },
}));

vi.mock("../lib/harness", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/harness")>();
  return {
    ...actual,
    isLiveHarness: () => true,
    canSteerHarness: () => true,
    steerHarnessTurn: asyncMocks.steerHarnessTurn,
    sendHarnessTurn: vi.fn(),
  };
});

vi.mock("../lib/attachments", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/attachments")>();
  return {
    ...actual,
    prepareAttachments: asyncMocks.prepareAttachments,
  };
});

vi.mock("../lib/promptPreparation", () => ({
  preparePrompt: asyncMocks.preparePrompt,
}));

import { orchestrator } from "../lib/orchestration";
import { sendHarnessTurn, type HarnessEvent } from "../lib/harness";
import type { Session } from "../lib/session";
import { useComposer, type ComposerDeps } from "./useComposer";

type ComposerApi = ReturnType<typeof useComposer>;

const submissionError = vi.mocked(orchestrator.submissionError);
const forSession = vi.mocked(orchestrator.forSession);

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    harness: "opencode",
    model: "test-model",
    modelSettings: {},
    title: "Test",
    cwd: "/repo",
    blocks: [],
    ...overrides,
  } as unknown as Session;
}

function makeDeps(
  sessions: Session[],
  overrides: Partial<ComposerDeps> = {},
): { deps: ComposerDeps; events: HarnessEvent[]; flushed: () => boolean } {
  const events: HarnessEvent[] = [];
  let flushed = false;
  const deps: ComposerDeps = {
    sessionsRef: { current: sessions },
    activeSessionIdRef: { current: "s1" },
    turnGen: { current: new Map<string, number>() },
    removingSessionIds: { current: new Set<string>() },
    setSessions: vi.fn(),
    enqueueHarnessEvent: vi.fn((_id: string, event: HarnessEvent) => {
      events.push(event);
    }),
    flushHarnessEvents: vi.fn(() => {
      flushed = true;
    }),
    dismissNoticesForContinuedSession: vi.fn(),
    ...overrides,
  };
  return { deps, events, flushed: () => flushed };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  submissionError.mockReturnValue(undefined);
  forSession.mockReturnValue(undefined);
  asyncMocks.prepareAttachments.mockResolvedValue([]);
  asyncMocks.preparePrompt.mockImplementation(async (text: string) => text);
  asyncMocks.steerHarnessTurn.mockResolvedValue(undefined);
  vi.mocked(sendHarnessTurn).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderApi(deps: ComposerDeps): MutableRefObject<ComposerApi | null> {
  const apiRef: MutableRefObject<ComposerApi | null> = { current: null };
  function Probe() {
    apiRef.current = useComposer(deps);
    return null;
  }
  act(() => {
    root.render(createElement(Probe));
  });
  return apiRef;
}

describe("useComposer.onSubmit guard clauses", () => {
  it("refuses the turn and surfaces the control error as a status event", () => {
    submissionError.mockReturnValue("orchestration is busy");
    const { deps, events, flushed } = makeDeps([makeSession()]);
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "hello");
    });

    expect(result).toBe(false);
    expect(events).toEqual([{ type: "status", text: "orchestration is busy" }]);
    expect(flushed()).toBe(true);
    expect(deps.flushHarnessEvents).toHaveBeenCalledTimes(1);
  });

  it("refuses unknown session ids without emitting events", () => {
    const { deps, events } = makeDeps([makeSession()]);
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("missing", "hello");
    });

    expect(result).toBe(false);
    expect(events).toEqual([]);
  });

  it("refuses sessions marked as removing", () => {
    const { deps, events } = makeDeps([makeSession()], {
      removingSessionIds: { current: new Set(["s1"]) },
    });
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "hello");
    });

    expect(result).toBe(false);
    expect(events).toEqual([]);
  });

  it("refuses empty text with no attachments and no cards", () => {
    const { deps } = makeDeps([makeSession()]);
    const api = renderApi(deps);

    expect(api.current!.onSubmit("s1", "   ")).toBe(false);
    expect(api.current!.onSubmit("s1", "", [])).toBe(false);
  });

  it("refuses while a handoff block is preparing", () => {
    const session = makeSession({
      blocks: [
        { role: "handoff", handoff: { status: "preparing" } },
      ] as unknown as Session["blocks"],
    });
    const { deps } = makeDeps([session]);
    const api = renderApi(deps);

    expect(api.current!.onSubmit("s1", "hello")).toBe(false);
  });

  it("refuses a build intent without an approved plan block", () => {
    const { deps } = makeDeps([makeSession()]);
    const api = renderApi(deps);

    expect(
      api.current!.onSubmit("s1", "build it", [], { intent: "build" }),
    ).toBe(false);
  });

  it("settles a managed submit on a busy session as failed", () => {
    const session = makeSession({ busy: true });
    const { deps } = makeDeps([session]);
    const api = renderApi(deps);
    const onSettled = vi.fn();

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "hello", [], {
        managed: true,
        onSettled,
      });
    });

    expect(result).toBe(false);
    expect(onSettled).toHaveBeenCalledWith({
      status: "failed",
      text: "",
      error: "Session is unavailable or already running",
    });
  });

  it("reports steered when a busy-session follow-up goes into the live turn", () => {
    const session = makeSession({ busy: true });
    const { deps } = makeDeps([session]);
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "nudge it", [], {
        followUpBehavior: "steer",
      });
    });

    expect(result).toBe("steered");
  });

  it("does not send a steer after its turn is stopped", async () => {
    let releaseAttachments!: (value: never[]) => void;
    asyncMocks.prepareAttachments.mockImplementationOnce(
      () => new Promise<never[]>((resolve) => {
        releaseAttachments = resolve;
      }),
    );
    const turnGen = new Map([["s1", 3]]);
    const { deps, events } = makeDeps([makeSession({ busy: true })], {
      turnGen: { current: turnGen },
    });
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "late nudge", [], {
        followUpBehavior: "steer",
      });
    });
    expect(result).toBe("steered");

    turnGen.set("s1", 4);
    await act(async () => {
      releaseAttachments([]);
      await Promise.resolve();
    });

    expect(asyncMocks.preparePrompt).not.toHaveBeenCalled();
    expect(asyncMocks.steerHarnessTurn).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("queues a busy-session follow-up when behavior is queue", () => {
    const session = makeSession({ busy: true });
    const { deps } = makeDeps([session]);
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "wait for me", [], {
        followUpBehavior: "queue",
      });
    });

    expect(result).toBe(true);
    const updater = vi.mocked(deps.setSessions).mock.calls[0][0] as (
      prev: Session[],
    ) => Session[];
    const next = updater([session]);
    expect(next[0].queuedMessages).toHaveLength(1);
    expect(next[0].queuedMessages![0].text).toBe("wait for me");
    expect(next[0].queueStatus).toBe("active");
  });

  it("refuses an orchestrate intent while a run is active", () => {
    forSession.mockReturnValue({ status: "active" } as never);
    const { deps, events, flushed } = makeDeps([makeSession()]);
    const api = renderApi(deps);

    let result: unknown;
    act(() => {
      result = api.current!.onSubmit("s1", "run it", [], {
        intent: "orchestrate",
      });
    });

    expect(result).toBe(false);
    expect(events).toEqual([
      {
        type: "status",
        text: "Stop the current orchestration run before preparing another proposal.",
      },
    ]);
    expect(flushed()).toBe(true);
  });

  it("collects provider failure text for central settlement", async () => {
    const session = makeSession({
      blocks: [
        { id: "user-1", role: "user", text: "previous" },
      ] as unknown as Session["blocks"],
    });
    const onTurnSettled = vi.fn();
    vi.mocked(sendHarnessTurn).mockImplementation(async ({ onEvent }) => {
      onEvent({
        type: "message.delta",
        text: "Upgrade your plan to continue",
      });
      onEvent({ type: "message.completed" });
    });
    const { deps } = makeDeps([session], { onTurnSettled });
    const api = renderApi(deps);

    act(() => {
      api.current!.onSubmit("s1", "hello");
    });

    await vi.waitFor(() => expect(onTurnSettled).toHaveBeenCalled());
    expect(sendHarnessTurn).toHaveBeenCalledOnce();
    expect(onTurnSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ status: "failed" }),
      }),
    );
  });
});
