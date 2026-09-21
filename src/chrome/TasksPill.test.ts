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
    animationsEnabled?: boolean;
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
          animationsEnabled: props?.animationsEnabled,
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

  it("renders the counter as plain text, not a pill badge", () => {
    const { root } = renderPill();
    try {
      setIntersecting(false);
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      const counter = [...pill.querySelectorAll("span")].find((span) =>
        (span.textContent ?? "").includes("1 of 3"),
      )!;
      expect(counter.className).not.toContain("rounded-full");
      expect(counter.className).not.toContain("bg-content");
    } finally {
      act(() => root.unmount());
    }
  });

  it("keeps the animated frame mounted and folds it with data-open", () => {
    const { root } = renderPill({ animationsEnabled: true });
    try {
      setIntersecting(true);
      expect(container.querySelector("[data-tasks-strip]")).toBeNull();
      const frame = container.querySelector(".fold-body")!;
      expect(frame.getAttribute("data-open")).toBe("false");
      setIntersecting(false);
      expect(
        container.querySelector("[data-tasks-strip]"),
      ).not.toBeNull();
      expect(
        container
          .querySelector(".fold-body")
          ?.getAttribute("data-open"),
      ).toBe("true");
    } finally {
      act(() => root.unmount());
    }
  });

  it("keeps the folded strip out of tab order when animated", () => {
    const { root } = renderPill({ animationsEnabled: true });
    try {
      setIntersecting(true);
      const frame = container.querySelector(".fold-body")!;
      expect(frame.hasAttribute("inert")).toBe(true);
      setIntersecting(false);
      expect(frame.hasAttribute("inert")).toBe(false);
    } finally {
      act(() => root.unmount());
    }
  });

  it("folds the settled strip instead of pinning it when animated", () => {
    const done = taskBlock("t1");
    done.taskList = {
      items: [
        { text: "Done", status: "completed" },
        { text: "Skipped", status: "cancelled" },
      ],
    };
    const { root } = renderPill({
      animationsEnabled: true,
      blocks: [done],
    });
    try {
      setIntersecting(false);
      expect(container.querySelector("[data-tasks-strip]")).toBeNull();
      expect(
        container
          .querySelector(".fold-body")
          ?.getAttribute("data-open"),
      ).toBe("false");
    } finally {
      act(() => root.unmount());
    }
  });

  it("renders as a strip fused to the composer, not a floating popup", () => {
    const { root } = renderPill();
    try {
      setIntersecting(false);
      const strip = container.querySelector("[data-tasks-strip]")!;
      expect(strip).not.toBeNull();
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      expect(pill.className).toContain("rounded-t-lg");
      expect(pill.className).not.toContain("rounded-full");
      expect(pill.parentElement).toBe(strip);
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

  it("scrolls to the anchor and hides on click", () => {
    const { root } = renderPill();
    try {
      setIntersecting(false);
      const anchor = container.querySelector<HTMLElement>(
        '[data-task-anchor="t1"]',
      )!;
      const scrollIntoView = vi.fn();
      anchor.scrollIntoView = scrollIntoView;
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      act(() => pill.click());
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
      expect(container.querySelector("[data-tasks-pill]")).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });

  it("scrolls to a freshly mounted anchor in the paginated case", () => {
    container.innerHTML = '<div class="agent-transcript"></div>';
    const revealBlock = vi.fn(() => {
      // revealBlock mounts synchronously: the anchor is in the DOM on return.
      container
        .querySelector(".agent-transcript")!
        .insertAdjacentHTML("beforeend", '<div data-task-anchor="t1"></div>');
      return true;
    });
    const mount = document.createElement("div");
    container.append(mount);
    const root = createRoot(mount);
    act(() =>
      root.render(
        createElement(TasksPill, {
          blocks: [taskBlock("t1")],
          scope: { current: container },
          enabled: true,
          revealBlock,
        }),
      ),
    );
    try {
      const pill = container.querySelector<HTMLButtonElement>(
        "[data-tasks-pill]",
      )!;
      const scrollIntoView = vi.fn();
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = scrollIntoView;
      try {
        act(() => pill.click());
      } finally {
        Element.prototype.scrollIntoView = original;
      }
      expect(revealBlock).toHaveBeenCalledWith("t1");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
      expect(container.querySelector("[data-tasks-pill]")).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });

  it("hides once every task settled, even when scrolled out", () => {
    const done: Block = {
      id: "t1",
      role: "tasks",
      text: "",
      taskList: {
        items: [
          { text: "Done", status: "completed" },
          { text: "Skipped", status: "cancelled" },
        ],
      },
    } as Block;
    const { root } = renderPill({ blocks: [done] });
    try {
      setIntersecting(false);
      expect(container.querySelector("[data-tasks-pill]")).toBeNull();
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
