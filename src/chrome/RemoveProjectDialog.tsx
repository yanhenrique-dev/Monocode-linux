import { useEffect, useState } from "react";
import { prettyCwd } from "../lib/paths";
import { projectSessionCount } from "../lib/projectData";
import { useLocale } from "../lib/locale";
import { ConfirmDialog } from "./ConfirmDialog";

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
  const { t } = useLocale();

  useEffect(() => {
    let cancelled = false;
    void projectSessionCount(path).then((count) => {
      if (!cancelled) setSessions(count);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <ConfirmDialog
      title={t("settings.archive.dialog.title", { name })}
      description={t("settings.archive.dialog.body")}
      body={
        <>
          {sessions != null && sessions > 0 ? (
            <p className="mt-1 text-[12px] leading-snug text-content/45">
              {sessions === 1
                ? t("settings.archive.dialog.count_one")
                : t("settings.archive.dialog.count_other", {
                    count: sessions,
                  })}
            </p>
          ) : null}
          <p className="mt-1 truncate text-[11px] leading-tight text-content/40">
            {prettyCwd(path)}
          </p>
        </>
      }
      confirmLabel={t("settings.archive.dialog.confirm")}
      cancelLabel={t("settings.archive.dialog.cancel")}
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
