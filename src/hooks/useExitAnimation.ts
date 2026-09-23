import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT,
  loadExperimentalAnimations,
} from "../lib/appearance";
import { useReducedMotion } from "../lib/motion";

/** Experimental-animations flag minus reduced-motion: the single gate for enter/exit motion. */
export function useExperimentalAnimations(): boolean {
  const [enabled, setEnabled] = useState(loadExperimentalAnimations);
  const reduceMotion = useReducedMotion();
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
  durationMs = 150,
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
  // Written in an effect, not during render: a discarded concurrent render
  // must never swap the callback the committed tree's timer will run.
  useLayoutEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  const timer = useRef<number | undefined>(undefined);
  // Guards re-entrant closes and late animationend against double onExit.
  const finished = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimer();
    setClosing(false);
    onExitRef.current();
  }, [clearTimer]);

  const requestClose = useCallback(() => {
    if (!enabled) {
      finish();
      return;
    }
    // Side effects stay out of the state updater (React may run it twice):
    // the live timer is the re-entrancy guard.
    if (timer.current !== undefined) return;
    setClosing(true);
    timer.current = window.setTimeout(finish, durationMs);
  }, [enabled, durationMs, finish]);

  const cancelClose = useCallback(() => {
    clearTimer();
    finished.current = false;
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
