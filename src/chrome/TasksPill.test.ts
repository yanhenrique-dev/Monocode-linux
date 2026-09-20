// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../lib/session";
import { TasksPill } from "./TasksPill";

let observerCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setIntersecting(value: boolean) {
  act(() =>
    observerCallback?.(
      [{ isIntersecting: value } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
}

function taskBlock(id: string): Block {
  return {
    id,
    role: "tasks",
    text: "",
    taskList: {
      items: [
        { text: "Done", status: "completed" },
        { text: "Doing", status: "in_progress" },
        { text: "Todo", status: "pending" },
      ],
    },
  } as Block;
}

describe("TasksPill", () => {
  let container: HTMLDivElement;
  let cleanup: () => void;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    observerCallback = null;
    container = document.createElement("div");
    container.innerHTML =
      '<div class="agent-transcript"><div data-task-anchor="t1"></div></div>';
    document.body.append(container);
    cleanup = () => {
      container.remove();
      vi.unstubAllGlobals();
    };
  });

  afterEach(() => cleanup());

  function renderPill(props?: {
    enabled?: boolean;
    blocks?: readonly Block[];
  }) {
    const revealBlock = vi.fn(() => true);
    const mount = document.createElement("div");
    container.append(mount);
    const root = createRoot(mount);
    const scope = { current: container };
    act(() =>
      root.render(
        createElement(TasksPill, {
          blocks: props?.blocks ?? [taskBlock("t1")],
          scope,
          enabled: props?.enabled ?? true,
          revealBlock,
        }),
      ),
    );
    return { root, revealBlock };
  }

  it("stays hidden while the task card is visible", () => {
    const { root } = renderPill();
    try {
      setIntersecting(true);
      expect(
        container.querySelector("[data-tasks-pill]"),
      ).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });

  it("shows progress and reveals the list once scrolled out", () => {
    const { root, revealBlock } = renderPill();
    try {
      setIntersecting(false);
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      expect(pill.textContent).toContain("1 of 3");
      act(() => pill.click());
      expect(revealBlock).toHaveBeenCalledWith("t1");
    } finally {
      act(() => root.unmount());
    }
  });

  it("shows when the task turn is paginated out (no anchor mounted)", () => {
    container.innerHTML = '<div class="agent-transcript"></div>';
    const { root, revealBlock } = renderPill();
    try {
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      expect(pill.textContent).toContain("1 of 3");
      act(() => pill.click());
      expect(revealBlock).toHaveBeenCalledWith("t1");
    } finally {
      act(() => root.unmount());
    }
  });

  it("stays hidden when disabled or without tasks", () => {
    const first = renderPill({ enabled: false });
    try {
      setIntersecting(false);
      expect(
        container.querySelector("[data-tasks-pill]"),
      ).toBeNull();
    } finally {
      act(() => first.root.unmount());
    }
    const second = renderPill({ blocks: [] });
    try {
      setIntersecting(false);
      expect(
        container.querySelector("[data-tasks-pill]"),
      ).toBeNull();
    } finally {
      act(() => second.root.unmount());
    }
  });
});
