// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../lib/session";
import { AgentTranscript } from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;

/**
 * The engine sizes from offsetWidth/offsetHeight (not getBoundingClientRect):
 * measurable viewport (600px) with uniform 300px turns. Without this the
 * suite would exercise the zero-height fallback instead of the virtualizer.
 */

function pair(i: number): Block[] {
  return [
    { id: `user-${i}`, role: "user", text: `Prompt ${i}` },
    { id: `answer-${i}`, role: "assistant", text: `Answer ${i}` },
  ];
}

function manyTurns(n: number): Block[] {
  return Array.from({ length: n }, (_, i) => pair(i)).flat();
}

function turnCount(): number {
  return container.querySelectorAll(".transcript-turn").length;
}

function hasText(text: string): boolean {
  return container.textContent?.includes(text) ?? false;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList?.contains("agent-transcript")) return 600;
      return 300;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return 100;
    },
  );
  // Lets programmatic scrolls (scrollToEnd) stick: happy-dom clamps
  // scrollTop to scrollHeight - clientHeight, both zero without layout.
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList?.contains("agent-transcript")) return 9000;
      return 0;
    },
  );
  localStorage.setItem("monocode.experimentalAnimations", "1");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.removeItem("monocode.experimentalAnimations");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function scroller(): HTMLElement {
  return container.querySelector(".agent-transcript")!;
}

function renderTranscript(blocks: Block[], extra?: object) {
  act(() => {
    root.render(createElement(AgentTranscript, { blocks, ...extra }));
  });
  settle();
}

function settle() {
  // Flush the virtualizer's mount pass (measure + scrollToEnd reconcile).
  // happy-dom never fires scroll events on programmatic scrolls, so emit
  // one to emulate what a real browser does after scrollToEnd/scrollToIndex.
  act(() => {
    vi.advanceTimersByTime(500);
  });
  act(() => {
    scroller().dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  act(() => {
    vi.advanceTimersByTime(100);
  });
}

describe("transcript virtualization", () => {
  // 45 turns: above the VIRTUALIZE_MIN_TURNS gate (40) so the suite keeps
  // exercising the virtualized window instead of the native fallback.
  it("mounts only the visible window of a long session", () => {
    renderTranscript(manyTurns(45));
    const mounted = turnCount();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(45);
    // End-anchored: the latest reply is mounted, the first prompt is not.
    expect(hasText("Answer 44")).toBe(true);
    expect(hasText("Prompt 0")).toBe(false);
  });

  it("follows appended turns while pinned to the end", () => {
    const blocks = manyTurns(45);
    renderTranscript(blocks);
    expect(hasText("Answer 44")).toBe(true);
    act(() => {
      root.render(
        createElement(AgentTranscript, {
          blocks: [...blocks, ...pair(45)],
        }),
      );
    });
    settle();
    expect(hasText("Answer 45")).toBe(true);
  });

  it("revealBlock mounts a distant turn on demand", () => {
    let reveal: ((blockId: string) => boolean) | null = null;
    renderTranscript(manyTurns(45), {
      onRevealReady: (fn: (blockId: string) => boolean) => {
        reveal = fn;
      },
    });
    expect(hasText("Prompt 0")).toBe(false);
    let found = false;
    act(() => {
      found = reveal!("user-0");
    });
    settle();
    expect(found).toBe(true);
    expect(hasText("Prompt 0")).toBe(true);
  });

  it("returns false for unknown blocks", () => {
    let reveal: ((blockId: string) => boolean) | null = null;
    renderTranscript(manyTurns(5), {
      onRevealReady: (fn: (blockId: string) => boolean) => {
        reveal = fn;
      },
    });
    expect(reveal!("missing")).toBe(false);
  });

  it("opens a work fold without losing the virtualized window", () => {
    const blocks: Block[] = [
      { id: "user", role: "user", text: "Keep me posted" },
      {
        id: "t1",
        role: "tool",
        text: "Inspect t1",
        tool: { kind: "shell", status: "completed" },
      },
      {
        id: "t2",
        role: "tool",
        text: "Inspect t2",
        tool: { kind: "shell", status: "completed" },
      },
      {
        id: "answer",
        role: "assistant",
        text: "The investigation is complete.",
      },
    ];
    renderTranscript(blocks);
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Show the work"]')!
        .click();
    });
    // The fold line row is also a .zen-fold-item: the details hold the rail.
    const details = () =>
      Array.from(container.querySelectorAll(".zen-fold-item")).find(
        (el) => el.querySelector(".zen-fold-rail") !== null,
      );
    expect(details()?.getAttribute("data-fold-state")).toBe("opening");
    act(() => {
      details()!.dispatchEvent(
        new AnimationEvent("animationend", { bubbles: true }),
      );
    });
    expect(details()?.getAttribute("data-fold-state")).toBe("open");
    // The window still holds the latest answer after the fold remeasures.
    expect(hasText("The investigation is complete.")).toBe(true);
  });
});
