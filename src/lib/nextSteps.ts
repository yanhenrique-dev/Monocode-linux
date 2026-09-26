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

/**
 * Asks the composer to prefill a suggestion.
 *
 * A window event rather than a prop chain: the bar sits above the composer
 * inside SessionPane, but the composer owns its draft and its focus, and it
 * already listens for this kind of out-of-band instruction.
 */
export const COMPOSER_SUGGESTION_EVENT = "monocode:composer-suggestion";

export function requestComposerSuggestion(prompt: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string>(COMPOSER_SUGGESTION_EVENT, { detail: prompt }),
  );
}

export function subscribeComposerSuggestion(
  onSuggestion: (prompt: string) => void,
): () => void {
  const onEvent = (event: Event) => {
    const prompt = (event as CustomEvent<string>).detail;
    if (typeof prompt === "string" && prompt) onSuggestion(prompt);
  };
  window.addEventListener(COMPOSER_SUGGESTION_EVENT, onEvent);
  return () => window.removeEventListener(COMPOSER_SUGGESTION_EVENT, onEvent);
}

/**
 * Which floating controls sit over the transcript, and whether the bar may
 * repeat them.
 *
 * This is one function because the container that draws the floating pair and
 * the filter that decides whether the next-steps bar repeats the jump button
 * are the same decision, and they used to be written twice. The two drifted:
 * the container also honoured `searchOpen`, so a search that was open but not
 * scrolled-up showed the floating jump button while the bar, reading only
 * `scrolledUp`, still listed the action -- the same button on screen twice.
 *
 * `scrolledUp` is the sole owner of jump-to-bottom. The bar omits the action
 * exactly when the floating button is showing, so the two can never both claim
 * it. `searchAvailable` is the user's setting: turning it off removes the
 * control entirely rather than only dropping it from the bar.
 */
export function floatingTranscriptActions(input: {
  scrolledUp: boolean;
  searchOpen: boolean;
  searchAvailable: boolean;
}): { jumpToBottom: boolean; search: boolean; containerVisible: boolean } {
  const jumpToBottom = input.scrolledUp;
  const search = input.searchAvailable;
  return {
    jumpToBottom,
    search,
    // The pair's container draws nothing unless it has a control to put in it,
    // so an all-off state leaves no gap in the transcript.
    containerVisible: jumpToBottom || (search && input.searchOpen),
  };
}
