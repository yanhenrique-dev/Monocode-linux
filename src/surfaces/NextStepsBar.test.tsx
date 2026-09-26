// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextStepsBar } from "./NextStepsBar";
import type { NextStepSuggestion } from "../lib/nextStepsPrompt";

type BarProps = React.ComponentProps<typeof NextStepsBar>;

function renderBar(
  actions: BarProps["actions"],
  suggestions?: BarProps["suggestions"],
) {
  const callbacks = {
    onJumpToBottom: vi.fn(),
    onSearchTranscript: vi.fn(),
    onReviewChanges: vi.fn(),
    onSuggestion: vi.fn(),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      createElement(NextStepsBar, { actions, suggestions, ...callbacks }),
    );
  });
  return { container, root, callbacks };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("NextStepsBar", () => {
  it("renders the configured actions with accessible labels", () => {
    const { root, container } = renderBar([
      "jump-to-bottom",
      "search-transcript",
      "review-changes",
    ]);
    try {
      expect(container.querySelector('[role="group"]')).not.toBeNull();
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
        container
          .querySelector('[data-next-step-action="jump-to-bottom"]')
          ?.getAttribute("aria-label"),
      ).toBe("Jump to latest");
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

  // The progressive part: the static bar renders immediately, the model's
  // suggestions are appended when they arrive, and nothing shows while they
  // are in flight.
  it("renders the static actions with no suggestions at all", () => {
    const { root, container } = renderBar(["search-transcript"]);
    try {
      expect(
        container.querySelector('[data-next-step-action="search-transcript"]'),
      ).not.toBeNull();
      expect(container.querySelector("[data-next-step-suggestion]")).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("appends suggestions after the static actions", () => {
    const suggestions: NextStepSuggestion[] = [
      { label: "Run the tests", prompt: "Run the test suite." },
      { label: "Write a test", prompt: "Add a test for the parser." },
    ];
    const { root, container } = renderBar(["search-transcript"], suggestions);
    try {
      const buttons = Array.from(
        container.querySelectorAll("[data-next-step-suggestion]"),
      );
      expect(
        buttons.map((b) => b.getAttribute("data-next-step-suggestion")),
      ).toEqual(["Run the tests", "Write a test"]);
      // The static action still comes first.
      const all = Array.from(container.querySelectorAll("button"));
      expect(all[0]?.getAttribute("data-next-step-action")).toBe(
        "search-transcript",
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("sends the prompt, not the label, when a suggestion is clicked", () => {
    const suggestions: NextStepSuggestion[] = [
      { label: "Run the tests", prompt: "Run the test suite." },
    ];
    const { root, container, callbacks } = renderBar([], suggestions);
    try {
      act(() => {
        container
          .querySelector("[data-next-step-suggestion]")
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(callbacks.onSuggestion).toHaveBeenCalledWith(
        "Run the test suite.",
      );
      expect(callbacks.onSuggestion).not.toHaveBeenCalledWith("Run the tests");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("still renders when every static action is off but suggestions exist", () => {
    const { root, container } = renderBar(
      [],
      [{ label: "Run the tests", prompt: "Run the test suite." }],
    );
    try {
      expect(container.querySelector('[role="group"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("renders nothing when there is neither an action nor a suggestion", () => {
    const { root, container } = renderBar([]);
    try {
      expect(container.querySelector('[role="group"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
