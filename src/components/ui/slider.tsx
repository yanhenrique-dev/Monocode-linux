import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Slider over Base UI. The Settings slider stays a native range input
 * (rAF previews, semi-controlled drag); use this for new sliders.
 */
export function Slider({
  className,
  ...props
}: ComponentProps<typeof BaseSlider.Root>) {
  return (
    <BaseSlider.Root
      {...props}
      className={cn(
        "relative flex h-5 w-56 max-w-full touch-none items-center select-none disabled:opacity-40",
        className,
      )}
    />
  );
}

export function SliderTrack({
  className,
  ...props
}: ComponentProps<typeof BaseSlider.Track>) {
  return (
    <BaseSlider.Track
      {...props}
      className={cn("h-1 flex-1 rounded-full bg-content/20", className)}
    />
  );
}

export function SliderIndicator({
  className,
  ...props
}: ComponentProps<typeof BaseSlider.Indicator>) {
  return (
    <BaseSlider.Indicator
      {...props}
      className={cn("rounded-full bg-accent", className)}
    />
  );
}

export function SliderThumb({
  className,
  ...props
}: ComponentProps<typeof BaseSlider.Thumb>) {
  return (
    <BaseSlider.Thumb
      {...props}
      className={cn(
        "size-4 rounded-full bg-white shadow outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
    />
  );
}
