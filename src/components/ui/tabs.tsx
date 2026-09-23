import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Tabs over Base UI (roving tabindex, arrow keys, automatic activation
 * optional). SurfaceTabs/workspace tabs stay custom (pointer DnD reorder);
 * use this for settings-style tab rows and other static tab sets.
 */
export function Tabs(props: ComponentProps<typeof BaseTabs.Root>) {
  return <BaseTabs.Root {...props} />;
}

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      {...props}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-content/10 p-1 text-[12px]",
        className,
      )}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      {...props}
      className={cn(
        "rounded-md px-2.5 py-1 text-content/60 outline-none hover:text-content focus-visible:ring-2 focus-visible:ring-accent data-[selected]:bg-selection data-[selected]:text-content",
        className,
      )}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel {...props} className={cn("outline-none", className)} />;
}

export const TabsIndicator = BaseTabs.Indicator;
