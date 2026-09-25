export type NextStepAction =
  "jump-to-bottom" | "search-transcript" | "review-changes";

export type NextStepCompletion = {
  status: "completed" | "failed" | "cancelled";
  intent: "default" | "plan" | "build" | "orchestrate";
  managed: boolean;
  nativeCommand: boolean;
  enabled: boolean;
};

/** Bar order. Fixed, so the toggles choose membership and never rearrange it. */
export const NEXT_STEP_ACTIONS: readonly NextStepAction[] = [
  "jump-to-bottom",
  "search-transcript",
  "review-changes",
];

export type NextStepSelection = Readonly<Record<NextStepAction, boolean>>;

/**
 * The actions to render, in bar order.
 *
 * This used to take a `2 | 3` count and slice, and the caller then filtered
 * `jump-to-bottom` out when the transcript was already at the bottom. Slicing
 * first made that pair wrong: "2 shortcuts" rendered one, "3" rendered two,
 * and `review-changes` was unreachable at the default. The filter has to
 * happen before any count, and membership is now explicit anyway.
 */
export function nextStepActions(
  selection: NextStepSelection,
): NextStepAction[] {
  return NEXT_STEP_ACTIONS.filter((action) => selection[action]);
}

/**
 * True when the selection can render a bar. All-off is not a valid state:
 * the master switch would be on with nothing to show.
 */
export function isNextStepSelectionUsable(
  selection: NextStepSelection,
): boolean {
  return NEXT_STEP_ACTIONS.some((action) => selection[action]);
}

export function isNextStepCompletionEligible(
  completion: NextStepCompletion,
): boolean {
  return (
    completion.enabled &&
    completion.status === "completed" &&
    completion.intent === "default" &&
    !completion.managed &&
    !completion.nativeCommand
  );
}
