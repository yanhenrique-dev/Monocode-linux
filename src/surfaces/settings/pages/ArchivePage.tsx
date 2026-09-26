import { Search, X } from "../../../chrome/icons";
import { useEffect, useMemo, useState } from "react";
import { HarnessIcon } from "../../../chrome/HarnessIcon";
import { ConfirmDialog } from "../../../chrome/ConfirmDialog";
import { SecondaryButton } from "../../../chrome/SecondaryButton";
import { RemoveProjectDialog } from "../../../chrome/RemoveProjectDialog";
import { prettyCwd, projectKey, projectName } from "../../../lib/paths";
import { formatShortDate } from "../../../lib/displayFormat";
import {
  loadArchivedProjects,
  looksLikeProject,
  subscribeArchivedProjects,
  type ArchivedProject,
} from "../../../lib/recents";
import { sessionDisplayTitle } from "../../../lib/session";
import {
  loadSessionSidebarFilters,
  saveSessionSidebarFilters,
  subscribeSessionSidebarFilters,
} from "../../../lib/sessionFilters";
import { SessionSummary } from "../../../lib/sessionStore";
import {
  loadTabGroupLabels,
  resolveTabGroupLabel,
} from "../../../lib/tabGroups";
import { useLocale } from "../../../lib/locale";
import { Group, Row } from "../../settings/SettingsChrome";
import { Toggle } from "../../settings/SettingsControls";

