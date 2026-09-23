import { useEffect, useRef, type ReactNode } from "react";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogPanel,
  AlertDialogPopup,
  AlertDialogPortal,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

type Props = {
  title: string;
  description?: string;
  /** Extra body content between the description and the actions. */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the red treatment. */
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms an action that cannot be undone. Cancel takes focus, so a stray
 * Enter or Space on a destructive control backs out instead of committing.
 * Backdrop presses never dismiss (alertdialog): choose Cancel explicitly.
 */
export function ConfirmDialog({
  title,
  description,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = false,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocus.current?.focus?.();
      previousFocus.current = null;
    };
  }, []);

  // Base AlertDialog never dismisses on its own; Escape stays an
  // explicit cancel like the old Modal backing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogPortal>
        <div className="modal-backdrop absolute inset-0 bg-black/40" />
        <AlertDialogPopup
          initialFocus={() => cancelRef.current ?? false}
          finalFocus={false}
        >
          <AlertDialogPanel>
            <div className="flex shrink-0 flex-col px-4 pt-3">
              <AlertDialogTitle className="text-2xl font-semibold leading-tight text-content">
                {title}
              </AlertDialogTitle>
              {description ? (
                <AlertDialogDescription className="mt-0.5 text-[12px] leading-snug text-content/50">
                  {description}
                </AlertDialogDescription>
              ) : null}
              {body}
            </div>
            <div ref={lockOverscroll} className="overflow-y-auto overscroll-none">
              <div className="flex justify-end gap-2 p-4">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onCancel}
                  className="rounded-md px-3 py-1.5 text-[12px] text-content/70 hover:bg-content/8 hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                    danger
                      ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      : "bg-content text-background-base hover:bg-content/80"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </AlertDialogPanel>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
