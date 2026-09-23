import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useExperimentalAnimations } from "../hooks/useExitAnimation";

export interface ShimmerProps {
  children: string;
  as?: "span";
  className?: string;
  duration?: number;
  spread?: number;
}

function ShimmerComponent({
  children,
  as: Component = "span",
  className = "",
  duration = 2,
  spread = 2,
}: ShimmerProps) {
  const animated = useExperimentalAnimations();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(true);
  const dynamicSpread = useMemo(
    () => Math.min((children?.length ?? 0) * spread, 480),
    [children, spread],
  );

  useEffect(() => {
    if (!animated) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animated]);

  if (!animated) {
    return (
      <Component ref={ref} className={`relative inline-block ${className}`.trim()}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      ref={ref}
      data-shimmer-visible={visible ? "true" : "false"}
      className={`shimmer-text relative inline-block ${className}`.trim()}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          "--shimmer-duration": `${duration}s`,
          ...(visible ? null : { animation: "none" }),
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
}

export const Shimmer = memo(ShimmerComponent);
