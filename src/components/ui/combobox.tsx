import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Filterable combobox over Base UI. SearchableSelect/SearchableProjectPicker
 * stay custom (deferred focus retry, activedescendant); use this for new
 * filterable pickers.
 */
export function ComboboxRoot(props: ComponentProps<typeof BaseCombobox.Root>) {
  return <BaseCombobox.Root {...props} />;
}

export function ComboboxInput({
  className,
  ...props
}: ComponentProps<typeof BaseCombobox.Input>) {
  return (
    <BaseCombobox.Input
      {...props}
      className={cn(
        "w-full rounded-md border border-content/10 bg-content/5 px-2 py-1 text-[12px] text-content outline-none placeholder:text-content/40 hover:border-content/20 focus:border-accent",
        className,
      )}
    />
  );
}

export const ComboboxValue = BaseCombobox.Value;
export const ComboboxTrigger = BaseCombobox.Trigger;
export const ComboboxClear = BaseCombobox.Clear;
export const ComboboxCollection = BaseCombobox.Collection;

export function ComboboxPortal({
  layer = LAYER.popover,
  ...props
}: ComponentProps<typeof BaseCombobox.Portal> & { layer?: number }) {
  return <BaseCombobox.Portal {...props} style={{ zIndex: layer }} />;
}

export function ComboboxPositioner({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseCombobox.Positioner>) {
  return (
    <BaseCombobox.Positioner
      {...props}
      className={cn(
        "isolate overflow-hidden rounded-xl border border-content/10 shadow-xl",
        className,
      )}
    >
      <GlassBackdrop />
      {children}
    </BaseCombobox.Positioner>
  );
}

export function ComboboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item
      {...props}
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-content outline-none data-[highlighted]:bg-selection",
        className,
      )}
    >
      {children}
      <BaseCombobox.ItemIndicator className="size-3.5 shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="m2.5 7.5 3 3 6-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </BaseCombobox.ItemIndicator>
    </BaseCombobox.Item>
  );
}

export const ComboboxEmpty = BaseCombobox.Empty;
export const ComboboxGroup = BaseCombobox.Group;
export const ComboboxGroupLabel = BaseCombobox.GroupLabel;
export const ComboboxSeparator = BaseCombobox.Separator;
export const ComboboxStatus = BaseCombobox.Status;
