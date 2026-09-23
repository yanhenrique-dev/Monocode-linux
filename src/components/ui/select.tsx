import { Select as BaseSelect } from "@base-ui/react/select";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Select over Base UI, same frame/tokens as the menus.
 * SettingsSelect stays as-is (custom Tab-commit + activedescendant);
 * use these parts for new selects.
 */
export function SelectRoot(props: ComponentProps<typeof BaseSelect.Root>) {
  return <BaseSelect.Root {...props} />;
}

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      {...props}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-content/10 bg-content/5 px-2 py-1 text-left text-[12px] text-content outline-none hover:border-content/20 focus-visible:border-accent",
        className,
      )}
    >
      {children}
      <BaseSelect.Icon className="size-3.5 shrink-0 text-content/50">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3.5 5.25 7 8.75 10.5 5.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export const SelectValue = BaseSelect.Value;

export function SelectPortal({
  layer = LAYER.dialogPopover,
  ...props
}: ComponentProps<typeof BaseSelect.Portal> & { layer?: number }) {
  return <BaseSelect.Portal {...props} style={{ zIndex: layer }} />;
}

export function SelectPositioner({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseSelect.Positioner>) {
  return (
    <BaseSelect.Positioner
      {...props}
      className={cn(
        "isolate overflow-hidden rounded-xl border border-content/10 shadow-xl",
        className,
      )}
    >
      <GlassBackdrop />
      {children}
    </BaseSelect.Positioner>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      {...props}
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-content outline-none data-[highlighted]:bg-selection",
        className,
      )}
    >
      <BaseSelect.ItemText className="min-w-0 flex-1 truncate">
        {children}
      </BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="size-3.5 shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="m2.5 7.5 3 3 6-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}
