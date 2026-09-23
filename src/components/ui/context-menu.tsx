import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Context (right-click) menu over Base UI, same frame/tokens as DropdownMenu.
 * ExplorerMenu stays the canonical wrapper for existing context menus;
 * use these parts for simple new ones.
 */
export function ContextMenu(props: ComponentProps<typeof BaseContextMenu.Root>) {
  return <BaseContextMenu.Root {...props} />;
}

export const ContextMenuTrigger = BaseContextMenu.Trigger;

export function ContextMenuPortal({
  layer = LAYER.popover,
  ...props
}: ComponentProps<typeof BaseContextMenu.Portal> & { layer?: number }) {
  return <BaseContextMenu.Portal {...props} style={{ zIndex: layer }} />;
}

const MENU_FRAME =
  "isolate overflow-hidden rounded-xl border border-content/10 shadow-xl";

export function ContextMenuPositioner({
  className,
  popupClassName,
  children,
  ...props
}: ComponentProps<typeof BaseContextMenu.Positioner> & { popupClassName?: string }) {
  return (
    <BaseContextMenu.Positioner
      {...props}
      className={cn(MENU_FRAME, className)}
    >
      <GlassBackdrop />
      <BaseContextMenu.Popup className={cn("relative z-[1] p-1 outline-none", popupClassName)}>
        {children}
      </BaseContextMenu.Popup>
    </BaseContextMenu.Positioner>
  );
}

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-2 h-7 text-left text-[13px] leading-none text-content hover:bg-content/5 focus-visible:bg-selection focus-visible:outline-none data-[highlighted]:bg-selection data-[disabled]:text-content/30";

export function ContextMenuItem({
  className,
  ...props
}: ComponentProps<typeof BaseContextMenu.Item>) {
  return <BaseContextMenu.Item {...props} className={cn(ITEM, className)} />;
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof BaseContextMenu.Separator>) {
  return (
    <BaseContextMenu.Separator
      {...props}
      className={cn("my-1 h-px bg-content/10", className)}
    />
  );
}

export const ContextMenuSubmenu = BaseContextMenu.SubmenuRoot;
export const ContextMenuSubmenuTrigger = BaseContextMenu.SubmenuTrigger;