export function ArchivePage({
  cwd,
  sessions,
  onOpenSession,
  onArchiveSession,
  onDeleteSession,
  onRestoreProject,
  onDeleteProject,
}: {
  cwd: string;
  sessions: SessionSummary[];
  onOpenSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreProject?: (path: string) => void;
  onDeleteProject?: (path: string) => void;
}) {
  const [filters, setFilters] = useState(loadSessionSidebarFilters);
  // A toggle flipped in the sidebar menu (or another window) re-reads the
  // store so this page never shows a stale filter.
  useEffect(
    () =>
      subscribeSessionSidebarFilters(() =>
        setFilters(loadSessionSidebarFilters()),
      ),
    [],
  );
  const [deletingProject, setDeletingProject] =
    useState<ArchivedProject | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionSummary | null>(
    null,
  );
  const archivedProjects = useArchivedProjects();
  const archived = useMemo(
    () =>
      sessions
        .filter((session) => session.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );
  const [sessionQuery, setSessionQuery] = useState("");
  const visibleArchived = useMemo(() => {
    const needle = sessionQuery.trim().toLowerCase();
    if (!needle) return archived;
    return archived.filter((session) =>
      sessionDisplayTitle(session.title, session.harness)
        .toLowerCase()
        .includes(needle),
    );
  }, [archived, sessionQuery]);

  const onShowArchived = (showArchived: boolean) => {
    const next = { ...filters, showArchived };
    saveSessionSidebarFilters(next);
    setFilters(next);
  };
  const { t } = useLocale();

  return (
    <>
      <Group
        title={t("settings.archive.projects.title")}
        description={t("settings.archive.projects.description")}
      >
        {archivedProjects.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-content/60">
            {t("settings.archive.projects.empty")}
          </p>
        ) : (
          archivedProjects.map((project) => (
            <div
              key={project.path}
              className="flex items-center gap-4 border-b border-content/10 px-4 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {archivedProjectLabel(project.path)}
                </div>
                <div className="truncate text-xs text-content/60">
                  {prettyCwd(project.path)}
                </div>
              </div>
              {onRestoreProject ? (
                <SecondaryButton onClick={() => onRestoreProject(project.path)}>
                  {t("settings.archive.projects.restore")}
                </SecondaryButton>
              ) : null}
              {onDeleteProject ? (
                <SecondaryButton
                  danger
                  onClick={() => setDeletingProject(project)}
                >
                  {t("settings.archive.projects.delete")}
                </SecondaryButton>
              ) : null}
            </div>
          ))
        )}
      </Group>

      <Group
        title={
          looksLikeProject(cwd)
            ? t("settings.archive.sessions.title_in_project", {
                projectName: projectName(cwd),
              })
            : t("settings.archive.sessions.title")
        }
        action={
          <label className="flex h-7 w-44 shrink-0 items-center gap-2 rounded-md border border-content/10 px-2 text-content/45 focus-within:border-content/20">
            <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
            <input
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
              placeholder={t("settings.archive.sessions.filter_placeholder")}
              aria-label={t("settings.archive.sessions.filter_aria")}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
            />
            {sessionQuery ? (
              <button
                type="button"
                aria-label={t("settings.search.clear")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSessionQuery("")}
                className="grid size-4 shrink-0 place-items-center rounded text-content/45 hover:text-content"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            ) : null}
          </label>
        }
      >
        <Row
          id="show-archived"
          label={t("settings.archive.show_archived.label")}
          description={t("settings.archive.show_archived.description")}
        >
          <Toggle
            label={t("settings.archive.show_archived.toggle")}
            on={filters.showArchived}
            onChange={onShowArchived}
          />
        </Row>
        {!looksLikeProject(cwd) ? (
          <p className="px-4 py-4 text-[12px] text-content/60">
            {t("settings.archive.sessions.empty_no_project")}
          </p>
        ) : archived.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-content/60">
            {t("settings.archive.sessions.empty")}
          </p>
        ) : visibleArchived.length === 0 ? (
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {t("settings.archive.sessions.empty_no_match")}
          </p>
        ) : (
          visibleArchived.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-4 border-b border-content/10 px-4 py-2 last:border-b-0"
            >
              <HarnessIcon
                harness={session.harness}
                className="size-3.5 shrink-0"
              />
              <button
                type="button"
                onClick={() => onOpenSession(session.id)}
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-content"
              >
                {sessionDisplayTitle(session.title, session.harness)}
              </button>
              <span className="shrink-0 text-xs text-content/60 tabular-nums">
                {formatShortDate(session.updatedAt)}
              </span>
              <SecondaryButton
                onClick={() => onArchiveSession(session.id, false)}
              >
                {t("settings.archive.sessions.unarchive")}
              </SecondaryButton>
              <SecondaryButton
                danger
                onClick={() => setDeletingSession(session)}
              >
                {t("settings.archive.sessions.delete")}
              </SecondaryButton>
            </div>
          ))
        )}
      </Group>

      {deletingProject ? (
        <RemoveProjectDialog
          name={archivedProjectLabel(deletingProject.path)}
          path={deletingProject.path}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => {
            onDeleteProject?.(deletingProject.path);
            setDeletingProject(null);
          }}
        />
      ) : null}

      {deletingSession ? (
        <ConfirmDialog
          title={t("settings.archive.sessions.delete_title", {
            name: sessionDisplayTitle(
              deletingSession.title,
              deletingSession.harness,
            ),
          })}
          description={t("settings.archive.sessions.delete_description")}
          confirmLabel={t("settings.archive.dialog.confirm")}
          cancelLabel={t("settings.archive.dialog.cancel")}
          danger
          onCancel={() => setDeletingSession(null)}
          onConfirm={() => {
            onDeleteSession(deletingSession.id);
            setDeletingSession(null);
          }}
        />
      ) : null}
    </>
  );
}

/** @deprecated Import `formatShortDate` from `../lib/displayFormat`. */

function useArchivedProjects(): ArchivedProject[] {
  const [items, setItems] = useState(loadArchivedProjects);
  useEffect(
    () => subscribeArchivedProjects(() => setItems(loadArchivedProjects())),
    [],
  );
  return items;
}

function archivedProjectLabel(path: string): string {
  return resolveTabGroupLabel(
    projectKey(path),
    loadTabGroupLabels(),
    projectName(path),
  );
}
