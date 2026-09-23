// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  activateSessionDraft,
  discardPendingDraft,
  discardSessionDraft,
  flushSessionDraft,
  getLiveDraft,
  loadSessionDraft,
  saveSessionDraft,
  setLiveDraft,
} from "./composerDraft";

describe("composerDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invoke.mockReset();
    // Persists propagate invoke rejections (the timer path logs them, the
    // explicit-flush path rejects), so the default mock must resolve
    // (Once-stubs registered per test still take priority).
    invoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    discardPendingDraft();
    vi.useRealTimers();
  });

  it("collapses rapid saves into one debounced invoke", async () => {
    saveSessionDraft("s-1", "a");
    saveSessionDraft("s-1", "ab");
    saveSessionDraft("s-1", "abc");
    expect(invoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-1",
      text: "abc",
    });
  });

  it("persists sessions independently in split view", async () => {
    saveSessionDraft("s-a", "draft for A");
    saveSessionDraft("s-b", "draft for B");
    await vi.advanceTimersByTimeAsync(600);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-a",
      text: "draft for A",
    });
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-b",
      text: "draft for B",
    });
  });

  it("a second pane's save does not clobber the first session's pending draft", async () => {
    saveSessionDraft("s-a", "A text");
    saveSessionDraft("s-b", "B text");
    await flushSessionDraft();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-a",
      text: "A text",
    });
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-b",
      text: "B text",
    });
  });

  it("flushes immediately on flushSessionDraft", async () => {
    saveSessionDraft("s-2", "pending text");
    await flushSessionDraft();
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "s-2",
      text: "pending text",
    });
  });

  it("discardPendingDraft drops the pending write", () => {
    saveSessionDraft("s-3", "never saved");
    discardPendingDraft();
    vi.advanceTimersByTime(10_000);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("flushSessionDraft rejects on write failure and keeps the draft for retry", async () => {
    invoke.mockRejectedValueOnce(new Error("db locked"));
    saveSessionDraft("s-4", "text");
    await expect(flushSessionDraft()).rejects.toThrow("db locked");
    await flushSessionDraft();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(2, "composer_draft_set", {
      sessionId: "s-4",
      text: "text",
    });
  });

  it("an older write finishing late does not drop newer text", async () => {
    saveSessionDraft("s-5", "old");
    const first = flushSessionDraft();
    saveSessionDraft("s-5", "new");
    await first;
    await flushSessionDraft();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, "composer_draft_set", {
      sessionId: "s-5",
      text: "old",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "composer_draft_set", {
      sessionId: "s-5",
      text: "new",
    });
  });

  it("loads a draft and treats failures or malformed values as empty", async () => {
    invoke.mockResolvedValueOnce("restored draft");
    await expect(loadSessionDraft("s-5")).resolves.toBe("restored draft");
    invoke.mockResolvedValueOnce([]);
    await expect(loadSessionDraft("s-6")).resolves.toBe("");
    invoke.mockRejectedValueOnce(new Error("missing table"));
    await expect(loadSessionDraft("s-7")).resolves.toBe("");
  });

  it("live draft answers back without a backend round-trip", () => {
    expect(getLiveDraft("live-never")).toBeUndefined();
    setLiveDraft("live-1", "half-typed message");
    expect(getLiveDraft("live-1")).toBe("half-typed message");
  });

  it("live draft keeps sessions apart and holds the empty marker", async () => {
    setLiveDraft("live-a", "draft A");
    setLiveDraft("live-b", "draft B");
    expect(getLiveDraft("live-a")).toBe("draft A");
    setLiveDraft("live-a", "");
    expect(getLiveDraft("live-a")).toBe("");
    expect(getLiveDraft("live-b")).toBe("draft B");
    saveSessionDraft("live-a", "");
    await vi.advanceTimersByTimeAsync(600);
    expect(getLiveDraft("live-a")).toBeUndefined();
    setLiveDraft("live-b", "");
  });

  it("drains a newer revision created during an in-flight flush", async () => {
    let resolveFirst!: () => void;
    invoke.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    saveSessionDraft("s-6", "first");
    const flushing = flushSessionDraft();
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
        sessionId: "s-6",
        text: "first",
      }),
    );
    saveSessionDraft("s-6", "second");
    resolveFirst();
    await flushing;
    expect(invoke).toHaveBeenNthCalledWith(2, "composer_draft_set", {
      sessionId: "s-6",
      text: "second",
    });
  });

  it("discards one session without dropping another pending draft", async () => {
    saveSessionDraft("delete-me", "stale");
    saveSessionDraft("keep-me", "keep");
    await discardSessionDraft("delete-me");
    await flushSessionDraft();
    expect(invoke).not.toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "delete-me",
      text: "stale",
    });
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "keep-me",
      text: "keep",
    });
    saveSessionDraft("delete-me", "late");
    await flushSessionDraft();
    expect(invoke).not.toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "delete-me",
      text: "late",
    });
    activateSessionDraft("delete-me");
    saveSessionDraft("delete-me", "reused");
    await flushSessionDraft();
    expect(invoke).toHaveBeenCalledWith("composer_draft_set", {
      sessionId: "delete-me",
      text: "reused",
    });
  });
});
