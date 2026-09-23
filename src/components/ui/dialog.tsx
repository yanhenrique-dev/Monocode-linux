import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";

/** Controlled root: `open` + `onOpenChange` drive mount/animated close. */
export function Dialog(props: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />;
}

/**
 * Portal fixed to the viewport on a LAYER slot (default dialog/90).
 * Backdrop + positioned popup go inside as children.
 */
export function DialogPortal({
  layer = LAYER.dialog,
  className,
  ...props
}: ComponentProps<typeof BaseDialog.Portal> & { layer?: number }) {
  return (
    <BaseDialog.Portal
      {...props}
      className={cn("fixed inset-0", className)}
      style={{ zIndex: layer }}
    />
  );
}

export const DialogPopup = BaseDialog.Popup;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;
