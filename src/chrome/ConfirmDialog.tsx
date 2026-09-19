import { useEffect, useRef } from "react";
import { Modal } from "./Modal";

type Props = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get the red treatment. */
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms an action that cannot be undone. Cancel takes focus, so a stray
 * Enter or Space on a destructive control backs out instead of committing. The
 * rAF hop runs after Modal's own focus effect, which lands on its close button.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = false,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Modal size="sm" title={title} description={description} onClose={onCancel}>
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
    </Modal>
  );
}
