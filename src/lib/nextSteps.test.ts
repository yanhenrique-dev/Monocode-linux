import { describe, expect, it } from "vitest";
import {
  isNextStepCompletionEligible,
  nextStepActions,
  type NextStepCompletion,
} from "./nextSteps";

describe("next-step suggestions", () => {
  it("returns two or three actions in stable order", () => {
    expect(nextStepActions(2)).toEqual([
      "jump-to-bottom",
      "search-transcript",
    ]);
    expect(nextStepActions(3)).toEqual([
      "jump-to-bottom",
      "search-transcript",
      "review-changes",
    ]);
  });

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
      isNextStepCompletionEligible({ ...completion, managed: true }),
    ).toBe(false);
    expect(
      isNextStepCompletionEligible({ ...completion, nativeCommand: true }),
    ).toBe(false);
    expect(isNextStepCompletionEligible({ ...completion, enabled: false })).toBe(
      false,
    );
  });
});
