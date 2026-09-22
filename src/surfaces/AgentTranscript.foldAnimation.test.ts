// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../lib/session";
import { AgentTranscript } from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.useFakeTimers();
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

function tool(id: string): Block {
  return {
    id,
    role: "tool",
    text: `Inspect ${id}`,
    tool: { kind: "shell", status: "completed" },
  };
}

const blocks: Block[] = [
  { id: "user", role: "user", text: "Keep me posted" },
  tool("t1"),
  tool("t2"),
  {
    id: "answer",
    role: "assistant",
    text: "The investigation is complete.",
  },
];

function renderTranscript() {
  act(() => root.render(createElement(AgentTranscript, { blocks })));
}

function foldDetails(): Element | null {
  const items = container.querySelectorAll(".zen-fold-item");
  return (
    Array.from(items).find(
      (el) => el.querySelector(".zen-fold-rail") !== null,
    ) ?? null
  );
}

describe("work fold motion", () => {
  it("animates open and closed with experimental animations on", () => {
    localStorage.setItem("monocode.experimentalAnimations", "1");
    renderTranscript();

    expect(foldDetails()).toBeNull();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Show the work"]')!
        .click();
    });

    const opening = foldDetails()!;
    expect(opening.getAttribute("data-fold-state")).toBe("opening");
    expect(opening.getAttribute("data-fold-animated")).toBe("true");

    act(() => {
      opening.dispatchEvent(
        new AnimationEvent("animationend", { bubbles: true }),
      );
    });
    expect(foldDetails()!.getAttribute("data-fold-state")).toBe("open");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Hide the work"]')!
        .click();
    });
    const closing = foldDetails()!;
    expect(closing.getAttribute("data-fold-state")).toBe("closing");

    act(() => {
      closing.dispatchEvent(
        new AnimationEvent("animationend", { bubbles: true }),
      );
    });
    expect(foldDetails()).toBeNull();
  });

  it("settles shut when toggled mid-open", () => {
    localStorage.setItem("monocode.experimentalAnimations", "1");
    renderTranscript();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Show the work"]')!
        .click();
    });
    expect(foldDetails()!.getAttribute("data-fold-state")).toBe("opening");

    // Hide before the open animation ends: no animationend dispatched.
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Hide the work"]')!
        .click();
    });
    expect(foldDetails()!.getAttribute("data-fold-state")).toBe("closing");

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(foldDetails()).toBeNull();
  });

  it("snaps open and shut with experimental animations off", () => {
    localStorage.setItem("monocode.experimentalAnimations", "0");
    renderTranscript();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Show the work"]')!
        .click();
    });
    const opened = foldDetails()!;
    expect(opened.getAttribute("data-fold-state")).toBe("open");
    expect(opened.getAttribute("data-fold-animated")).toBe("false");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Hide the work"]')!
        .click();
    });
    expect(foldDetails()).toBeNull();
  });
});
