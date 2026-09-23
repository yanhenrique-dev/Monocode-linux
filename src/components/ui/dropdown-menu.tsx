import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Dropdown menu over Base UI Menu, bound to MonoCode tokens.
 * ExplorerMenu stays the canonical wrapper for context menus and complex
 * menus (submenus, hover timers); use these parts for simple new menus.
 */
export function DropdownMenu(props: ComponentProps<typeof BaseMenu.Root>) {
  return <BaseMenu.Root {...props} />;
}

export const DropdownMenuTrigger = BaseMenu.Trigger;

export function DropdownMenuPortal({
  layer = LAYER.popover,
  ...props
}: ComponentProps<typeof BaseMenu.Portal> & { layer?: number }) {
  return <BaseMenu.Portal {...props} style={{ zIndex: layer }} />;
}

const MENU_FRAME =
  "isolate overflow-hidden rounded-xl border border-content/10 shadow-xl";

export function DropdownMenuPositioner({
  className,
  popupClassName,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.Positioner> & { popupClassName?: string }) {
  return (
    <BaseMenu.Positioner
      {...props}
      className={cn(MENU_FRAME, className)}
    >
      <GlassBackdrop />
      <BaseMenu.Popup className={cn("relative z-[1] p-1 outline-none", popupClassName)}>
        {children}
      </BaseMenu.Popup>
    </BaseMenu.Positioner>
  );
}

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-2 h-7 text-left text-[13px] leading-none text-content hover:bg-content/5 focus-visible:bg-selection focus-visible:outline-none data-[highlighted]:bg-selection data-[disabled]:text-content/30";

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Item>) {
  return <BaseMenu.Item {...props} className={cn(ITEM, className)} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.Separator>) {
  return (
    <BaseMenu.Separator
      {...props}
      className={cn("my-1 h-px bg-content/10", className)}
    />
  );
}

export const DropdownMenuSubmenu = BaseMenu.SubmenuRoot;
export const DropdownMenuSubmenuTrigger = BaseMenu.SubmenuTrigger;
export const DropdownMenuGroup = BaseMenu.Group;
export const DropdownMenuGroupLabel = BaseMenu.GroupLabel;
export const DropdownMenuCheckboxItem = BaseMenu.CheckboxItem;
export const DropdownMenuRadioGroup = BaseMenu.RadioGroup;
export const DropdownMenuRadioItem = BaseMenu.RadioItem;
