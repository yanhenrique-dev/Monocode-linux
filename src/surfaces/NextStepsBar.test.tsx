// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextStepsBar } from "./NextStepsBar";

function renderBar(actions: Array<"jump-to-bottom" | "search-transcript" | "review-changes">) {
  const callbacks = {
    onJumpToBottom: vi.fn(),
    onSearchTranscript: vi.fn(),
    onReviewChanges: vi.fn(),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(createElement(NextStepsBar, { actions, ...callbacks }));
  });
  return { container, root, callbacks };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("NextStepsBar", () => {
  it("renders the configured actions with accessible labels", () => {
    const { root, container } = renderBar([
      "jump-to-bottom",
      "search-transcript",
      "review-changes",
    ]);
    try {
      expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
      expect(
        container.querySelector('[data-next-step-action="jump-to-bottom"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-next-step-action="search-transcript"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-next-step-action="review-changes"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-next-step-action="jump-to-bottom"]'),
      ).toHaveAttribute("aria-label", "Jump to latest");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("routes each action to its typed callback", () => {
    const { root, container, callbacks } = renderBar([
      "jump-to-bottom",
      "search-transcript",
      "review-changes",
    ]);
    try {
      for (const action of [
        "jump-to-bottom",
        "search-transcript",
        "review-changes",
      ] as const) {
        act(() => {
          container
            .querySelector(`[data-next-step-action="${action}"]`)
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
      }
      expect(callbacks.onJumpToBottom).toHaveBeenCalledOnce();
      expect(callbacks.onSearchTranscript).toHaveBeenCalledOnce();
      expect(callbacks.onReviewChanges).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
