import { RotateCcw } from "../chrome/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../chrome/ConfirmDialog";
import { WindowControls } from "../chrome/WindowControls";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import { SECRET_REVEAL_MS } from "../lib/uiTimings";
import type { SessionSummary } from "../lib/sessionStore";
import { useLocale } from "../lib/locale";
import { removeWorktree, type RemoveWorktree } from "../lib/worktrees";
import {
  SETTINGS_INDEX,
  settingsSectionDescription,
  settingsSectionLabel,
  type SettingsAnchor,
  type SettingsSectionId,
} from "../lib/settings";
import type { Session } from "../lib/session";
import type { RecentProject } from "../lib/recents";
import { SettingsSearch } from "./settings/SettingsSearch";
import {
  PageHeader,
  RevealedSetting,
  settingDomId,
} from "./settings/SettingsChrome";
import { GeneralPage } from "./settings/pages/GeneralPage";
import { NotificationsPage } from "./settings/pages/NotificationsPage";
import { PerformancePage } from "./settings/pages/PerformancePage";
import { AppearancePage } from "./settings/pages/AppearancePage";
import { ChatPage } from "./settings/pages/ChatPage";
import { KeybindingsPage } from "./settings/pages/KeybindingsPage";
import { ProvidersPage } from "./settings/pages/ProvidersPage";
import { InboxPage } from "./settings/pages/InboxPage";
import { ExperimentalPage } from "./settings/pages/ExperimentalPage";
import { ArchivePage } from "./settings/pages/ArchivePage";
import { SkillsPage } from "./settings/pages/SkillsPage";
import { WorktreesPage } from "./settings/pages/WorktreesPage";

type Props = {
  section: SettingsSectionId;
  /** Card to scroll to; the General page is too long to land at the top. */
  anchor?: SettingsAnchor | null;
  /** Project to focus when opening notification settings from a quick action. */
  notificationProjectPath?: string | null;
  /** Changes for each quick action, including repeated requests for one project. */
  notificationSettingsRequest?: number;
  recents?: RecentProject[];
  cwd: string;
  sessions: SessionSummary[];
  liveSessions?: Session[];
  onRemoveWorktree?: RemoveWorktree;
  onCheckWorktreeRemoval?: RemoveWorktree;
  onDeleteWorktreeSessions?: (
    sessionIds: readonly string[],
  ) => Promise<boolean>;
  onClose: () => void;
  /** Lets search jump to a setting that lives on another page. */
  onSelectSection?: (section: SettingsSectionId) => void;
  onOpenSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onRestoreProject?: (path: string) => void;
  onDeleteProject?: (path: string) => void;
  onOpenWhatsNew: (version: string) => void;
};

/**
 * Settings shell: header, search, the restore-confirmation dialog, and the
 * section switch. Each page owns its own rows and its own state -- a slider
 * drag must not re-render the header, the search box, or a sibling page.
 */
