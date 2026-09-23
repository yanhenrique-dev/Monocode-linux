import { memo, useEffect, useRef, useState } from "react";

export const Slider = memo(function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onPreview,
  onCommit,
  onCancel,
  disabled = false,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  /** Live drag feedback, rAF-throttled. Must stay cheap: no persist, no IPC. */
  onPreview?: (value: number) => void;
  /** Discrete commit: track click, arrow key, and drag release. */
  onCommit: (value: number) => void;
  /** Aborted drag (pointer cancel): restore persisted values instead. */
  onCancel?: () => void;
  disabled?: boolean;
}) {
  // Semi-controlled thumb: while dragging, the thumb follows local state so
  // it tracks the pointer 1:1 with zero parent renders; the parent only
  // learns about the drag via rAF-throttled previews and the final commit.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragging = useRef(false);
  const previewRaf = useRef(0);
  const latest = useRef(value);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(
    () => () => {
      if (previewRaf.current) cancelAnimationFrame(previewRaf.current);
    },
    [],
  );

  const flushPreview = (next: number) => {
    latest.current = next;
    if (!onPreview) {
      onCommit(next);
      return;
    }
    if (previewRaf.current) return;
    previewRaf.current = requestAnimationFrame(() => {
      previewRaf.current = 0;
      onPreview(latest.current);
    });
  };

  const endDrag = (commit: boolean) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (previewRaf.current) {
      cancelAnimationFrame(previewRaf.current);
      previewRaf.current = 0;
    }
    const finalValue = latest.current;
    setDragValue(null);
    if (commit) onCommit(finalValue);
    else onCancelRef.current?.();
  };

  return (
    <div
      className={`flex w-56 max-w-full items-center gap-4 ${disabled ? "opacity-40" : ""}`}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={dragValue ?? value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={dragValue ?? value}
        aria-label={label}
        disabled={disabled}
        className="sidebar-opacity-slider min-w-0 flex-1 disabled:cursor-not-allowed"
        onPointerDown={() => {
          dragging.current = true;
        }}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onLostPointerCapture={() => endDrag(true)}
        onBlur={() => endDrag(dragValue != null)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (dragging.current && onPreview) {
            setDragValue(next);
            flushPreview(next);
          } else {
            // Keyboard step or track click: commit immediately.
            onCommit(next);
          }
        }}
      />
      <span className="w-10 shrink-0 text-right text-[12px] text-content tabular-nums">
        {display}
      </span>
    </div>
  );
});
