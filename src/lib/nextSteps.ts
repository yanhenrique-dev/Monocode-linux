export type NextStepAction =
  | "jump-to-bottom"
  | "search-transcript"
  | "review-changes";

export type NextStepsCount = 2 | 3;

export type NextStepCompletion = {
  status: "completed" | "failed" | "cancelled";
  intent: "default" | "plan" | "build" | "orchestrate";
  managed: boolean;
  nativeCommand: boolean;
  enabled: boolean;
};

export const NEXT_STEP_ACTIONS: readonly NextStepAction[] = [
  "jump-to-bottom",
  "search-transcript",
  "review-changes",
];

export function nextStepActions(count: NextStepsCount): NextStepAction[] {
  return NEXT_STEP_ACTIONS.slice(0, count);
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