export function SettingsView({
  section,
  anchor = null,
  notificationProjectPath = null,
  notificationSettingsRequest = 0,
  recents,
  cwd,
  sessions,
  liveSessions,
  onRemoveWorktree = removeWorktree,
  onCheckWorktreeRemoval,
  onDeleteWorktreeSessions,
  onClose,
  onSelectSection,
  onOpenSession,
  onArchiveSession,
  onDeleteSession,
  onRestoreProject,
  onDeleteProject,
  onOpenWhatsNew,
}: Props) {
  const { t } = useLocale();
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const [revealed, setRevealed] = useState<string | null>(anchor);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const restoreAppearanceRef = useRef(() => {});
  const onRestoreAppearanceReady = useCallback((restore: () => void) => {
    restoreAppearanceRef.current = restore;
  }, []);

  useEffect(() => setRevealed(anchor), [anchor, notificationSettingsRequest]);

  // Announced when search lands on a setting, so screen readers follow the jump.
  const revealedEntry = revealed
    ? SETTINGS_INDEX.find((entry) => entry.id === revealed)
    : undefined;
  const revealedAnnouncement = revealedEntry
    ? t(revealedEntry.label)
    : revealed
      ? t(settingsSectionLabel(section))
      : "";

  // Section is a dependency so a search result on another page scrolls once
  // that page has mounted the row.
  useEffect(() => {
    if (!revealed) return;
    // A project quick action lets the project card focus itself after discovery.
    if (!(revealed === "project-notifications" && notificationProjectPath)) {
      const target = document.getElementById(settingDomId(revealed));
      target?.scrollIntoView?.({ block: "center" });
      // Move focus so keyboard and screen-reader users land on the row.
      // Group/Row carry tabIndex -1: focusable programmatically, never by Tab.
      target?.focus?.({ preventScroll: true });
    }
    const timer = window.setTimeout(() => setRevealed(null), SECRET_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, section, notificationProjectPath, notificationSettingsRequest]);

  const onReveal = useCallback(
    (next: SettingsSectionId, settingId: string | null) => {
      if (next !== section) onSelectSection?.(next);
      setRevealed(settingId);
    },
    [onSelectSection, section],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    // Let dialogs and other Settings controls handle Escape first.
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      role="region"
      aria-label={t("settings.header.region_aria")}
      data-app-settings
      className="flex min-h-0 min-w-0 flex-1 flex-col text-content"
    >
      <div
        className="flex h-10 shrink-0 select-none items-center border-b border-stroke"
        data-tauri-drag-region="deep"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm">
          <span className="shrink-0 text-content/60">
            {t("settings.header.breadcrumb")}
          </span>
          <span aria-hidden className="shrink-0 text-content/25">
            /
          </span>
          <span className="min-w-0 truncate text-content">
            {t(settingsSectionLabel(section))}
          </span>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 pr-2"
          data-tauri-drag-region="false"
        >
          {section === "appearance" ? (
            <button
              type="button"
              onClick={() => setConfirmingRestore(true)}
              className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-[12px] text-content/60 hover:bg-content/10 hover:text-content"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              {t("settings.header.restore_defaults")}
            </button>
          ) : null}
          <SettingsSearch onReveal={onReveal} />
        </div>
        <WindowControls />
      </div>

      <div aria-live="polite" className="sr-only">
        {revealedAnnouncement}
      </div>

      {confirmingRestore ? (
        <ConfirmDialog
          title={t("settings.appearance.restore_defaults.confirm_title")}
          description={t(
            "settings.appearance.restore_defaults.confirm_description",
          )}
          confirmLabel={t(
            "settings.appearance.restore_defaults.confirm_action",
          )}
          cancelLabel={t("settings.archive.dialog.cancel")}
          danger
          onCancel={() => setConfirmingRestore(false)}
          onConfirm={() => {
            setConfirmingRestore(false);
            restoreAppearanceRef.current();
          }}
        />
      ) : null}

      {section === "skills" ? (
        <SkillsPage
          key={cwd}
          cwd={cwd}
          header={
            <PageHeader
              title={t(settingsSectionLabel(section))}
              description={t(settingsSectionDescription(section))}
            />
          }
        />
      ) : (
        <RevealedSetting.Provider value={revealed}>
          <div
            ref={lockOverscroll}
            className="@container/settings min-h-0 flex-1 overflow-y-auto overscroll-none"
          >
            <div className="mx-auto w-full max-w-5xl px-5 py-6 pb-16 @min-[560px]/settings:px-8 @min-[560px]/settings:py-8">
              <PageHeader
                title={t(settingsSectionLabel(section))}
                description={t(settingsSectionDescription(section))}
              />
              {section === "general" ? (
                <GeneralPage onOpenWhatsNew={onOpenWhatsNew} />
              ) : null}
              {section === "notifications" ? (
                <NotificationsPage
                  cwd={cwd}
                  recents={recents}
                  notificationProjectPath={notificationProjectPath}
                  notificationSettingsRequest={notificationSettingsRequest}
                />
              ) : null}
              {section === "performance" ? <PerformancePage /> : null}
              {section === "appearance" ? (
                <AppearancePage
                  onRestoreReady={onRestoreAppearanceReady}
                  onOpenSection={onSelectSection}
                />
              ) : null}
              {section === "chat" ? <ChatPage /> : null}
              {section === "keybindings" ? <KeybindingsPage /> : null}
              {section === "providers" ? <ProvidersPage /> : null}
              {section === "worktrees" ? (
                <WorktreesPage
                  cwd={cwd}
                  recents={recents}
                  liveSessions={liveSessions}
                  onRemove={onRemoveWorktree}
                  onCheckRemove={onCheckWorktreeRemoval}
                  onDeleteSessions={onDeleteWorktreeSessions}
                />
              ) : null}
              {section === "inbox" ? <InboxPage /> : null}
              {section === "experimental" ? <ExperimentalPage /> : null}
              {section === "archive" ? (
                <ArchivePage
                  cwd={cwd}
                  sessions={sessions}
                  onOpenSession={onOpenSession}
                  onArchiveSession={onArchiveSession}
                  onDeleteSession={onDeleteSession}
                  onRestoreProject={onRestoreProject}
                  onDeleteProject={onDeleteProject}
                />
              ) : null}
            </div>
          </div>
        </RevealedSetting.Provider>
      )}
    </div>
  );
}
