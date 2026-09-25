import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Destructive confirm over Base UI AlertDialog (role=alertdialog).
 * Unlike Modal it never dismisses on backdrop press: callers wire Cancel
 * explicitly. ConfirmDialog in chrome/ is the canonical consumer.
 */
export function AlertDialog(props: ComponentProps<typeof BaseAlertDialog.Root>) {
  return <BaseAlertDialog.Root {...props} />;
}

export function AlertDialogPortal({
  layer = LAYER.dialog,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Portal> & { layer?: number }) {
  return (
    <BaseAlertDialog.Portal
      {...props}
      className="fixed inset-0"
      style={{ zIndex: layer }}
    />
  );
}

export function AlertDialogPopup({
  className,
  ...props
}: ComponentProps<typeof BaseAlertDialog.Popup>) {
  return (
    <BaseAlertDialog.Popup
      {...props}
      className={cn(
        "absolute left-1/2 top-1/2 flex w-[min(420px,calc(100vw-24px))] max-h-[calc(100vh-48px)] flex-col -translate-x-1/2 -translate-y-1/2",
        className,
      )}
    />
  );
}

export function AlertDialogPanel({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "relative isolate flex min-h-0 flex-col overflow-hidden rounded-2xl border border-content/10 shadow-2xl",
        className,
      )}
    >
      <GlassBackdrop className="popover-backdrop bg-background-base/55" />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}

export const AlertDialogTitle = BaseAlertDialog.Title;
export const AlertDialogDescription = BaseAlertDialog.Description;
