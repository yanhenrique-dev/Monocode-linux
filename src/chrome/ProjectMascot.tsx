import { MASCOT_GRID, projectMascot } from "../lib/projectMascots";

type Props = {
  project: string;
  /** Project color; omit to inherit the surrounding text color. */
  color?: string;
  /** Explicit pick from the project menu; falls back to the hashed one. */
  name?: string | null;
  className?: string;
  /** Cycles the mascot's two frames while a turn is in flight. */
  active?: boolean;
};

/** Pixel mascot standing in for the project's color dot.
 *
 * The art is an 8×8 grid: only render at integer multiples (8px, 16px…)
 * so every cell lands on whole device pixels. Fractional boxes (12px,
 * 14px) make crispEdges snap alternating 1px/2px columns and the sprite
 * looks lumpy. Prefer `size-4`; never pass a fractional size. */
export function ProjectMascot({
  project,
  color,
  name,
  className = "size-4 shrink-0",
  active = false,
}: Props) {
  const mascot = projectMascot(project, name);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${MASCOT_GRID} ${MASCOT_GRID}`}
      shapeRendering="crispEdges"
      className={`${className} ${active ? "mascot-active" : ""}`}
      fill="currentColor"
      style={color ? { color } : undefined}
    >
      {active ? (
        <>
          <path className="mascot-rest" d={mascot.restPath} />
          <path className="mascot-talk" d={mascot.talkPath} />
        </>
      ) : (
        <path d={mascot.restPath} />
      )}
    </svg>
  );
}
