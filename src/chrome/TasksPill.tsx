import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Block, TaskListItem } from "../lib/session";
import {
  lastTaskBlock,
  taskListActiveLabel,
  taskListProgressLabel,
} from "../lib/taskList";
import { useReducedMotion } from "../lib/motion";
import { Check, ChevronRight, CircleDot, ListEnd } from "./icons";
import { TerminalSpinner } from "./TerminalSpinner";
import { Tooltip } from "../components/ui/tooltip";

type Props = {
  blocks: readonly Block[];
  scope: RefObject<HTMLElement | null>;
  visible?: boolean;
  enabled: boolean;
  /** Slide the strip in and out instead of mounting it instantly. */
  animationsEnabled?: boolean;
  /** Scrolls the block into view. Returns false when the block is unknown. */
  revealBlock?: (blockId: string) => boolean;
};

/**
 * Compact replica of the latest task list, fused to the top of the composer
 * while the real task card is scrolled out of the message-list viewport.
 * Renders as a full-width strip (not a floating popup) inside the docked
 * composer container; a CSS rule flattens the composer's top corners so the
 * two read as one surface. See [data-tasks-strip] in index.css.
 */
export function TasksPill({
  blocks,
  scope,
  visible = true,
  enabled,
  animationsEnabled = false,
  revealBlock,
}: Props) {
  const last = useMemo(() => lastTaskBlock(blocks), [blocks]);
  const lastId = last?.id ?? null;
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    if (!visible || !enabled || !lastId) {
      setOffscreen(false);
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const scroller =
      scope.current?.querySelector<HTMLElement>(".agent-transcript");
    const anchor = scroller?.querySelector<HTMLElement>(
      `[data-task-anchor="${lastId}"]`,
    );
    if (!scroller) return;
    // Paginated-out turn: the block exists but its anchor is not mounted.
    // Treat as offscreen. Note the effect does NOT re-run when revealBlock
    // mounts the turn (that only flips AgentTranscript-internal state), so
    // the click handler below hides the pill and scrolls explicitly.
    if (!anchor) {
      setOffscreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { root: scroller },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [visible, enabled, lastId, scope]);

  const items = last?.taskList?.items ?? [];
  // Once every item settled, the pill would only ever read "Complete" —
  // hide it instead of pinning a dead strip above the composer.
  const settled =
    items.length > 0 &&
    items.every(
      (item) => item.status === "completed" || item.status === "cancelled",
    );
  const open = visible && enabled && !!last && offscreen && !settled;
  const reduceMotion = useReducedMotion();
  const reveal = () => {
    if (!last) return;
    if (!revealBlock?.(last.id)) return;
    // A virtualized turn commits after scrollToIndex returns, so wait a
    // frame before querying the anchor; hide the pill only once the anchor
    // is found, otherwise leave it up for another try.
    const scroller = scope.current;
    const query = () =>
      scroller?.querySelector<HTMLElement>(`[data-task-anchor="${last.id}"]`) ??
      null;
    const anchor = query();
    if (anchor) {
      anchor.scrollIntoView({ block: "center" });
      setOffscreen(false);
      return;
    }
    requestAnimationFrame(() => {
      const late = query();
      if (!late) return;
      late.scrollIntoView({ block: "center" });
      setOffscreen(false);
    });
  };
  // Without the experimental flag the strip mounts instantly exactly as
  // before; the animated path keeps the frame mounted and folds it with a
  // grid transition instead.
  if (!animationsEnabled || reduceMotion) {
    if (!open) return null;
    return (
      <div data-tasks-strip className="mx-1.5">
        <StripButton items={items} onReveal={reveal} />
      </div>
    );
  }
  // The fusion selectors only match a strip that is actually showing, so the
  // composer keeps its own top border while the strip is folded away.
  if (!visible || !enabled || !last) return null;
  return (
    <div
      className="fold-body mx-1.5"
      data-open={open}
      // A folded strip stays mounted for the transition: keep its button
      // out of tab order and off the screen reader until it opens.
      inert={!open}
      {...(open ? { "data-tasks-strip": "" } : {})}
    >
      <div className="min-h-0 overflow-hidden">
        <StripButton items={items} onReveal={reveal} />
      </div>
    </div>
  );
}

function StripButton({
  items,
  onReveal,
}: {
  items: TaskListItem[];
  onReveal: () => void;
}) {
  const activeLabel = taskListActiveLabel(items);
  const working = items.some((item) => item.status === "in_progress");
  const progress = taskListProgressLabel(items);
  const StatusIcon = progress === "Complete" ? Check : CircleDot;
  return (
    <Tooltip content={activeLabel ? `${progress}: ${activeLabel}` : progress}>
      <button
        type="button"
        aria-label={
          activeLabel
            ? `Show tasks (${working ? "In progress, " : ""}${progress}: ${activeLabel})`
            : `Show tasks (${working ? "In progress, " : ""}${progress})`
        }
        data-tasks-pill
        onClick={onReveal}
        className="flex w-full items-center gap-2 rounded-t-lg border border-b border-content/10 bg-background-base/95 px-3 py-1.5 text-left text-content hover:bg-content/5"
      >
        <ListEnd
          className="size-3.5 shrink-0 text-content/50"
          strokeWidth={1.75}
        />
        {working ? (
          <TerminalSpinner className="inline-block w-3.5 shrink-0 select-none text-center text-[11px] leading-none text-accent" />
        ) : (
          <StatusIcon
            className="size-3.5 shrink-0 text-emerald-400"
            strokeWidth={2.25}
          />
        )}
        {activeLabel ? (
          <span className="min-w-0 flex-1 truncate text-[12px] text-content/60">
            {activeLabel}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <span className="shrink-0 font-mono text-[10px] text-content/50">
          {progress}
        </span>
        <ChevronRight
          className="size-3.5 shrink-0 text-content/35"
          strokeWidth={1.75}
        />
      </button>
    </Tooltip>
  );
}
