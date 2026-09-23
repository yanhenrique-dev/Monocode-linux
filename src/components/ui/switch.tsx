import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Switch bound to MonoCode tokens. Renders a native button (not Base's
 * default span) so `disabled`, :disabled styling and button queries keep
 * working; thumb position follows data-checked (no JS measuring).
 */
export function Switch({
  className,
  ...props
}: ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      {...props}
      render={
        <button
          type="button"
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 data-[unchecked]:bg-content/20 data-[checked]:bg-accent",
            className,
          )}
        />
      }
    />
  );
}

export function SwitchThumb({
  className,
  ...props
}: ComponentProps<typeof BaseSwitch.Thumb>) {
  return (
    <BaseSwitch.Thumb
      {...props}
      className={cn(
        "absolute top-0.5 left-0.5 block size-4 rounded-full bg-white transition-[left] data-[checked]:left-4.5",
        className,
      )}
    />
  );
}
