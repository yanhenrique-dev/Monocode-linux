import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LAYER } from "../lib/layers";
import { prettyCwd } from "../lib/paths";
import { projectSessionCount } from "../lib/projectData";
import { useLocale } from "../lib/locale";

type Props = {
  name: string;
  path: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Delete drops the project from the rail and its saved chats. The folder on
 * disk is left alone; opening it again brings the project back empty.
 */
export function RemoveProjectDialog({ name, path, onCancel, onConfirm }: Props) {
  const [sessions, setSessions] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { t } = useLocale();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void projectSessionCount(path).then((count) => {
      if (!cancelled) setSessions(count);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: LAYER.dialog }}>
      <div className="absolute inset-0 bg-black/30" onMouseDown={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.archive.dialog.aria_delete", { name })}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-[22%] flex w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-content/10 bg-content/5 p-4 shadow-xl glass-blur backdrop-blur-xl"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] font-medium leading-tight text-content">
            {t("settings.archive.dialog.title", { name })}
          </h2>
          <p className="text-[12px] leading-snug text-content/55">
            {t("settings.archive.dialog.body")}
          </p>
          {sessions != null && sessions > 0 ? (
            <p className="text-[12px] leading-snug text-content/45">
              {sessions === 1
                ? t("settings.archive.dialog.count_one")
                : t("settings.archive.dialog.count_other", {
                    count: sessions,
                  })}
            </p>
          ) : null}
          <p className="truncate text-[11px] leading-tight text-content/40">
            {prettyCwd(path)}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-[12px] text-content/70 hover:bg-content/8 hover:text-content"
          >
            {t("settings.archive.dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-500/20 px-3 py-1.5 text-[12px] font-medium text-red-300 hover:bg-red-500/30"
          >
            {t("settings.archive.dialog.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
