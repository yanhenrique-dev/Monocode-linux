import { floatingTranscriptActions } from "./nextSteps";
import { describe, expect, it } from "vitest";
import {
  COMPOSER_SUGGESTION_EVENT,
  isNextStepCompletionEligible,
  isNextStepSelectionUsable,
  nextStepActions,
  NEXT_STEP_ACTIONS,
  type NextStepCompletion,
  type NextStepSelection,
} from "./nextSteps";

const ALL_ON: NextStepSelection = {
  "jump-to-bottom": true,
  "search-transcript": true,
  "review-changes": true,
};
const ALL_OFF: NextStepSelection = {
  "jump-to-bottom": false,
  "search-transcript": false,
  "review-changes": false,
};

describe("nextStepActions", () => {
  it("keeps a stable bar order regardless of which are selected", () => {
    expect(nextStepActions(ALL_ON)).toEqual([
      "jump-to-bottom",
      "search-transcript",
      "review-changes",
    ]);
    // Selected in a different order than the bar renders them.
    expect(
      nextStepActions({
        "review-changes": true,
        "jump-to-bottom": false,
        "search-transcript": true,
      }),
    ).toEqual(["search-transcript", "review-changes"]);
  });

  it("returns nothing when nothing is selected", () => {
    expect(nextStepActions(ALL_OFF)).toEqual([]);
  });

  // The regression this replaced: the old code sliced a `2 | 3` count and only
  // then dropped jump-to-bottom, so "2 shortcuts" rendered one button and
  // review-changes was unreachable at the default. Selection is now explicit,
  // and a filtered caller never loses a slot it was promised.
  it("keeps every selected action reachable at any count", () => {
    const onlySearchAndReview: NextStepSelection = {
      "jump-to-bottom": false,
      "search-transcript": true,
      "review-changes": true,
    };
    expect(nextStepActions(onlySearchAndReview)).toHaveLength(2);
    expect(nextStepActions(onlySearchAndReview)).toContain("review-changes");
  });
});

describe("isNextStepSelectionUsable", () => {
  it("rejects an all-off selection", () => {
    // The master switch would be on with nothing to render.
    expect(isNextStepSelectionUsable(ALL_OFF)).toBe(false);
  });

  it("accepts any single action", () => {
    for (const action of NEXT_STEP_ACTIONS) {
      const only: NextStepSelection = { ...ALL_OFF, [action]: true };
      expect(isNextStepSelectionUsable(only), action).toBe(true);
    }
  });
});

describe("isNextStepCompletionEligible", () => {
  it("accepts only completed, non-managed user turns", () => {
    const completion: NextStepCompletion = {
      status: "completed",
      intent: "default",
      managed: false,
      nativeCommand: false,
      enabled: true,
    };
    expect(isNextStepCompletionEligible(completion)).toBe(true);
    expect(
      isNextStepCompletionEligible({ ...completion, status: "failed" }),
    ).toBe(false);
    expect(
      isNextStepCompletionEligible({ ...completion, status: "cancelled" }),
    ).toBe(false);
    for (const intent of ["plan", "build", "orchestrate"] as const) {
      expect(isNextStepCompletionEligible({ ...completion, intent })).toBe(
        false,
      );
    }
    expect(isNextStepCompletionEligible({ ...completion, managed: true })).toBe(
      false,
    );
    expect(
      isNextStepCompletionEligible({ ...completion, nativeCommand: true }),
    ).toBe(false);
    expect(
      isNextStepCompletionEligible({ ...completion, enabled: false }),
    ).toBe(false);
  });
});

describe("COMPOSER_SUGGESTION_EVENT", () => {
  it("is namespaced like the other window events", () => {
    expect(COMPOSER_SUGGESTION_EVENT).toBe("monocode:composer-suggestion");
  });
});

describe("floatingTranscriptActions", () => {
  const at = (scrolledUp: boolean, searchOpen: boolean, searchAvailable = true) =>
    floatingTranscriptActions({ scrolledUp, searchOpen, searchAvailable });

  it("gives jump-to-bottom to the scrolled-up case alone", () => {
    // The bar omits the action exactly when the floating button owns it, so the
    // two can never both claim the same control.
    expect(at(true, false).jumpToBottom).toBe(true);
    expect(at(false, false).jumpToBottom).toBe(false);
    expect(at(false, true).jumpToBottom).toBe(false);
  });

  it("hides the search control when its setting is off", () => {
    // The setting used to reach nothing: the button rendered regardless, so
    // turning it off left the control on screen.
    expect(at(false, false, false).search).toBe(false);
    expect(at(true, false, false).search).toBe(false);
    expect(at(false, false, true).search).toBe(true);
  });

  it("draws the container only when it has a control to put in it", () => {
    expect(at(false, false).containerVisible).toBe(false);
    expect(at(true, false).containerVisible).toBe(true);
    // An open search keeps the pair up so the box and its toggle stay together.
    expect(at(false, true).containerVisible).toBe(true);
    // But not when the setting removed the search control in the first place,
    // even if a stale open flag says otherwise.
    expect(at(false, true, false).containerVisible).toBe(false);
  });

  it("derives jump-to-bottom from scrolledUp alone, never from the search state", () => {
    // This is the invariant the duplicate broke. The container used to honour
    // `searchOpen` and the bar filter did not, so an open search on an
    // unscrolled transcript showed the floating button while the bar still
    // listed the action. If jump-to-bottom cannot see the search state, the two
    // cannot disagree.
    for (const searchOpen of [false, true]) {
      for (const searchAvailable of [false, true]) {
        expect(at(false, searchOpen, searchAvailable).jumpToBottom).toBe(false);
        expect(at(true, searchOpen, searchAvailable).jumpToBottom).toBe(true);
      }
    }
  });
});
