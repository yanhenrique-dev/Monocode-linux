import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT,
  loadExperimentalAnimations,
} from "../lib/appearance";

/** Experimental-animations flag minus reduced-motion: the single gate for enter/exit motion. */
export function useExperimentalAnimations(): boolean {
  const [enabled, setEnabled] = useState(loadExperimentalAnimations);
  useEffect(() => {
    const onChange = (event: Event) => {
      setEnabled(
        (event as CustomEvent<boolean>).detail ?? loadExperimentalAnimations(),
      );
    };
    window.addEventListener(EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT, onChange);
    };
  }, []);
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return enabled && !reduceMotion;
}

/**
 * Delayed unmount for exit animations: the owner keeps rendering while
 * `closing` is true (with a `*-closing` class playing the outro), and calls
 * `onAnimationEnd` on the animated element to run the real unmount.
 *
 * A timeout fallback covers engines where `animationend` never fires
 * (WebKitGTK) and the reduced-motion path where animations are `none`.
 * When `enabled` is false the close is immediate, preserving current
 * behavior behind the experimental-animations flag.
 */
export function useExitAnimation({
  enabled = true,
  durationMs = 200,
  onExit,
}: {
  enabled?: boolean;
  durationMs?: number;
  onExit: () => void;
}): {
  closing: boolean;
  requestClose: () => void;
  handleAnimationEnd: (event: { target: unknown; currentTarget: unknown }) => void;
  cancelClose: () => void;
} {
  const [closing, setClosing] = useState(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const timer = useRef<number | undefined>(undefined);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const finish = useCallback(() => {
    clearTimer();
    onExitRef.current();
  }, [clearTimer]);

  const requestClose = useCallback(() => {
    if (!enabled) {
      onExitRef.current();
      return;
    }
    setClosing((was) => {
      if (was) return was;
      timer.current = window.setTimeout(() => {
        onExitRef.current();
      }, durationMs);
      return true;
    });
  }, [enabled, durationMs]);

  const cancelClose = useCallback(() => {
    clearTimer();
    setClosing(false);
  }, [clearTimer]);

  const handleAnimationEnd = useCallback(
    (event: { target: unknown; currentTarget: unknown }) => {
      // Ignore bubbles from nested animated children.
      if (event.target !== event.currentTarget) return;
      finish();
    },
    [finish],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { closing, requestClose, handleAnimationEnd, cancelClose };
}
