/**
 * Keep glass beside the interactive content, inside a positioned, isolated
 * frame. Neither this layer nor its ancestors should animate: backdrop-filter
 * already handles compositing without translateZ/backface-visibility hints.
 *
 * Cost note (Fase 4): each mounted GlassBackdrop is a backdrop-filter sample
 * per frame on WebKitGTK/software. Stacking sidebar + popover + modal +
 * toast blurs is the costliest paint in the app; prefer reusing one surface
 * and rely on the hw-reduced / no-ui-blur / is-scrolling / is-resizing
 * guards in index.css instead of adding new blurred layers.
 */
export function GlassBackdrop({
  className = "popover-backdrop",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 rounded-[inherit] glass-blur backdrop-blur-sm ${className}`}
    />
  );
}
