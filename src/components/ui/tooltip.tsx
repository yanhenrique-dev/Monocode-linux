import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ComponentProps, ReactElement } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";

/**
 * Tooltip bound to MonoCode tokens. Content shows on hover AND keyboard
 * focus; prefer it over native `title=` (unstyled, delayed, mouse-only).
 * Icon-only triggers still need an explicit aria-label.
 *
 *   <Tooltip content="Close Tab">
 *     <button aria-label="Close Tab" onClick={...}>…</button>
 *   </Tooltip>
 */
export function Tooltip({
  content,
  side = "top",
  delay = 400,
  children,
  ...props
}: ComponentProps<typeof BaseTooltip.Root> & {
  content: React.ReactNode;
  side?: ComponentProps<typeof BaseTooltip.Positioner>["side"];
  delay?: number;
  children: ReactElement;
}) {
  return (
    <BaseTooltip.Root {...props}>
      <BaseTooltip.Trigger render={children} delay={delay} />
      <BaseTooltip.Portal style={{ zIndex: LAYER.popover }}>
        <BaseTooltip.Positioner side={side} sideOffset={6}>
          <BaseTooltip.Popup
            className={cn(
              "z-[1] max-w-64 rounded-lg border border-content/10 bg-background-base/95 px-2 py-1 text-[11px] leading-snug text-content shadow-xl",
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
