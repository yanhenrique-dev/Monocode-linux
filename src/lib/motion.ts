import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "undefined" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/** Sync one-shot read for non-component contexts (pointer handlers). */
export function prefersReducedMotion(): boolean {
  return readReducedMotion();
}

/** Reactive prefers-reduced-motion; updates when the OS setting changes mid-session. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia === "undefined"
    )
      return;
    const list = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setReduced(event.matches);
    if (typeof list.addEventListener === "function") {
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    }
    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, []);
  return reduced;
}

/** Read the shared CSS tokens so pointer gestures and CSS use the same timing. */
export function reorderMotion() {
  if (cachedReorder == null) cachedReorder = readReorderMotion();
  return cachedReorder;
}

/** Drop the cached tokens so the next drag re-reads CSS (theme/token change). */
export function invalidateReorderMotion() {
  cachedReorder = null;
}

type ReorderMotion = { duration: number; easing: string };

let cachedReorder: ReorderMotion | null = null;

function readReorderMotion(): ReorderMotion {
  const REORDER_FALLBACK_MS = 160;
  const style = window.getComputedStyle(document.documentElement);
  const duration = style.getPropertyValue("--motion-reorder-duration").trim();
  const milliseconds =
    parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000);
  return {
    duration: Number.isFinite(milliseconds)
      ? Math.max(0, milliseconds)
      : REORDER_FALLBACK_MS,
    easing: style.getPropertyValue("--motion-ease-out").trim() || "linear",
  };
}
