// @vitest-environment happy-dom
import { act, createElement, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  isTauri: () => false,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("../app/workspaceEvents", () => ({
  nudgeWorkspace: vi.fn(),
  scheduleNudge: vi.fn(),
}));
vi.mock("../lib/harness/registry", async (original) => ({
  ...((await original()) as object),
  canCompactHarnessContext: () => true,
  compactHarnessContext: (...args: unknown[]) => mockCompact(...args),
}));

import type { HarnessEvent } from "../lib/harness";
import type { Session } from "../lib/session";
import { useTurnActions, type TurnActionsDeps } from "./useTurnActions";

const mockCompact = vi.fn(
  async (): Promise<void> => undefined,
);

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    harness: "opencode",
    model: "test-model",
    modelSettings: {},
    title: "Test",
    cwd: "/repo",
    blocks: [],
    busy: false,
    ...overrides,
  } as unknown as Session;
}

function makeDeps(session: Session): {
  deps: TurnActionsDeps;
  events: HarnessEvent[];
  sessionsRef: MutableRefObject<Session[]>;
  setSessions: ReturnType<typeof vi.fn>;
  onTurnInvalidated: ReturnType<typeof vi.fn>;
} {
  const sessionsRef: MutableRefObject<Session[]> = { current: [session] };
  const events: HarnessEvent[] = [];
  const setSessions = vi.fn(
    (action: React.SetStateAction<Session[]>) => {
      sessionsRef.current =
        typeof action === "function"
          ? (action as (prev: Session[]) => Session[])(sessionsRef.current)
          : action;
    },
  );
  const onTurnInvalidated = vi.fn();
  const noop = () => {};
  const deps: TurnActionsDeps = {
    sessions: [session],
    tabs: [],
    activeTabId: "t1",
    active: session,
    sessionsRef,
    tabsRef: { current: [] },
    activeTabIdRef: { current: "t1" },
    queueDispatchingRef: { current: new Set<string>() },
    turnGen: { current: new Map<string, number>() },
    orchestrationRuns: [],
    setSessions,
    setTabs: noop as never,
    setActiveTabId: noop as never,
    setComposerFocused: noop as never,
    setInspectedWorkerId: noop as never,
    setProjectTerminalFocused: noop as never,
    enqueueHarnessEvent: (id: string, event: HarnessEvent) => {
      events.push(event);
      void id;
    },
    flushHarnessEvents: noop,
    onSubmit: (() => false) as never,
    onTurnInvalidated,
    focusOpenSession: () => false,
    appendTab: noop as never,
    projectTerminalFocusedRef: { current: false },
    onSelectHistorySession: async () => {},
    ensureOpenSession: async () => null,
  };
  return { deps, events, sessionsRef, setSessions, onTurnInvalidated };
}

function Probe({ api }: { api: { current: unknown } }) {
  api.current = useTurnActions(
    (globalThis as { __deps?: TurnActionsDeps }).__deps!,
  );
  return null;
}

let container: HTMLDivElement;
let root: Root;
let api: { current: ReturnType<typeof useTurnActions> | unknown };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mockCompact.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api = { current: null };
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  delete (globalThis as { __deps?: unknown }).__deps;
});

function mount(session: Session) {
  const built = makeDeps(session);
  (globalThis as { __deps?: TurnActionsDeps }).__deps = built.deps;
  act(() => {
    root.render(createElement(Probe, { api }));
  });
  return built;
}

describe("manual context compaction", () => {
  it("hides the meter while compacting and leaves it hidden on success", async () => {
    const session = makeSession({
      context: { used: 150_000, window: 200_000 },
    });
    const { sessionsRef, events, onTurnInvalidated } = mount(session);

    let started: unknown;
    act(() => {
      started = (
        api.current as ReturnType<typeof useTurnActions>
      ).onCompactContext("s1");
    });
    expect(started).toBe(true);
    expect(onTurnInvalidated).toHaveBeenCalledWith("s1");
    // Level unknown mid-flight: busy, meter cleared, status announced. The
    // start status folds straight into the transcript blocks (it is not an
    // enqueued harness event).
    expect(sessionsRef.current[0].busy).toBe(true);
    expect(sessionsRef.current[0].context).toBeUndefined();
    expect(
      sessionsRef.current[0].blocks.some(
        (block) => block.text === "Compacting context…",
      ),
    ).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCompact).toHaveBeenCalledOnce();
    expect(events).toContainEqual({
      type: "status",
      text: "Compacted context",
    });
    expect(sessionsRef.current[0].busy).toBe(false);
    // No fresh reading arrived: the stale pre-compaction level stays hidden
    // until the next turn reports.
    expect(sessionsRef.current[0].context).toBeUndefined();
  });

  it("restores the meter when compaction fails", async () => {
    mockCompact.mockRejectedValueOnce(new Error("boom"));
    const session = makeSession({
      context: { used: 150_000, window: 200_000 },
    });
    const { sessionsRef, events, onTurnInvalidated } = mount(session);

    act(() => {
      (
        api.current as ReturnType<typeof useTurnActions>
      ).onCompactContext("s1");
    });
    expect(sessionsRef.current[0].context).toBeUndefined();

    await act(async () => {
      await Promise.resolve();
    });
    expect(sessionsRef.current[0].busy).toBe(false);
    expect(sessionsRef.current[0].context).toEqual({
      used: 150_000,
      window: 200_000,
    });
    expect(events).toContainEqual({
      type: "session.error",
      message: "boom",
    });
    expect(onTurnInvalidated).toHaveBeenCalledWith("s1");
  });

  it("invalidates next steps when stopping a turn", async () => {
    const { onTurnInvalidated } = mount(makeSession());

    await act(async () => {
      await (api.current as ReturnType<typeof useTurnActions>).onStop("s1");
    });

    expect(onTurnInvalidated).toHaveBeenCalledWith("s1");
  });
});
