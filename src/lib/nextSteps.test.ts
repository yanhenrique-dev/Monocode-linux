import { describe, expect, it } from "vitest";
import {
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
