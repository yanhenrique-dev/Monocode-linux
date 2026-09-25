import { ChevronDown, FileDiff, Search, Sparkles } from "../chrome/icons";
import { useLocale } from "../lib/locale";
import type { NextStepAction } from "../lib/nextSteps";
import type { NextStepSuggestion } from "../lib/nextStepsPrompt";

type Props = {
  actions: readonly NextStepAction[];
  /** Model suggestions for this turn. Absent while generating, and on failure. */
  suggestions?: readonly NextStepSuggestion[] | null;
  onJumpToBottom: () => void;
  onSearchTranscript: () => void;
  onReviewChanges: () => void;
  onSuggestion: (prompt: string) => void;
};

/**
 * The bar appears as soon as a turn settles, with whatever is already known.
 * Suggestions arrive later and are appended; a failure just leaves them out.
 * The user is never shown a spinner or an error for this.
 */
export function NextStepsBar({
  actions,
  suggestions,
  onJumpToBottom,
  onSearchTranscript,
  onReviewChanges,
  onSuggestion,
}: Props) {
  const { t } = useLocale();
  if (actions.length === 0 && !suggestions?.length) return null;

  return (
    <div
      role="group"
      aria-label={t("next_steps.toolbar")}
      data-next-steps
      className="pointer-events-none absolute inset-x-0 bottom-full z-30 mb-2 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-content/15 bg-background-base/95 p-1 shadow-xl">
        {actions.map((action) => {
          const label =
            action === "jump-to-bottom"
              ? t("next_steps.jump_to_bottom")
              : action === "search-transcript"
                ? t("next_steps.search_transcript")
                : t("next_steps.review_changes");
          const onClick =
            action === "jump-to-bottom"
              ? onJumpToBottom
              : action === "search-transcript"
                ? onSearchTranscript
                : onReviewChanges;
          return (
            <button
              key={action}
              type="button"
              title={label}
              aria-label={label}
              data-next-step-action={action}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="grid size-7 shrink-0 place-items-center rounded-md text-content/60 transition-colors hover:bg-content/10 hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              {action === "jump-to-bottom" ? (
                <ChevronDown className="size-4" strokeWidth={2} />
              ) : action === "search-transcript" ? (
                <Search className="size-3.5" strokeWidth={2} />
              ) : (
                <FileDiff className="size-4" strokeWidth={1.75} />
              )}
            </button>
          );
        })}
        {suggestions?.map((suggestion) => (
          <button
            key={suggestion.prompt}
            type="button"
            data-next-step-suggestion={suggestion.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSuggestion(suggestion.prompt)}
            title={suggestion.prompt}
            className="flex min-w-0 max-w-56 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-content/70 transition-colors hover:bg-content/10 hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Sparkles className="size-3 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 truncate">{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
