import { useEffect, useState } from "react";
import { useReducedMotion } from "../lib/motion";

const FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export function TerminalSpinner({
  className = "inline-block w-3.5 select-none text-center text-[11px] leading-none",
}: {
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const id = window.setInterval(
      () => setFrame((n) => (n + 1) % FRAMES.length),
      80,
    );
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <span aria-hidden className={className}>
      {reducedMotion ? FRAMES[0] : FRAMES[frame]}
    </span>
  );
}
