import { ChevronDown, FileDiff, Search } from "../chrome/icons";
import { useLocale } from "../lib/locale";
import type { NextStepAction } from "../lib/nextSteps";

type Props = {
  actions: readonly NextStepAction[];
  onJumpToBottom: () => void;
  onSearchTranscript: () => void;
  onReviewChanges: () => void;
};

export function NextStepsBar({
  actions,
  onJumpToBottom,
  onSearchTranscript,
  onReviewChanges,
}: Props) {
  const { t } = useLocale();
  if (actions.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={t("next_steps.toolbar")}
      data-next-steps
      className="pointer-events-none absolute inset-x-0 bottom-full z-30 mb-2 flex justify-center"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-content/15 bg-background-base/95 p-1 shadow-xl backdrop-blur-sm">
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
              className="grid size-7 place-items-center rounded-md text-content/60 transition-colors hover:bg-content/10 hover:text-content focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
      </div>
    </div>
  );
}
