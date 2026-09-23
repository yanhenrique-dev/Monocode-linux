import type { GitFileDiffKind, GitHistoryCommit } from "../../lib/fs";
import type { HarnessId } from "../../lib/session";
import type { SessionReminder } from "../../lib/sessionReminders";
import type { LiveAgent } from "../../lib/liveAgents";
import type { LinkedWorkItem } from "../../lib/session";
import type { InstalledUpdate } from "../../lib/updateNotice";
import type { OpenFileFn } from "../../lib/search";
import type { RecentProject } from "../../lib/recents";
import type { SessionSummary } from "../../lib/sessionStore";
import type { SettingsSectionId } from "../../lib/settings";
import type { SidebarTabId } from "../../lib/appearance";
import type { PaneEdge } from "../../lib/layout";

/** Callbacks that operate on sessions: select, navigate, prefetch, mutate. */
export type SessionActions = {
  onSelectSession: (sessionId: string) => void;
  onSessionNavigationOrder?: (ids: readonly string[]) => void;
  onPrefetchSession?: (sessionId: string) => void;
  onPlaceSessionOnPane?: (
    sessionId: string,
    targetId: string,
    edge: PaneEdge,
  ) => void;
  onRenameSession?: (sessionId: string, title: string) => void;
  onArchiveSession?: (sessionId: string, archived: boolean) => void;
  onArchiveSessions?: (
    sessionIds: readonly string[],
    archived: boolean,
  ) => void;
  onPinSession?: (sessionId: string, pinned: boolean) => void;
  onPinSessions?: (sessionIds: readonly string[], pinned: boolean) => void;
  onDeleteSession?: (sessionId: string) => void;
  onDeleteSessions?: (sessionIds: readonly string[]) => void;
};

/** Callbacks for files, diffs, terminals and navigation chrome. */
export type WorkspaceActions = {
  onOpenFile: OpenFileFn;
  onOpenTerminal?: (cwd: string) => void;
  onFileMoved?: (from: string, to: string) => void;
  onFileDeleted?: (path: string) => void;
  onOpenDiff?: (path: string, kind?: GitFileDiffKind) => void;
  onOpenAllChanges?: () => void;
  onOpenCommit?: (commit: GitHistoryCommit) => void;
  onGoBack?: () => void;
  onGoForward?: () => void;
};

/** Callbacks for projects, search, inbox, notes and settings entry points. */
export type ProjectActions = {
  onSelectAgent?: (sessionId: string) => void;
  onSelectProject?: (path: string) => void;
  onOpenProject?: () => void;
  onRemoveProject?: (path: string, options: { purgeData: boolean }) => void;
  onNew?: () => string | void;
  onNewTerminal?: () => void;
  onSearch?: () => void;
  onOpenInbox?: () => void;
  onOpenInboxItem?: (item: LinkedWorkItem, sessionId: string) => void;
  onOpenNotes?: () => void;
  onGoToFile?: () => void;
  onToggleProjectRail?: () => void;
  onOpenSettings?: () => void;
  onOpenNotificationSettings?: (projectPath?: string) => void;
  onSelectSettingsSection?: (section: SettingsSectionId) => void;
  onCloseSettings?: () => void;
  onOpenWhatsNew?: (version: string) => void;
  onDismissUpdate?: () => void;
};

/** Reminder scheduling callbacks. */
export type ReminderActions = {
  reminders?: readonly SessionReminder[];
  onSetReminders?: (sessionIds: readonly string[], dueAt: number) => void;
  onCancelReminders?: (sessionIds: readonly string[]) => void;
};

export type SidebarProps = {
  cwd: string;
  /** Working copy for Changes / explorer git. Falls back to `cwd`. */
  gitCwd?: string;
  /** Branch identity shown for a worktree whose folder has a temporary name. */
  explorerRootLabel?: string;
  open: boolean;
  sessions: SessionSummary[];
  busySessionIds: Set<string>;
  approvalSessionIds: Set<string>;
  activeSessionId?: string;
  /** Open tabs, including blank ones not yet in history. */
  openSessions?: readonly SessionSummary[];
  status: "idle" | "error";
  /** First listing for this project has not arrived yet. */
  pending: boolean;
  tab: SidebarTabId;
  onTabChange: (tab: SidebarTabId) => void;
  filesSearchOpen: boolean;
  onFilesSearchOpenChange: (open: boolean) => void;
  onOpenFilesSearch?: () => void;
  searchFocusToken?: number;
  canGoBack?: boolean;
  canGoForward?: boolean;
  selectedDiffPath?: string;
  selectedDiffKind?: GitFileDiffKind;
  selectedCommitSha?: string;
  textHarness?: HarnessId;
  onShowSourceControl?: () => void;
  recents?: RecentProject[];
  busyProjectPaths?: Iterable<string>;
  liveAgents?: LiveAgent[];
  searchActive?: boolean;
  inboxActive?: boolean;
  notesActive?: boolean;
  notesEnabled?: boolean;
  projectRailOpen?: boolean;
  unseenFinishedIds?: Set<string>;
  inboxUnseen?: boolean;
  /** Linked GitHub work changed after the session last advanced. */
  linkedSessionUpdateIds?: ReadonlySet<string>;
  settingsOpen?: boolean;
  settingsSection?: SettingsSectionId;
  updateNotice?: InstalledUpdate | null;
} & SessionActions &
  WorkspaceActions &
  ProjectActions &
  ReminderActions;
