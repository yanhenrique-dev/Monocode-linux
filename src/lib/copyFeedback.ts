import { useCallback, useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_MS } from "./uiTimings";

/**
 * "Copied" flash state with timer + cleanup.
 *
 * Replaces the four hand-rolled copies in AgentMarkdown / AgentTranscript /
 * InboxView / BinaryFileView (1500 vs 2000 for the same flash). The timer
 * resets on every `flash()` and clears on unmount or when `resetKey`
 * changes (e.g. new code block content).
 */
export function useCopyFeedback(
  resetKey?: unknown,
  timeoutMs: number = COPY_FEEDBACK_MS,
): { copied: boolean; flash: () => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flash = useCallback(() => {
    setCopied(true);
    clear();
    timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
  }, [clear, timeoutMs]);

  useEffect(() => {
    setCopied(false);
    return clear;
  }, [resetKey, clear]);

  useEffect(() => clear, [clear]);

  return { copied, flash };
}
