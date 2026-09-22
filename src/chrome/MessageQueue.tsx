import { useEffect, useRef, useState } from "react";
import {
  Check,
  CornerDownRight,
  ListEnd,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "./icons";
import { isImeComposition } from "../lib/keyboard";
import type { MessageQueueStatus, QueuedMessage } from "../lib/session";

/**
 * Queued follow-up messages, rendered above the composer.
 *
 * Lives in the session dock above the tasks strip (not inside the
 * composer) so queued text reads as upcoming turns, not as composer chrome.
 */
export function MessageQueue({
  messages,
  status,
  onDelete,
  onEdit,
  onEditingChange,
  onSteer,
  onResume,
}: {
  messages: QueuedMessage[];
  status?: MessageQueueStatus;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, text: string) => void;
  onEditingChange?: (messageId?: string) => void;
  onSteer?: (messageId: string) => void;
  onResume?: () => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState("");
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  useEffect(() => {
    return () => {
      if (editingIdRef.current) onEditingChangeRef.current?.();
    };
  }, []);
  if (messages.length === 0) return null;
  const paused = status === "paused";

  const startEdit = (message: QueuedMessage) => {
    setEditingId(message.id);
    setEditDraft(message.text);
    onEditingChange?.(message.id);
  };
  const cancelEdit = () => {
    setEditingId(undefined);
    setEditDraft("");
    onEditingChange?.();
  };
  const saveEdit = (message: QueuedMessage) => {
    if (!editDraft.trim() && message.attachments.length === 0) return;
    onEdit?.(message.id, editDraft);
    setEditingId(undefined);
    setEditDraft("");
  };

  return (
    <div className="px-1.5 text-content/55" data-message-queue>
      <div
        className="relative z-0 rounded-t-[10px] border border-b-0 border-content/10 bg-content/3 px-2 py-1"
        data-message-queue-card
      >
        {paused ? (
          <div className="flex h-7 items-center gap-2 border-b border-stroke text-[12px]">
            <Pause className="size-3.5" />
            <span className="min-w-0 flex-1 truncate">
              Queue paused because you interrupted
            </span>
            <button
              type="button"
              onClick={onResume}
              className="flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-content/10 hover:text-content"
            >
              <Play className="size-3.5" />
              Resume
            </button>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const editing = editingId === message.id;
          const label =
            message.text.trim() ||
            `${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}`;
          return (
            <div
              key={message.id}
              className={`flex min-h-7 items-center gap-2 text-[12px] ${
                index > 0 ? "border-t border-stroke" : ""
              }`}
            >
              <ListEnd className="size-3.5 shrink-0" />
              {editing ? (
                <>
                  <textarea
                    autoFocus
                    aria-label="Edit queued message"
                    value={editDraft}
                    rows={1}
                    onChange={(event) => setEditDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (isImeComposition(event.nativeEvent)) return;
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      } else if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        saveEdit(message);
                      }
                    }}
                    className="min-h-6 min-w-0 flex-1 resize-none rounded-md border border-content/15 bg-content/5 px-1.5 py-0.5 text-[12px] text-content outline-none focus:border-content/30"
                  />
                  <button
                    type="button"
                    title="Save queued message"
                    aria-label="Save queued message"
                    disabled={
                      !editDraft.trim() && message.attachments.length === 0
                    }
                    onClick={() => saveEdit(message)}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content disabled:opacity-30"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Cancel queued message edit"
                    aria-label="Cancel queued message edit"
                    onClick={cancelEdit}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-content/80">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSteer?.(message.id)}
                    className="flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-content/10 hover:text-content"
                  >
                    <CornerDownRight className="size-3.5" />
                    Steer
                  </button>
                  <button
                    type="button"
                    title="Edit queued message"
                    aria-label="Edit queued message"
                    onClick={() => startEdit(message)}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Remove queued message"
                    aria-label="Remove queued message"
                    onClick={() => onDelete?.(message.id)}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
