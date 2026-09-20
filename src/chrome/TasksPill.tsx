import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Block } from "../lib/session";
import { lastTaskBlock, taskListProgressLabel } from "../lib/taskList";
import { ChevronRight, ListEnd } from "./icons";

type Props = {
  blocks: readonly Block[];
  scope: RefObject<HTMLElement | null>;
  visible?: boolean;
  enabled: boolean;
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
  revealBlock,
}: Props) {
  const last = useMemo(() => lastTaskBlock(blocks), [blocks]);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    if (!visible || !enabled || !last) {
      setOffscreen(false);
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const scroller = scope.current?.querySelector<HTMLElement>(
      ".agent-transcript",
    );
    const anchor = scroller?.querySelector<HTMLElement>(
      `[data-task-anchor="${last.id}"]`,
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
  }, [visible, enabled, last, scope, blocks]);

  if (!visible || !enabled || !last || !offscreen) return null;
  const items = last.taskList?.items ?? [];
  const reveal = () => {
    if (!revealBlock?.(last.id)) return;
    // revealBlock mounts synchronously (flushSync), so the anchor is in the
    // DOM here — whether the turn was just mounted or was already there.
    // Scroll it into view (revealBlock alone preserves scroll position) and
    // hide the pill; the observer re-shows it if scrolled away again.
    scope.current
      ?.querySelector<HTMLElement>(`[data-task-anchor="${last.id}"]`)
      ?.scrollIntoView({ block: "center" });
    setOffscreen(false);
  };
  return (
    <div data-tasks-strip className="mx-1.5">
      <button
        type="button"
        title="Show tasks"
        aria-label={`Show tasks (${taskListProgressLabel(items)})`}
        data-tasks-pill
        onClick={reveal}
        className="flex w-full items-center gap-2 rounded-t-lg border border-b border-content/10 bg-background-base/95 px-3 py-1.5 text-left text-content hover:bg-content/5"
      >
        <ListEnd
          className="size-3.5 shrink-0 text-content/50"
          strokeWidth={1.75}
        />
        <span className="min-w-0 truncate text-[12px]">Tasks</span>
        <span className="shrink-0 rounded-full bg-content/7 px-1.5 py-px font-mono text-[10px] text-content/50">
          {taskListProgressLabel(items)}
        </span>
        <ChevronRight
          className="ml-auto size-3.5 shrink-0 text-content/35"
          strokeWidth={1.75}
        />
      </button>
    </div>
  );
}
