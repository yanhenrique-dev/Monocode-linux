import { openExternalBestEffort } from "../lib/openExternal";
import {
  ArrowDownCircle,
  Check,
  ChevronDown,
  File as FileIcon,
  ImagePlus,
  LoaderCircle,
  Play as PlayIcon,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "../chrome/icons";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { HarnessIcon } from "../chrome/HarnessIcon";
import {
  ColorPickerPopover,
  ColorSwatchRow,
} from "../chrome/ColorPickerPopover";
import { ConfirmDialog } from "../chrome/ConfirmDialog";
import { Popover } from "../chrome/Popover";
import { SecondaryButton } from "../chrome/SecondaryButton";
import { InboxProviderMark } from "../chrome/InboxProviderMark";
import { RemoveProjectDialog } from "../chrome/RemoveProjectDialog";
import { WindowControls } from "../chrome/WindowControls";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import { useColorScheme } from "../hooks/useColorScheme";
import {
  applyChatBackground,
  applyChatBackgroundBlur,
  applyChatBackgroundEmptyOpacity,
  applyChatBackgroundSessionOpacity,
  applyChatBackgroundScope,
  applyAccentColor,
  applyBodyGlass,
  applySidebarBlur,
  applySidebarOpacity,
  applyUiBlur,
  applyThemeDarkLightness,
  applyThemePreference,
  applyThemeTint,
  cancelSidebarBlurPreview,
  BODY_GLASS_DEFAULT,
  ACCENT_COLOR_DEFAULT,
  CHAT_BACKGROUND_BLUR_DEFAULT,
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT,
  CHAT_BACKGROUND_OPACITY_MAX,
  CHAT_BACKGROUND_OPACITY_MIN,
  CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT,
  CHAT_BACKGROUND_SCOPE_DEFAULT,
  THEME_PREFERENCE_DEFAULT,
  UI_BLUR_DEFAULT,
  chatBackgroundSrc,
  loadBodyGlass,
  loadAccentColor,
  loadChatBackgroundBlur,
  loadChatBackgroundEmptyOpacity,
  loadChatBackgroundPath,
  loadChatBackgroundSessionOpacity,
  loadChatBackgroundScope,
  loadThemeDarkLightness,
  loadThemePreference,
  loadSidebarBlur,
  loadSidebarOpacity,
  loadThemeHue,
  loadThemeSaturation,
  loadTranscriptLayout,
  loadTranscriptAnchor,
  loadTasksPill,
  loadUiBlur,
  previewSidebarBlur,
  saveBodyGlass,
  saveAccentColor,
  saveChatBackgroundBlur,
  saveChatBackgroundEmptyOpacity,
  saveChatBackgroundPath,
  saveChatBackgroundSessionOpacity,
  saveChatBackgroundScope,
  saveThemeDarkLightness,
  saveThemePreference,
  saveSidebarBlur,
  saveSidebarOpacity,
  saveThemeHue,
  saveThemeSaturation,
  saveTranscriptLayout,
  saveTranscriptAnchor,
  saveTasksPill,
  saveUiBlur,
  TRANSCRIPT_ANCHOR_CHANGE_EVENT,
  SIDEBAR_BLUR_DEFAULT,
  SIDEBAR_BLUR_MAX,
  SIDEBAR_BLUR_MIN,
  SIDEBAR_OPACITY_DEFAULT,
  SIDEBAR_OPACITY_MAX,
  SIDEBAR_OPACITY_MIN,
  THEME_DARK_LIGHTNESS_DEFAULT,
  THEME_DARK_LIGHTNESS_MAX,
  THEME_DARK_LIGHTNESS_MIN,
  THEME_HUE_DEFAULT,
  THEME_HUE_MAX,
  THEME_HUE_MIN,
  THEME_SATURATION_DEFAULT,
  THEME_SATURATION_MAX,
  THEME_SATURATION_MIN,
  type ThemePreference,
  type ChatBackgroundScope,
  type TranscriptLayout,
} from "../lib/appearance";
import {
  pickAndSaveChatBackground,
  removeChatBackground,
} from "../lib/chatBackground";
import {
  applyUiScale,
  loadUiScale,
  saveUiScale,
  subscribeUiScale,
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
} from "../lib/uiScale";
import {
  getHarnessAvailabilitySnapshot,
  harnessUnavailableHint,
  isHarnessAvailable,
  probeHarnessAvailability,
  subscribeHarnessAvailability,
} from "../lib/harness/availability";
import { refreshHarnessCatalogs } from "../lib/harness/registry";
import {
  defaultModelId,
  getModelSnapshot,
  isPickerProviderVisible,
  loadDefaultModels,
  loadLastModelChoice,
  modelsFor,
  resolveModel,
  saveDefaultModel,
  saveLastModelChoice,
  savePickerProviderVisible,
  subscribeModels,
} from "../lib/models";
import { prettyCwd, projectKey, projectName } from "../lib/paths";
import { IS_MAC, IS_WIN } from "../lib/platform";
import {
  loadArchivedProjects,
  looksLikeProject,
  subscribeArchivedProjects,
  type ArchivedProject,
  type RecentProject,
} from "../lib/recents";
import {
  HARNESSES,
  HARNESS_TITLE,
  sessionDisplayTitle,
  type HarnessId,
} from "../lib/session";
import {
  loadSessionSidebarFilters,
  saveSessionSidebarFilters,
} from "../lib/sessionFilters";
import type { SessionSummary } from "../lib/sessionStore";
import {
  clearInboxCache,
  githubStatus,
  type GithubStatus,
} from "../lib/githubTasks";
import {
  disconnectGitlab,
  gitlabConnected,
  saveGitlabConfig,
} from "../lib/gitlab";
import {
  disconnectLinear,
  LINEAR_CHANGE_EVENT,
  linearConnected,
  listLinearTeams,
  loadHiddenLinearTeamIds,
  notifyLinearChange,
  saveHiddenLinearTeamIds,
  saveLinearToken,
  type LinearTeam,
} from "../lib/linear";
import { loadTabGroupLabels, resolveTabGroupLabel } from "../lib/tabGroups";
import {
  applyLocale,
  getIntlLocale,
  saveLocale,
  useLocale,
  type Locale,
  type LocaleKey,
} from "../lib/locale";
import {
  filterKeybindings,
  KEYBINDINGS,
  keybindingWhenLabel,
  loadClaudeHooks,
  loadCloseToTray,
  loadComposerRunner,
  loadDiffViewer,
  loadFollowUpBehavior,
  loadGridArcadeEnabled,
  loadLiveAgentsEnabled,
  loadModelControls,
  loadNotesEnabled,
  loadReviewAdoptShell,
  loadTerminalGpu,
  saveClaudeHooks,
  saveCloseToTray,
  saveComposerRunner,
  saveDiffViewer,
  saveFollowUpBehavior,
  saveGridArcadeEnabled,
  saveLiveAgentsEnabled,
  saveModelControls,
  saveNotesEnabled,
  saveReviewAdoptShell,
  saveTerminalGpu,
  searchSettings,
  SETTINGS_INDEX,
  settingsSectionDescription,
  settingsSectionLabel,
  type DiffViewer,
  type FollowUpBehavior,
  type ModelControls,
  type SettingsSearchResult,
  type SettingsSectionId,
} from "../lib/settings";
import {
  loadHardwareAcceleration,
  saveHardwareAcceleration,
  subscribeHardwareAcceleration,
} from "../lib/hardwareAcceleration";
import {
  CUSTOMIZABLE_CUES,
  cueLabelKey,
  loadSoundPrefs,
  loadSoundsEnabled,
  playCue,
  saveSoundsEnabled,
  saveSoundPrefs,
  previewCue,
  SOUNDS_PREFS_EVENT,
  type CustomizableCue,
  type SoundPref,
} from "../lib/sounds";
import {
  pickSoundFile,
  playSoundFile,
  type SoundFileReason,
} from "../lib/soundFiles";
import {
  cachedNotificationPermission,
  loadNotificationsEnabled,
  openNotificationSettings,
  probeNotificationPermission,
  requestNotificationPermission,
  saveNotificationsEnabled,
  type NotificationPermission,
} from "../lib/notifications";
import {
  installPendingUpdate,
  isFlatpakSandbox,
  readAppVersion,
  runUpdateFlow,
  type UpdaterSnapshot,
} from "../lib/updater";

import { SkillsPage } from "./SkillsPage";
import { PetsSettings } from "./PetsSettings";
import { ProjectNotificationSettings } from "./ProjectNotificationSettings";
import { WorktreesPage } from "./WorktreesPage";
import { removeWorktree, type RemoveWorktree } from "../lib/worktrees";
import type { Session } from "../lib/session";

/**
 * The `data-setting-id` Settings should reveal when it opens: one of the ids in
 * `SETTINGS_INDEX`. Inbox integrations pass their provider id.
 */
export type SettingsAnchor = string;

const settingDomId = (id: string) => `setting-${id}`;

/** The row or group Settings just jumped to, so it can flash where you landed. */
const RevealedSetting = createContext<string | null>(null);

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
  besideRail?: boolean;
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
  besideRail = false,
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
  // Appearance state lives in AppearancePage, not here: a slider drag must
  // not re-render the header, the search box, or the other pages.
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
    const timer = window.setTimeout(() => setRevealed(null), 1800);
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
        {IS_MAC && !besideRail ? <div className="w-[78px] shrink-0" /> : null}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
          <span className="shrink-0 text-content/45">{t("settings.header.breadcrumb")}</span>
          <span aria-hidden className="shrink-0 text-content/25">
            /
          </span>
          <span className="min-w-0 truncate text-content">
            {t(settingsSectionLabel(section))}
          </span>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 pr-2"
          data-tauri-drag-region="false"
        >
          {section === "appearance" ? (
            <button
              type="button"
              onClick={() => setConfirmingRestore(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-content/50 hover:bg-content/10 hover:text-content"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
              {t("settings.header.restore_defaults")}
            </button>
          ) : null}
          <SettingsSearch onReveal={onReveal} />
        </div>
        {IS_MAC ? null : <WindowControls />}
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

/** Jumps to any setting by name, including ones on another page. */
function SettingsSearch({
  onReveal,
}: {
  onReveal: (section: SettingsSectionId, settingId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { locale, t } = useLocale();
  const results = useMemo(
    () => searchSettings(query, 8, locale),
    [query, locale],
  );
  const open = query.trim().length > 0;

  useEffect(() => setActive(0), [query]);

  const go = (result: SettingsSearchResult | undefined) => {
    if (!result) return;
    onReveal(result.section, result.settingId);
    setQuery("");
    input.current?.blur();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <label className="flex h-7 w-48 items-center gap-2 rounded-md border border-content/10 px-2 text-content/45 focus-within:border-content/20">
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
        <input
          ref={input}
          role="combobox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("settings.search.placeholder")}
          aria-label={t("settings.search.aria")}
          aria-expanded={open}
          aria-controls={listId}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("settings.search.clear")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            className="grid size-4 shrink-0 place-items-center rounded text-content/45 hover:text-content"
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        ) : null}
      </label>
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={300}
          maxHeight={320}
          onDismiss={(reason) => {
            setQuery("");
            if (reason === "escape") input.current?.focus();
          }}
          id={listId}
          role="listbox"
          aria-label={t("settings.search.results_aria")}
          className="overflow-y-auto overscroll-contain p-1"
        >
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-content/45">
              {t("settings.search.empty")}
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.section}:${result.settingId ?? "*"}`}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
                  index === active
                    ? "bg-selection text-content"
                    : "text-content hover:bg-content/5"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{result.label}</span>
                <span className="shrink-0 text-[11px] text-content/40">
                  {result.settingId
                    ? result.sectionLabel
                    : t("settings.search.page_badge")}
                </span>
              </button>
            ))
          )}
        </Popover>
      ) : null}
    </div>
  );
}

function GeneralPage({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const [notesEnabled, setNotesEnabled] = useState(loadNotesEnabled);
  const [reviewAdoptShell, setReviewAdoptShell] = useState(
    loadReviewAdoptShell,
  );
  const [liveAgentsEnabled, setLiveAgentsEnabled] = useState(
    loadLiveAgentsEnabled,
  );
  const [closeToTray, setCloseToTray] = useState(loadCloseToTray);
  const { locale, t } = useLocale();

  const onNotesEnabled = (next: boolean) => {
    saveNotesEnabled(next);
    setNotesEnabled(next);
  };

  const onReviewAdoptShell = (next: boolean) => {
    saveReviewAdoptShell(next);
    setReviewAdoptShell(next);
  };

  const onLiveAgentsEnabled = (next: boolean) => {
    saveLiveAgentsEnabled(next);
    setLiveAgentsEnabled(next);
  };

  const onCloseToTray = (next: boolean) => {
    saveCloseToTray(next);
    setCloseToTray(next);
  };

  const onLanguage = (value: string) => {
    const next: Locale = value === "pt-BR" ? "pt-BR" : "en";
    saveLocale(next);
    applyLocale(next);
  };

  return (
    <>
      <Group
        title={t("settings.general.workspace.title")}
        description={t("settings.general.workspace.description")}
      >
        <Row
          id="notes"
          label={t("settings.general.notes.label")}
          description={t("settings.general.notes.description")}
        >
          <Toggle
            label={t("settings.general.notes.toggle")}
            on={notesEnabled}
            onChange={onNotesEnabled}
          />
        </Row>
        <Row
          id="working-agents"
          label={t("settings.general.working_agents.label")}
          description={t("settings.general.working_agents.description")}
        >
          <Toggle
            label={t("settings.general.working_agents.toggle")}
            on={liveAgentsEnabled}
            onChange={onLiveAgentsEnabled}
          />
        </Row>
        <Row
          id="session-review-shell"
          label={t("settings.general.session_review_shell.label")}
          description={t("settings.general.session_review_shell.description")}
        >
          <Toggle
            label={t("settings.general.session_review_shell.toggle")}
            on={reviewAdoptShell}
            onChange={onReviewAdoptShell}
          />
        </Row>
        {IS_WIN && (
          <Row
            id="close-to-tray"
            label={t("settings.general.close_to_tray.label")}
            description={t("settings.general.close_to_tray.description")}
          >
            <Toggle
              label={t("settings.general.close_to_tray.toggle")}
              on={closeToTray}
              onChange={onCloseToTray}
            />
          </Row>
        )}
      </Group>

      <Group title={t("settings.general.about.title")}>
        <UpdateRow onOpenWhatsNew={onOpenWhatsNew} />
        <Row
          id="language"
          label={t("settings.general.language.label")}
          description={t("settings.general.language.description")}
        >
          <Select
            label={t("settings.general.language.label")}
            value={locale}
            options={[
              {
                value: "en",
                label: t("settings.general.language.option.english"),
              },
              {
                value: "pt-BR",
                label: t("settings.general.language.option.portuguese"),
              },
            ]}
            onChange={onLanguage}
          />
        </Row>
      </Group>
    </>
  );
}

function NotificationsPage({
  cwd,
  recents,
  notificationProjectPath,
  notificationSettingsRequest,
}: {
  cwd: string;
  recents?: RecentProject[];
  notificationProjectPath?: string | null;
  notificationSettingsRequest?: number;
}) {
  const [soundsEnabled, setSoundsEnabled] = useState(loadSoundsEnabled);
  const [soundPrefs, setSoundPrefs] = useState(loadSoundPrefs);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    loadNotificationsEnabled,
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(cachedNotificationPermission);
  const revealed = useContext(RevealedSetting);
  const { t } = useLocale();

  // The user may flip the switch in System Settings and come back: re-read
  // the OS state whenever the window regains focus while the toggle is on.
  useEffect(() => {
    if (!notificationsEnabled) return;
    const refresh = () => {
      void probeNotificationPermission().then(setNotificationPermission);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [notificationsEnabled]);

  const onSoundsEnabled = (next: boolean) => {
    saveSoundsEnabled(next);
    setSoundsEnabled(next);
  };

  useEffect(() => {
    const sync = () => setSoundPrefs(loadSoundPrefs());
    window.addEventListener(SOUNDS_PREFS_EVENT, sync);
    return () => window.removeEventListener(SOUNDS_PREFS_EVENT, sync);
  }, []);

  const onSoundPref = (cue: CustomizableCue, pref: SoundPref) => {
    saveSoundPrefs({ [cue]: pref });
    setSoundPrefs(loadSoundPrefs());
  };

  const onNotificationsEnabled = (next: boolean) => {
    saveNotificationsEnabled(next);
    setNotificationsEnabled(next);
    if (!next) return;
    void requestNotificationPermission().then(setNotificationPermission);
  };

  return (
    <>
      <Group
        title={t("settings.general.alerts.title")}
        description={t("settings.general.alerts.description")}
      >
        <Row
          id="sounds"
          label={t("settings.general.sounds.label")}
          description={t("settings.general.sounds.description")}
        >
          <Toggle
            label={t("settings.general.sounds.toggle")}
            on={soundsEnabled}
            onChange={onSoundsEnabled}
          />
        </Row>
        <Row
          id="notifications"
          label={t("settings.general.notifications.label")}
          description={t("settings.general.notifications.description")}
        >
          {notificationsEnabled && notificationPermission === "denied" ? (
            <NotificationsBlocked />
          ) : null}
          {notificationsEnabled && notificationPermission === "unsupported" ? (
            <span className="text-[12px] text-content/45">
              {t("settings.general.notifications.unsupported")}
            </span>
          ) : null}
          <Toggle
            label={t("settings.general.notifications.toggle")}
            on={
              notificationsEnabled &&
              notificationPermission !== "unsupported"
            }
            onChange={onNotificationsEnabled}
            disabled={notificationPermission === "unsupported"}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.general.sounds.custom.title")}
        description={t("settings.general.sounds.custom.description")}
      >
        {CUSTOMIZABLE_CUES.map((cue) => (
          <SoundCueRow
            key={cue}
            cue={cue}
            pref={soundPrefs[cue] ?? "preset"}
            onPref={onSoundPref}
          />
        ))}
      </Group>

      <div
        id={settingDomId("project-notifications")}
        data-setting-id="project-notifications"
        // Focus target for search reveals: programmatic focus only, never Tab.
        tabIndex={-1}
      >
        <ProjectNotificationSettings
          cwd={cwd}
          recents={recents}
          notificationProjectPath={notificationProjectPath}
          notificationSettingsRequest={notificationSettingsRequest}
          highlighted={revealed === "project-notifications"}
        />
      </div>
    </>
  );
}

function PerformancePage() {
  const [hardwareAcceleration, setHardwareAcceleration] = useState(
    loadHardwareAcceleration,
  );
  const [terminalGpu, setTerminalGpu] = useState(loadTerminalGpu);
  const { t } = useLocale();

  const onHardwareAcceleration = (next: boolean) => {
    saveHardwareAcceleration(next);
    setHardwareAcceleration(next);
  };

  const onTerminalGpu = (next: boolean) => {
    saveTerminalGpu(next);
    setTerminalGpu(next);
  };

  return (
    <>
      <Group
        title={t("settings.general.performance.title")}
        description={t("settings.general.performance.description")}
      >
        <Row
          id="hardware-acceleration"
          label={t("settings.general.hardware_acceleration.label")}
          description={t("settings.general.hardware_acceleration.description")}
        >
          <Toggle
            label={t("settings.general.hardware_acceleration.toggle")}
            on={hardwareAcceleration}
            onChange={onHardwareAcceleration}
          />
        </Row>
        <Row
          id="terminal-gpu"
          label={t("settings.general.terminal_gpu.label")}
          description={t("settings.general.terminal_gpu.description")}
        >
          <Toggle
            label={t("settings.general.terminal_gpu.toggle")}
            on={terminalGpu}
            onChange={onTerminalGpu}
            disabled={!hardwareAcceleration}
          />
        </Row>
      </Group>
    </>
  );
}

function ChatPage() {
  const [transcriptLayout, setTranscriptLayout] =
    useState<TranscriptLayout>(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] =
    useState(loadTranscriptAnchor);
  const [tasksPill, setTasksPill] = useState(loadTasksPill);
  const [followUpBehavior, setFollowUpBehavior] =
    useState<FollowUpBehavior>(loadFollowUpBehavior);
  const [modelControls, setModelControls] =
    useState<ModelControls>(loadModelControls);
  const [diffViewer, setDiffViewer] = useState<DiffViewer>(loadDiffViewer);
  const [composerRunner, setComposerRunner] = useState(loadComposerRunner);
  const [gridArcadeEnabled, setGridArcadeEnabled] = useState(
    loadGridArcadeEnabled,
  );
  const { t } = useLocale();

  useEffect(() => {
    const onAnchor = (event: Event) => {
      setTranscriptAnchor((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    return () => {
      window.removeEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    };
  }, []);

  const onTranscriptLayout = (next: TranscriptLayout) => {
    saveTranscriptLayout(next);
    setTranscriptLayout(next);
  };

  const onTranscriptAnchor = (next: boolean) => {
    saveTranscriptAnchor(next);
    setTranscriptAnchor(next);
  };

  const onTasksPill = (next: boolean) => {
    saveTasksPill(next);
    setTasksPill(next);
  };

  const onFollowUpBehavior = (next: FollowUpBehavior) => {
    saveFollowUpBehavior(next);
    setFollowUpBehavior(next);
  };

  const onModelControls = (next: ModelControls) => {
    saveModelControls(next);
    setModelControls(next);
  };

  const onDiffViewer = (next: DiffViewer) => {
    saveDiffViewer(next);
    setDiffViewer(next);
  };

  const onComposerRunner = (next: boolean) => {
    saveComposerRunner(next);
    setComposerRunner(next);
  };

  const onGridArcadeEnabled = (next: boolean) => {
    saveGridArcadeEnabled(next);
    setGridArcadeEnabled(next);
  };

  return (
    <>
      <Group
        title={t("settings.chat.transcript.title")}
        description={t("settings.chat.transcript.description")}
      >
        <Row
          id="transcript-layout"
          label={t("settings.chat.transcript_layout.label")}
          description={t("settings.chat.transcript_layout.description")}
        >
          <Segmented
            label={t("settings.chat.transcript_layout.selector")}
            value={transcriptLayout}
            options={[
              {
                value: "full",
                label: t("settings.chat.transcript_layout.full"),
              },
              {
                value: "chat",
                label: t("settings.chat.transcript_layout.chat"),
              },
            ]}
            onChange={onTranscriptLayout}
          />
        </Row>
        <Row
          id="anchor-prompts"
          label={t("settings.chat.anchor_prompts.label")}
          description={t("settings.chat.anchor_prompts.description")}
        >
          <Toggle
            label={t("settings.chat.anchor_prompts.toggle")}
            on={transcriptAnchor}
            onChange={onTranscriptAnchor}
          />
        </Row>
        <Row
          id="tasks-pill"
          label={t("settings.chat.tasks_pill.label")}
          description={t("settings.chat.tasks_pill.description")}
        >
          <Toggle
            label={t("settings.chat.tasks_pill.toggle")}
            on={tasksPill}
            onChange={onTasksPill}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.composer.title")}
        description={t("settings.chat.composer.description")}
      >
        <Row
          id="follow-up"
          label={t("settings.chat.follow_up.label")}
          description={t("settings.chat.follow_up.description")}
        >
          <Segmented
            label={t("settings.chat.follow_up.selector")}
            value={followUpBehavior}
            options={[
              {
                value: "queue",
                label: t("settings.chat.follow_up.queue"),
              },
              {
                value: "steer",
                label: t("settings.chat.follow_up.steer"),
              },
            ]}
            onChange={onFollowUpBehavior}
          />
        </Row>
        <Row
          id="model-controls"
          label={t("settings.chat.model_controls.label")}
          description={t("settings.chat.model_controls.description")}
        >
          <Segmented
            label={t("settings.chat.model_controls.selector")}
            value={modelControls}
            options={[
              {
                value: "menu",
                label: t("settings.chat.model_controls.menu"),
              },
              {
                value: "beside",
                label: t("settings.chat.model_controls.beside"),
              },
            ]}
            onChange={onModelControls}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.code_review.title")}
        description={t("settings.chat.code_review.description")}
      >
        <Row
          id="diff-view"
          label={t("settings.chat.diff_view.label")}
          description={t("settings.chat.diff_view.description")}
        >
          <Segmented
            label={t("settings.chat.diff_view.selector")}
            value={diffViewer}
            options={[
              {
                value: "editor",
                label: t("settings.chat.diff_view.editor"),
              },
              {
                value: "unified",
                label: t("settings.chat.diff_view.unified"),
              },
            ]}
            onChange={onDiffViewer}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.extras.title")}
        description={t("settings.chat.extras.description")}
      >
        <Row
          id="composer-mascot"
          label={t("settings.chat.composer_mascot.label")}
          description={t("settings.chat.composer_mascot.description")}
        >
          <Toggle
            label={t("settings.chat.composer_mascot.toggle")}
            on={composerRunner}
            onChange={onComposerRunner}
          />
        </Row>
        <Row
          id="empty-session-games"
          label={t("settings.chat.empty_session_games.label")}
          description={t("settings.chat.empty_session_games.description")}
        >
          <Toggle
            label={t("settings.chat.empty_session_games.toggle")}
            on={gridArcadeEnabled}
            onChange={onGridArcadeEnabled}
          />
        </Row>
      </Group>
    </>
  );
}

function InboxPage() {
  const { t } = useLocale();
  return (
    <>
      <Group
        id="github"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="github" className="size-4 shrink-0" />
            {t("settings.inbox.github.title")}
          </span>
        }
        description={t("settings.inbox.github.description")}
      >
        <GithubSettings />
      </Group>

      <Group
        id="gitlab"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="gitlab" className="size-4 shrink-0" />
            {t("settings.inbox.gitlab.title")}
          </span>
        }
        description={t("settings.inbox.gitlab.description")}
      >
        <GitlabSettings />
      </Group>

      <Group
        id="linear"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="linear" className="size-4 shrink-0" />
            {t("settings.inbox.linear.title")}
          </span>
        }
        description={t("settings.inbox.linear.description")}
      >
        <LinearSettings />
      </Group>
    </>
  );
}

function GithubSettings() {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const { t } = useLocale();

  const checkStatus = useCallback(async () => {
    const generation = ++request.current;
    setChecking(true);
    setError(null);
    try {
      const next = await githubStatus();
      if (generation === request.current) setStatus(next);
    } catch (err: unknown) {
      if (generation === request.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === request.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    return () => {
      request.current += 1;
    };
  }, [checkStatus]);

  const description = status?.connected
    ? t("settings.inbox.github.connection.connected")
    : status?.installed
      ? t("settings.inbox.github.connection.auth_needed")
      : t("settings.inbox.github.connection.not_installed");
  const label = checking
    ? t("settings.inbox.github.connection.checking")
    : status?.connected
      ? t("settings.inbox.github.connection.connected_status")
      : status?.installed
        ? t("settings.inbox.github.connection.sign_in_required")
        : t("settings.inbox.github.connection.not_installed_status");

  return (
    <>
      <Row
        label={t("settings.inbox.github.connection.label")}
        description={description}
      >
        <span className="text-[12px] text-content/50">{label}</span>
        {!checking && !status?.installed ? (
          <SecondaryButton
            onClick={() => {
              openExternalBestEffort("https://cli.github.com/");
            }}
          >
            {t("settings.inbox.github.connection.installation_guide")}
          </SecondaryButton>
        ) : null}
        <SecondaryButton onClick={() => void checkStatus()} disabled={checking}>
          {checking
            ? t("settings.inbox.github.connection.checking_button")
            : t("settings.inbox.github.connection.check_again")}
        </SecondaryButton>
      </Row>
      {error ? (
        <p
          role="alert"
          className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

function GitlabSettings() {
  const [url, setUrl] = useState("https://gitlab.com");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    let cancelled = false;
    void gitlabConnected()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        setUrl(status.url);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await saveGitlabConfig(url, token);
      setUrl(status.url);
      setToken("");
      setConnected(status.connected);
      clearInboxCache();
    } catch (err: unknown) {
      setConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await disconnectGitlab(url);
      setConnected(false);
      setUrl(status.url);
      clearInboxCache();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row
        label={t("settings.inbox.gitlab.connection.label")}
        description={t("settings.inbox.gitlab.connection.description")}
      >
        {connected ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <span className="max-w-56 truncate text-[12px] text-content/50">
              {url}
            </span>
            <SecondaryButton
              onClick={() => void onDisconnect()}
              disabled={busy}
            >
              {t("settings.inbox.gitlab.connection.disconnect")}
            </SecondaryButton>
          </div>
        ) : (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t(
                  "settings.inbox.gitlab.connection.url_placeholder",
                )}
                aria-label={t("settings.inbox.gitlab.connection.url_aria")}
                autoComplete="url"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSave();
                }}
                placeholder={t(
                  "settings.inbox.gitlab.connection.token_placeholder",
                )}
                aria-label={t("settings.inbox.gitlab.connection.token_aria")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <SecondaryButton
              onClick={() => void onSave()}
              disabled={busy || !token.trim()}
            >
              {busy
                ? t("settings.inbox.gitlab.connection.saving")
                : t("settings.inbox.gitlab.connection.connect")}
            </SecondaryButton>
          </div>
        )}
      </Row>
      {error ? (
        <p
          role="alert"
          className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

function LinearSettings() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [hiddenTeamIds, setHiddenTeamIds] = useState(loadHiddenLinearTeamIds);
  const { t } = useLocale();

  const loadTeams = useCallback(async () => {
    try {
      const next = await listLinearTeams();
      setTeams(next);
    } catch {
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void linearConnected()
      .then((status) => {
        if (cancelled) return;
        setConnected(status.connected);
        if (status.connected) void loadTeams();
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadTeams]);

  // The inbox filter menu writes the same list, so follow it while both are mounted.
  useEffect(() => {
    const onChange = () => setHiddenTeamIds(loadHiddenLinearTeamIds());
    window.addEventListener(LINEAR_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LINEAR_CHANGE_EVENT, onChange);
  }, []);

  const onSave = async () => {
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveLinearToken(token);
      setToken("");
      setConnected(true);
      clearInboxCache();
      notifyLinearChange();
      await loadTeams();
    } catch (err: unknown) {
      setConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectLinear();
      setConnected(false);
      setTeams([]);
      clearInboxCache();
      notifyLinearChange();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleTeam = (id: string) => {
    const next = new Set(hiddenTeamIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ids = [...next];
    setHiddenTeamIds(ids);
    saveHiddenLinearTeamIds(ids);
    clearInboxCache();
  };

  return (
    <>
      <Row
        label={t("settings.inbox.linear.api_key.label")}
        description={t("settings.inbox.linear.api_key.description")}
      >
        {connected ? (
          <SecondaryButton onClick={() => void onDisconnect()} disabled={busy}>
            {t("settings.inbox.linear.api_key.disconnect")}
          </SecondaryButton>
        ) : (
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <label className="flex h-7 w-52 max-w-full shrink-0 items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSave();
                }}
                placeholder={t("settings.inbox.linear.api_key.placeholder")}
                aria-label={t("settings.inbox.linear.api_key.aria")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
              />
            </label>
            <SecondaryButton
              onClick={() => void onSave()}
              disabled={busy || !token.trim()}
            >
              {busy
                ? t("settings.inbox.linear.api_key.saving")
                : t("settings.inbox.linear.api_key.connect")}
            </SecondaryButton>
          </div>
        )}
      </Row>
      {error ? (
        <p
          role="alert"
          className="border-b border-content/5 px-4 pb-3 text-[12px] text-red-400/90 last:border-b-0"
        >
          {error}
        </p>
      ) : null}
      {connected && teams.length > 0 ? (
        <div className="border-b border-content/5 px-4 py-3.5 last:border-b-0">
          <div className="text-[13px] font-medium text-content">
            {t("settings.inbox.linear.teams.title")}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-content/45">
            {t("settings.inbox.linear.teams.description")}
          </p>
          <div className="-mx-2 mt-2 flex flex-col gap-0.5">
            {teams.map((team) => {
              const checked = !hiddenTeamIds.includes(team.id);
              return (
                <button
                  key={team.id}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => toggleTeam(team.id)}
                  className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-[13px] text-content hover:bg-content/5"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {team.name}
                    {team.key ? (
                      <span className="ml-1.5 text-content/40">{team.key}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-content/40">
                    {checked
                      ? t("settings.inbox.linear.teams.shown")
                      : t("settings.inbox.linear.teams.hidden")}
                  </span>
                  {checked ? (
                    <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Minimum spinner time so instant results still paint the busy state. */
const MIN_BUSY_MS = 500;

function UpdateRow({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });
  const { locale, t } = useLocale();
  const [holding, setHolding] = useState(false);
  const [isFlatpak, setIsFlatpak] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readAppVersion().then((currentVersion) => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, currentVersion }));
    });
    void isFlatpakSandbox().then((sandboxed) => {
      if (cancelled) return;
      setIsFlatpak(sandboxed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy =
    snapshot.phase === "checking" ||
    snapshot.phase === "downloading" ||
    holding;
  const hasUpdate = snapshot.phase === "available";

  const onClick = async () => {
    if (busy) return;
    // Guarantee a beat of spinner: fast checks (cached "latest version" or
    // instant errors) would otherwise never paint the busy state.
    const startedAt = Date.now();
    setHolding(true);
    try {
      if (hasUpdate) {
        await installPendingUpdate(setSnapshot, { showDialog: false });
        return;
      }
      await runUpdateFlow(true, setSnapshot, { showDialog: false });
      setLastChecked(Date.now());
    } finally {
      const remaining = MIN_BUSY_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setHolding(false);
    }
  };

  // Sandboxed (Flatpak) builds have no self-updater: Flathub owns updates.
  const checkedSuffix =
    lastChecked == null ||
    snapshot.phase === "checking" ||
    snapshot.phase === "downloading" ||
    snapshot.phase === "available"
      ? ""
      : ` · ${t("settings.general.update.last_checked", {
          time: new Intl.DateTimeFormat(getIntlLocale(locale), {
            hour: "2-digit",
            minute: "2-digit",
          }).format(lastChecked),
        })}`;
  const status = isFlatpak
    ? t("settings.general.update.flatpak")
    : snapshot.phase === "available"
      ? t("settings.general.update.available", {
          availableVersion: snapshot.availableVersion ?? "",
        })
      : snapshot.phase === "downloading"
        ? snapshot.progress != null
          ? t("settings.general.update.downloading", {
              progress: snapshot.progress,
            })
          : t("settings.general.update.downloading_pending")
        : snapshot.phase === "checking"
          ? t("settings.general.update.checking")
          : snapshot.phase === "current"
            ? `${t("settings.general.update.current")}${checkedSuffix}`
            : snapshot.phase === "error"
              ? `${t("settings.general.update.failed_detail", {
                  error:
                    snapshot.error ?? t("settings.general.update.failed"),
                })}${checkedSuffix}`
              : `${t("settings.general.update.idle")}${checkedSuffix}`;

  return (
    <Row
      id="update"
      label={
        <span className="flex items-baseline gap-2">
          {t("settings.general.update.label")}
          <span className="font-mono text-[12px] text-content/45">
            {snapshot.currentVersion}
          </span>
        </span>
      }
      description={status}
    >
      <div className="flex items-center gap-2">
        <SecondaryButton
          onClick={() =>
            onOpenWhatsNew(
              snapshot.availableVersion ?? snapshot.currentVersion,
            )
          }
          disabled={snapshot.currentVersion === "…"}
        >
          {t("settings.general.update.whats_new")}
        </SecondaryButton>
        {!isFlatpak && (
          <SecondaryButton onClick={() => void onClick()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : hasUpdate ? (
              <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
            )}
            {t("settings.general.update.check")}
            {hasUpdate && !busy && snapshot.availableVersion ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                {snapshot.availableVersion}
              </span>
            ) : null}
          </SecondaryButton>
        )}
      </div>
    </Row>
  );
}

type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;

function useAppearanceSettings() {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(loadThemePreference);
  const [accentColor, setAccentColor] = useState(loadAccentColor);
  const [opacity, setOpacity] = useState(loadSidebarOpacity);
  const [blur, setBlur] = useState(loadSidebarBlur);
  const [themeHue, setThemeHue] = useState(loadThemeHue);
  const [themeSaturation, setThemeSaturation] = useState(loadThemeSaturation);
  const [themeDarkLightness, setThemeDarkLightness] = useState(
    loadThemeDarkLightness,
  );
  const [bodyGlass, setBodyGlass] = useState(loadBodyGlass);
  const [uiBlur, setUiBlur] = useState(loadUiBlur);
  const [chatBackgroundPath, setChatBackgroundPath] = useState(
    loadChatBackgroundPath,
  );
  const [chatBackgroundEmptyOpacity, setChatBackgroundEmptyOpacity] = useState(
    loadChatBackgroundEmptyOpacity,
  );
  const [chatBackgroundSessionOpacity, setChatBackgroundSessionOpacity] =
    useState(loadChatBackgroundSessionOpacity);
  const [chatBackgroundBlur, setChatBackgroundBlur] = useState(
    loadChatBackgroundBlur,
  );
  const [chatBackgroundScope, setChatBackgroundScope] =
    useState<ChatBackgroundScope>(loadChatBackgroundScope);
  const [chatBackgroundBusy, setChatBackgroundBusy] = useState(false);
  const [chatBackgroundError, setChatBackgroundError] = useState<string | null>(
    null,
  );
  const [uiScale, setUiScale] = useState(loadUiScale);

  useEffect(() => subscribeUiScale(() => setUiScale(loadUiScale())), []);

  const onThemePreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    saveThemePreference(next);
    setThemePreference(next);
  }, []);

  const onAccentColor = useCallback((value: string | null) => {
    const next = applyAccentColor(value);
    saveAccentColor(next);
    setAccentColor(next);
  }, []);

  // Drag preview: paint only. No persist, no parent-wide side effects; the
  // exact value is committed on release via the onX handler.
  const previewAccentColor = useCallback((value: string | null) => {
    applyAccentColor(value);
  }, []);

  const previewTint = useCallback((hue: number, saturation: number) => {
    const next = applyThemeTint(hue, saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, []);

  const previewDarkLightness = useCallback((value: number) => {
    setThemeDarkLightness(applyThemeDarkLightness(value));
  }, []);

  const previewOpacity = useCallback((percent: number) => {
    setOpacity(applySidebarOpacity(percent / 100));
  }, []);

  const previewBlur = useCallback((radius: number) => {
    setBlur(previewSidebarBlur(radius));
  }, []);

  const previewChatBackgroundEmptyOpacity = useCallback((percent: number) => {
    setChatBackgroundEmptyOpacity(
      applyChatBackgroundEmptyOpacity(percent / 100),
    );
  }, []);

  const previewChatBackgroundSessionOpacity = useCallback(
    (percent: number) => {
      setChatBackgroundSessionOpacity(
        applyChatBackgroundSessionOpacity(percent / 100),
      );
    },
    [],
  );

  const previewUiScale = useCallback((percent: number) => {
    // No setZoom while dragging: relayouting the whole app under the pointer
    // fights the drag. The zoom commits on release.
    setUiScale(percent / 100);
  }, []);

  const onOpacity = useCallback((percent: number) => {
    const next = applySidebarOpacity(percent / 100);
    saveSidebarOpacity(next);
    setOpacity(next);
  }, []);

  const onBlur = useCallback((radius: number) => {
    cancelSidebarBlurPreview();
    const next = applySidebarBlur(radius);
    saveSidebarBlur(next);
    setBlur(next);
  }, []);

  const onTint = useCallback((hue: number, saturation: number) => {
    const next = applyThemeTint(hue, saturation);
    saveThemeHue(next.hue);
    saveThemeSaturation(next.saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, []);

  const onDarkLightness = useCallback((value: number) => {
    const next = applyThemeDarkLightness(value);
    saveThemeDarkLightness(next);
    setThemeDarkLightness(next);
  }, []);

  const onBodyGlass = useCallback((next: boolean) => {
    applyBodyGlass(next);
    saveBodyGlass(next);
    setBodyGlass(next);
  }, []);

  const onUiBlur = useCallback((next: boolean) => {
    applyUiBlur(next);
    saveUiBlur(next);
    setUiBlur(next);
  }, []);

  const onChooseChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      const path = await pickAndSaveChatBackground();
      if (!path) return;
      saveChatBackgroundPath(path);
      applyChatBackground(path);
      setChatBackgroundPath(path);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onClearChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      await removeChatBackground();
      saveChatBackgroundPath(null);
      applyChatBackground(null);
      setChatBackgroundPath(null);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onChatBackgroundEmptyOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundEmptyOpacity(percent / 100);
    saveChatBackgroundEmptyOpacity(next);
    setChatBackgroundEmptyOpacity(next);
  }, []);

  const onChatBackgroundSessionOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundSessionOpacity(percent / 100);
    saveChatBackgroundSessionOpacity(next);
    setChatBackgroundSessionOpacity(next);
  }, []);

  const previewChatBackgroundBlur = useCallback((radius: number) => {
    setChatBackgroundBlur(applyChatBackgroundBlur(radius));
  }, []);

  const onChatBackgroundBlur = useCallback((radius: number) => {
    const next = applyChatBackgroundBlur(radius);
    saveChatBackgroundBlur(next);
    setChatBackgroundBlur(next);
  }, []);

  const onChatBackgroundScope = useCallback((next: ChatBackgroundScope) => {
    applyChatBackgroundScope(next);
    saveChatBackgroundScope(next);
    setChatBackgroundScope(next);
  }, []);

  const onUiScale = useCallback((percent: number) => {
    const next = saveUiScale(percent / 100);
    setUiScale(next);
    void applyUiScale(next);
  }, []);

  const restoreDefaults = useCallback(() => {
    onThemePreference(THEME_PREFERENCE_DEFAULT);
    onAccentColor(ACCENT_COLOR_DEFAULT);
    onOpacity(Math.round(SIDEBAR_OPACITY_DEFAULT * 100));
    onBlur(SIDEBAR_BLUR_DEFAULT);
    onTint(THEME_HUE_DEFAULT, THEME_SATURATION_DEFAULT);
    onDarkLightness(THEME_DARK_LIGHTNESS_DEFAULT);
    onBodyGlass(BODY_GLASS_DEFAULT);
    onUiBlur(UI_BLUR_DEFAULT);
    onChatBackgroundEmptyOpacity(
      Math.round(CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundSessionOpacity(
      Math.round(CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundBlur(CHAT_BACKGROUND_BLUR_DEFAULT);
    onChatBackgroundScope(CHAT_BACKGROUND_SCOPE_DEFAULT);
    if (chatBackgroundPath) void onClearChatBackground();
    onUiScale(Math.round(UI_SCALE_DEFAULT * 100));
  }, [
    chatBackgroundPath,
    onBlur,
    onBodyGlass,
    onUiBlur,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundBlur,
    onChatBackgroundScope,
    onClearChatBackground,
    onAccentColor,
    onThemePreference,
    onOpacity,
    onTint,
    onDarkLightness,
    onUiScale,
  ]);

  return {
    themePreference,
    accentColor,
    opacity,
    blur,
    themeHue,
    themeSaturation,
    themeDarkLightness,
    bodyGlass,
    uiBlur,
    chatBackgroundPath,
    chatBackgroundEmptyOpacity,
    chatBackgroundSessionOpacity,
    chatBackgroundBlur,
    chatBackgroundScope,
    chatBackgroundBusy,
    chatBackgroundError,
    uiScale,
    onThemePreference,
    onAccentColor,
    onOpacity,
    onBlur,
    onTint,
    onDarkLightness,
    onBodyGlass,
    onUiBlur,
    onChooseChatBackground,
    onClearChatBackground,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundBlur,
    onChatBackgroundScope,
    onUiScale,
    restoreDefaults,
    previewAccentColor,
    previewTint,
    previewDarkLightness,
    previewOpacity,
    previewBlur,
    previewChatBackgroundEmptyOpacity,
    previewChatBackgroundSessionOpacity,
    previewChatBackgroundBlur,
    previewUiScale,
  };
}

function AppearancePage({
  onRestoreReady,
  onOpenSection,
}: {
  onRestoreReady?: (restore: () => void) => void;
  onOpenSection?: (section: SettingsSectionId) => void;
}) {
  const appearance = useAppearanceSettings();
  const { restoreDefaults } = appearance;
  // The master hardware switch overrides every blur control: while it is
  // off, `html.hw-reduced` kills the sampling the toggle below would flip.
  const [hardwareOn, setHardwareOn] = useState(loadHardwareAcceleration);
  useEffect(
    () => subscribeHardwareAcceleration(setHardwareOn),
    [],
  );
  useEffect(() => {
    onRestoreReady?.(restoreDefaults);
  }, [onRestoreReady, restoreDefaults]);
  const percent = Math.round(appearance.opacity * 100);
  const glassDisabled = useColorScheme() === "light";
  // Stable per-value identities: without these, the inline arrows below
  // would defeat memo(Slider) and re-render the sibling row on every tick.
  const onHuePreview = useCallback(
    (value: number) =>
      appearance.previewTint(value, appearance.themeSaturation),
    [appearance.previewTint, appearance.themeSaturation],
  );
  const onHueCommit = useCallback(
    (value: number) => appearance.onTint(value, appearance.themeSaturation),
    [appearance.onTint, appearance.themeSaturation],
  );
  const onSaturationPreview = useCallback(
    (value: number) => appearance.previewTint(appearance.themeHue, value),
    [appearance.previewTint, appearance.themeHue],
  );
  const onSaturationCommit = useCallback(
    (value: number) => appearance.onTint(appearance.themeHue, value),
    [appearance.onTint, appearance.themeHue],
  );
  const { t } = useLocale();

  return (
    <>
      <Group
        title={t("settings.appearance.theme_group.title")}
        description={t("settings.appearance.theme_group.description")}
      >
        <Row
          id="theme"
          label={t("settings.appearance.theme.label")}
          description={t("settings.appearance.theme.description")}
        >
          <Segmented
            label={t("settings.appearance.theme.selector")}
            value={appearance.themePreference}
            options={[
              {
                value: "system",
                label: t("settings.appearance.theme.system"),
              },
              { value: "dark", label: t("settings.appearance.theme.dark") },
              {
                value: "light",
                label: t("settings.appearance.theme.light"),
              },
            ]}
            onChange={appearance.onThemePreference}
          />
        </Row>
        <Row
          id="accent-color"
          label={t("settings.appearance.accent.label")}
          description={t("settings.appearance.accent.description")}
        >
          <AccentColorPicker
            value={appearance.accentColor}
            onPreview={appearance.previewAccentColor}
            onChange={appearance.onAccentColor}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.appearance.color_group.title")}
        description={t("settings.appearance.color_group.description")}
      >
        <Row
          id="hue"
          label={t("settings.appearance.hue.label")}
          description={t("settings.appearance.hue.description")}
        >
          <Slider
            label={t("settings.appearance.hue.slider")}
            value={appearance.themeHue}
            display={`${appearance.themeHue}°`}
            min={THEME_HUE_MIN}
            max={THEME_HUE_MAX}
            onPreview={onHuePreview}
            onCommit={onHueCommit}
          />
        </Row>
        <Row
          id="saturation"
          label={t("settings.appearance.saturation.label")}
          description={t("settings.appearance.saturation.description")}
        >
          <Slider
            label={t("settings.appearance.saturation.slider")}
            value={appearance.themeSaturation}
            display={`${appearance.themeSaturation}%`}
            min={THEME_SATURATION_MIN}
            max={THEME_SATURATION_MAX}
            onPreview={onSaturationPreview}
            onCommit={onSaturationCommit}
          />
        </Row>
        <Row
          id="dark-lightness"
          label={t("settings.appearance.dark_lightness.label")}
          description={
            glassDisabled
              ? t("settings.appearance.dark_lightness.disabled")
              : t("settings.appearance.dark_lightness.description")
          }
        >
          <Slider
            label={t("settings.appearance.dark_lightness.slider")}
            value={appearance.themeDarkLightness}
            display={`${appearance.themeDarkLightness}%`}
            min={THEME_DARK_LIGHTNESS_MIN}
            max={THEME_DARK_LIGHTNESS_MAX}
            onPreview={appearance.previewDarkLightness}
            onCommit={appearance.onDarkLightness}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.appearance.translucency_group.title")}
        description={
          glassDisabled
            ? t("settings.appearance.translucency_group.disabled")
            : t("settings.appearance.translucency_group.description")
        }
      >
        <Row
          id="sidebar-opacity"
          label={t("settings.appearance.sidebar_opacity.label")}
          description={t("settings.appearance.sidebar_opacity.description")}
        >
          <Slider
            label={t("settings.appearance.sidebar_opacity.slider")}
            value={percent}
            display={`${percent}%`}
            min={Math.round(SIDEBAR_OPACITY_MIN * 100)}
            max={Math.round(SIDEBAR_OPACITY_MAX * 100)}
            onPreview={appearance.previewOpacity}
            onCommit={appearance.onOpacity}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="blur"
          label={t("settings.appearance.blur.label")}
          description={t("settings.appearance.blur.description")}
        >
          <Slider
            label={t("settings.appearance.blur.slider")}
            value={appearance.blur}
            display={String(appearance.blur)}
            min={SIDEBAR_BLUR_MIN}
            max={SIDEBAR_BLUR_MAX}
            onPreview={appearance.previewBlur}
            onCommit={appearance.onBlur}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="interface-blur"
          label={t("settings.appearance.interface_blur.label")}
          description={
            hardwareOn ? (
              t("settings.appearance.interface_blur.description")
            ) : (
              <>
                {t("settings.appearance.interface_blur.description_disabled")}{" "}
                <button
                  type="button"
                  onClick={() => onOpenSection?.("performance")}
                  className="underline underline-offset-2 hover:text-content"
                >
                  {t("settings.appearance.interface_blur.open_performance")}
                </button>
              </>
            )
          }
        >
          <Toggle
            label={t("settings.appearance.interface_blur.toggle")}
            on={appearance.uiBlur}
            onChange={appearance.onUiBlur}
            disabled={!hardwareOn}
          />
        </Row>
        <Row
          id="main-pane-glass"
          label={t("settings.appearance.main_pane_glass.label")}
          description={t("settings.appearance.main_pane_glass.description")}
        >
          <Toggle
            label={t("settings.appearance.main_pane_glass.toggle")}
            on={appearance.bodyGlass}
            onChange={appearance.onBodyGlass}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <ChatBackgroundCard appearance={appearance} />

      <Group
        id="pets"
        title={t("settings.appearance.pets.label")}
        description={t("settings.appearance.pets.description")}
      >
        <PetsSettings />
      </Group>

      <Group title={t("settings.appearance.layout_group.title")}>
        <Row
          id="interface-scale"
          label={t("settings.appearance.interface_scale.label")}
          description={t("settings.appearance.interface_scale.description")}
        >
          <Slider
            label={t("settings.appearance.interface_scale.slider")}
            value={Math.round(appearance.uiScale * 100)}
            display={`${Math.round(appearance.uiScale * 100)}%`}
            min={Math.round(UI_SCALE_MIN * 100)}
            max={Math.round(UI_SCALE_MAX * 100)}
            step={10}
            onPreview={appearance.previewUiScale}
            onCommit={appearance.onUiScale}
          />
        </Row>
      </Group>
    </>
  );
}

function ChatBackgroundCard({
  appearance,
}: {
  appearance: AppearanceSettings;
}) {
  const src = chatBackgroundSrc(appearance.chatBackgroundPath);
  const hasImage = Boolean(appearance.chatBackgroundPath && src);
  const emptyVisibility = Math.round(
    appearance.chatBackgroundEmptyOpacity * 100,
  );
  const sessionVisibility = Math.round(
    appearance.chatBackgroundSessionOpacity * 100,
  );
  const busy = appearance.chatBackgroundBusy;
  const { t } = useLocale();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <Group
      id="chat-background"
      title={t("settings.appearance.chat_background.title")}
      description={t("settings.appearance.chat_background.description")}
    >
      {confirmingRemove ? (
        <ConfirmDialog
          title={t("settings.appearance.chat_background.remove_title")}
          description={t(
            "settings.appearance.chat_background.remove_description",
          )}
          confirmLabel={t(
            "settings.appearance.chat_background.remove_action",
          )}
          cancelLabel={t("settings.archive.dialog.cancel")}
          danger
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => {
            setConfirmingRemove(false);
            void appearance.onClearChatBackground();
          }}
        />
      ) : null}
      <div className="border-b border-content/5 p-4 last:border-b-0">
        <div className="overflow-hidden rounded-lg border border-content/10">
          {hasImage ? (
            <div className="relative h-36">
              <img
                src={src ?? undefined}
                alt=""
                draggable={false}
                className="size-full object-cover"
                style={{
                  opacity: appearance.chatBackgroundEmptyOpacity,
                  filter: `blur(${appearance.chatBackgroundBlur}px)`,
                }}
              />
              <span className="pointer-events-none absolute bottom-2 left-2 text-[11px] text-content/40">
                {t("settings.appearance.chat_background.preview", {
                  value: emptyVisibility,
                })}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 text-content/40 hover:bg-content/5 hover:text-content/70 disabled:cursor-default disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-[12px]">
                {t("settings.appearance.chat_background.choose")}
              </span>
            </button>
          )}
        </div>
        {hasImage ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <SecondaryButton
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              {t("settings.appearance.chat_background.change")}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => setConfirmingRemove(true)}
              disabled={busy}
              danger
            >
              {t("settings.appearance.chat_background.remove")}
            </SecondaryButton>
          </div>
        ) : null}
        {appearance.chatBackgroundError ? (
          <p role="alert" className="mt-2 text-[12px] text-red-400">
            {appearance.chatBackgroundError}
          </p>
        ) : null}
      </div>
      {hasImage ? (
        <>
          <Row
            label={t("settings.appearance.chat_background.scope.label")}
            description={t(
              "settings.appearance.chat_background.scope.description",
            )}
          >
            <Segmented
              label={t("settings.appearance.chat_background.scope.selector")}
              value={appearance.chatBackgroundScope}
              options={[
                {
                  value: "empty",
                  label: t(
                    "settings.appearance.chat_background.scope.empty",
                  ),
                },
                {
                  value: "all",
                  label: t("settings.appearance.chat_background.scope.all"),
                },
              ]}
              onChange={appearance.onChatBackgroundScope}
            />
          </Row>
          <Row
            label={t(
              "settings.appearance.chat_background.empty_visibility.label",
            )}
            description={t(
              "settings.appearance.chat_background.empty_visibility.description",
            )}
          >
            <Slider
              label={t(
                "settings.appearance.chat_background.empty_visibility.slider",
              )}
              value={emptyVisibility}
              display={`${emptyVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onPreview={appearance.previewChatBackgroundEmptyOpacity}
              onCommit={appearance.onChatBackgroundEmptyOpacity}
            />
          </Row>
          <Row
            label={t(
              "settings.appearance.chat_background.session_visibility.label",
            )}
            description={t(
              "settings.appearance.chat_background.session_visibility.description",
            )}
          >
            <Slider
              label={t(
                "settings.appearance.chat_background.session_visibility.slider",
              )}
              value={sessionVisibility}
              display={`${sessionVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onPreview={appearance.previewChatBackgroundSessionOpacity}
              onCommit={appearance.onChatBackgroundSessionOpacity}
            />
          </Row>
          <Row
            label={t("settings.appearance.background_blur.label")}
            description={t("settings.appearance.background_blur.description")}
          >
            <Slider
              label={t("settings.appearance.background_blur.slider")}
              value={appearance.chatBackgroundBlur}
              display={
                appearance.chatBackgroundBlur === 0
                  ? t("settings.appearance.background_blur.off")
                  : `${appearance.chatBackgroundBlur}px`
              }
              min={CHAT_BACKGROUND_BLUR_MIN}
              max={CHAT_BACKGROUND_BLUR_MAX}
              onPreview={appearance.previewChatBackgroundBlur}
              onCommit={appearance.onChatBackgroundBlur}
            />
          </Row>
        </>
      ) : null}
    </Group>
  );
}

function KeybindingsPage() {
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const { locale, t } = useLocale();
  const rows = useMemo(
    () => filterKeybindings(KEYBINDINGS, query, locale),
    [query, locale],
  );

  return (
    <Group
      title={t("settings.keybindings.group.title")}
      description={t("settings.keybindings.group.description")}
      action={
        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className="shrink-0 text-[12px] text-content/40 tabular-nums"
          >
            {rows.length}{" "}
            {rows.length === 1
              ? t("settings.keybindings.count.singular")
              : t("settings.keybindings.count.plural")}
          </span>
          <label className="flex h-7 w-44 shrink-0 items-center gap-2 rounded-md border border-content/10 px-2 text-content/45 focus-within:border-content/20">
            <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
            <input
              ref={filterRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("settings.keybindings.filter.placeholder")}
              aria-label={t("settings.keybindings.filter.aria")}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("settings.search.clear")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  // Keyboard activation would otherwise strand focus on a
                  // button that unmounts with the cleared query.
                  filterRef.current?.focus();
                }}
                className="grid size-4 shrink-0 place-items-center rounded text-content/45 hover:text-content"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            ) : null}
          </label>
        </div>
      }
    >
      <div className="flex items-center border-b border-stroke bg-content/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-content/40">
        <span className="min-w-0 flex-1">
          {t("settings.keybindings.table.command")}
        </span>
        <span className="w-40 shrink-0">
          {t("settings.keybindings.table.keybinding")}
        </span>
        <span className="w-28 shrink-0">
          {t("settings.keybindings.table.when")}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-content/45">
          {t("settings.keybindings.list.empty")}
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={`${row.command}-${row.keys}`}
            className="flex items-center border-b border-content/5 px-4 py-2 text-[12px] last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{t(row.command)}</span>
            <span className="w-40 shrink-0 font-mono text-[12px] text-content/80">
              {row.keys}
            </span>
            <span className="w-28 shrink-0 font-mono text-[11px] text-content/40">
              {keybindingWhenLabel(row.when, locale)}
            </span>
          </div>
        ))
      )}
    </Group>
  );
}

function ProvidersPage() {
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  useSyncExternalStore(
    subscribeHarnessAvailability,
    getHarnessAvailabilitySnapshot,
    getHarnessAvailabilitySnapshot,
  );
  const [choice, setChoice] = useState(loadLastModelChoice);
  const [defaultModels, setDefaultModels] = useState(loadDefaultModels);
  const [claudeHooks, setClaudeHooks] = useState(loadClaudeHooks);
  const { t } = useLocale();

  useEffect(() => {
    void probeHarnessAvailability();
  }, []);

  const onClaudeHooks = (next: boolean) => {
    saveClaudeHooks(next);
    setClaudeHooks(next);
  };

  const onModelChange = (harness: HarnessId, model: string) => {
    saveDefaultModel(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    if (choice?.harness === harness) {
      saveLastModelChoice(harness, model);
      setChoice({ harness, model });
    }
  };

  const onDefault = (harness: HarnessId, model: string) => {
    saveLastModelChoice(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    setChoice({ harness, model });
  };

  return (
    <>
      <Group
        title={t("settings.providers.group.title")}
        description={t("settings.providers.group.description")}
      >
        {HARNESSES.map((harness) => (
          <ProviderRow
            key={harness}
            harness={harness}
            selectedModel={
              defaultModels[harness] ??
              (choice?.harness === harness
                ? choice.model
                : defaultModelId(harness))
            }
            isDefault={choice?.harness === harness}
            onDefault={onDefault}
            onModelChange={onModelChange}
          />
        ))}
      </Group>

      <Group title={t("settings.providers.advanced.title")}>
        <Row
          id="claude-hooks"
          label={t("settings.providers.claude_hooks.label")}
          description={t("settings.providers.claude_hooks.description")}
        >
          <Toggle
            label={t("settings.providers.claude_hooks.toggle")}
            on={claudeHooks}
            onChange={onClaudeHooks}
          />
        </Row>
      </Group>
    </>
  );
}

function ProviderRow({
  harness,
  selectedModel,
  isDefault,
  onDefault,
  onModelChange,
}: {
  harness: HarnessId;
  selectedModel: string;
  isDefault: boolean;
  onDefault: (harness: HarnessId, model: string) => void;
  onModelChange: (harness: HarnessId, model: string) => void;
}) {
  const models = modelsFor(harness);
  const available = isHarnessAvailable(harness);
  const current =
    models.length > 0 ? resolveModel(harness, selectedModel) : null;
  const [inPicker, setInPicker] = useState(() =>
    isPickerProviderVisible(harness),
  );

  useEffect(() => {
    if (!available || models.length > 0) return;
    void refreshHarnessCatalogs([harness]);
  }, [available, harness, models.length]);

  const onPickerVisible = (visible: boolean) => {
    savePickerProviderVisible(harness, visible);
    setInPicker(visible);
  };
  const { locale, t } = useLocale();

  return (
    <Row
      label={
        <span className="flex items-center gap-2">
          <HarnessIcon harness={harness} className="size-4 shrink-0" />
          {HARNESS_TITLE[harness]}
          {isDefault ? (
            <span className="rounded-full bg-content/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content/60">
              {t("settings.providers.row.badge_default")}
            </span>
          ) : null}
        </span>
      }
      description={
        available
          ? models.length === 1
            ? t("settings.providers.row.models_available_one")
            : t("settings.providers.row.models_available_other", {
                count: models.length,
              })
          : harnessUnavailableHint(harness, locale)
      }
    >
      {current ? (
        <Select
          label={t("settings.providers.row.model_selector", {
            harness: HARNESS_TITLE[harness],
          })}
          value={current.id}
          onChange={(next) => onModelChange(harness, next)}
          options={models.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ) : null}
      <SecondaryButton
        onClick={() => current && onDefault(harness, current.id)}
        disabled={isDefault || !current}
      >
        {isDefault
          ? t("settings.providers.row.default_active")
          : t("settings.providers.row.use_default")}
      </SecondaryButton>
      {available ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-content/50">
            {t("settings.providers.row.show_in_picker")}
          </span>
          <Toggle
            label={t("settings.providers.row.show_in_picker_toggle", {
              harness: HARNESS_TITLE[harness],
            })}
            on={inPicker}
            onChange={onPickerVisible}
          />
        </div>
      ) : null}
    </Row>
  );
}

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

function ArchivePage({
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
  const [deletingProject, setDeletingProject] =
    useState<ArchivedProject | null>(null);
  const [deletingSession, setDeletingSession] =
    useState<SessionSummary | null>(null);
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
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {t("settings.archive.projects.empty")}
          </p>
        ) : (
          archivedProjects.map((project) => (
            <div
              key={project.path}
              className="flex items-center gap-3 border-b border-content/5 px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">
                  {archivedProjectLabel(project.path)}
                </div>
                <div className="truncate text-[11px] text-content/40">
                  {prettyCwd(project.path)}
                </div>
              </div>
              {onRestoreProject ? (
                <SecondaryButton onClick={() => onRestoreProject(project.path)}>
                  {t("settings.archive.projects.restore")}
                </SecondaryButton>
              ) : null}
              {onDeleteProject ? (
                <SecondaryButton danger onClick={() => setDeletingProject(project)}>
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
          <p className="px-4 py-3.5 text-[12px] text-content/45">
            {t("settings.archive.sessions.empty_no_project")}
          </p>
        ) : archived.length === 0 ? (
          <p className="px-4 py-3.5 text-[12px] text-content/45">
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
              className="flex items-center gap-3 border-b border-content/5 px-4 py-2.5 last:border-b-0"
            >
              <HarnessIcon
                harness={session.harness}
                className="size-3.5 shrink-0"
              />
              <button
                type="button"
                onClick={() => onOpenSession(session.id)}
                className="min-w-0 flex-1 truncate text-left text-[13px] hover:text-content"
              >
                {sessionDisplayTitle(session.title, session.harness)}
              </button>
              <span className="shrink-0 text-[11px] text-content/35 tabular-nums">
                {formatDate(session.updatedAt)}
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

function formatDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  try {
    const date = new Date(value);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(getIntlLocale(), {
      ...(sameYear ? {} : { year: "numeric" as const }),
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="pb-4">
      <h1 className="text-[20px] font-semibold leading-tight text-content">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-content/45">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/**
 * A titled card of related settings. Everything on a page lives in one, so a
 * page reads as a handful of topics instead of one long list of switches.
 */
function Group({
  id,
  title,
  description,
  action,
  children,
}: {
  /** Matches a `SETTINGS_INDEX` id when the whole card is the search target. */
  id?: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const revealed = useContext(RevealedSetting);
  const flash = id != null && revealed === id;

  return (
    <section
      id={id ? settingDomId(id) : undefined}
      data-setting-id={id}
      tabIndex={-1}
      className="pt-8 outline-none"
    >
      <div className="flex items-end gap-4 pb-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-content">{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-content/45">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
      </div>
      <div
        className={`overflow-hidden rounded-xl border bg-content/3 transition-colors ${
          flash ? "border-accent/60" : "border-content/10"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  id,
  label,
  description,
  children,
}: {
  /** Matches a `SETTINGS_INDEX` id so search can scroll here. */
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  const revealed = useContext(RevealedSetting);
  const flash = id != null && revealed === id;

  return (
    <div
      id={id ? settingDomId(id) : undefined}
      data-setting-id={id}
      tabIndex={-1}
      className={`settings-row flex items-start gap-6 border-b border-content/5 px-4 py-3.5 outline-none transition-colors last:border-b-0 ${
        flash ? "bg-accent/10" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-content">{label}</div>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-content/45">
            {description}
          </p>
        ) : null}
      </div>
      <div className="settings-row-control flex min-w-0 max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}

const ERROR_HINT: Record<SoundFileReason, LocaleKey> = {
  missing: "settings.general.sounds.error.missing",
  decode: "settings.general.sounds.error.decode",
  unavailable: "settings.general.sounds.error.unavailable",
};

const SoundCueRow = memo(function SoundCueRow({
  cue,
  pref,
  onPref,
}: {
  cue: CustomizableCue;
  pref: SoundPref;
  onPref: (cue: CustomizableCue, pref: SoundPref) => void;
}) {
  const { t } = useLocale();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<SoundFileReason | null>(null);
  const custom = pref !== "preset";

  const runTest = async () => {
    setTesting(true);
    setError(null);
    try {
      if (custom) {
        const result = await playSoundFile(pref);
        if (!result.ok) setError(result.reason);
        return;
      }
      previewCue(cue);
    } finally {
      setTesting(false);
    }
  };

  const pick = async () => {
    const path = await pickSoundFile();
    if (!path) return;
    setError(null);
    onPref(cue, path);
  };

  const reset = () => {
    setError(null);
    onPref(cue, "preset");
  };

  return (
    <Row
      id={`sounds-${cue}`}
      label={t(cueLabelKey(cue))}
      description={
        custom
          ? pref.split(/[\\/]/).pop() || pref
          : undefined
      }
    >
      <button
        type="button"
        aria-label={t("settings.general.sounds.test")}
        title={t("settings.general.sounds.test")}
        disabled={testing}
        onClick={() => void runTest()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-content/10 text-content/60 hover:text-content disabled:opacity-50"
      >
        <PlayIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void pick()}
        title={custom ? pref : undefined}
        className={`flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[12px] ${
          custom
            ? "border-accent/40 bg-accent/10 text-content"
            : "border-content/10 text-content/60 hover:text-content"
        }`}
      >
        <FileIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-44 truncate">
          {custom
            ? t("settings.general.sounds.custom.file")
            : t("settings.general.sounds.custom.pick")}
        </span>
      </button>
      {custom ? (
        <button
          type="button"
          aria-label={t("settings.general.sounds.reset")}
          title={t("settings.general.sounds.reset")}
          onClick={reset}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-content/10 text-content/60 hover:text-content"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="w-full text-right text-[12px] text-red-400/90"
        >
          {t(ERROR_HINT[error])}
        </span>
      ) : null}
    </Row>
  );
});

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-grid max-w-full shrink-0 gap-0.5 rounded-md border border-content/10 p-0.5 text-[12px]"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-w-0 rounded-[5px] px-2.5 py-1 ${
            value === option.value
              ? "bg-selection text-content"
              : "text-content/50 hover:text-content"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const Slider = memo(function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onPreview,
  onCommit,
  disabled = false,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  /** Live drag feedback, rAF-throttled. Must stay cheap: no persist, no IPC. */
  onPreview?: (value: number) => void;
  /** Discrete commit: track click, arrow key, and drag release. */
  onCommit: (value: number) => void;
  disabled?: boolean;
}) {
  // Semi-controlled thumb: while dragging, the thumb follows local state so
  // it tracks the pointer 1:1 with zero parent renders; the parent only
  // learns about the drag via rAF-throttled previews and the final commit.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragging = useRef(false);
  const previewRaf = useRef(0);
  const latest = useRef(value);
  useEffect(
    () => () => {
      if (previewRaf.current) cancelAnimationFrame(previewRaf.current);
    },
    [],
  );

  const flushPreview = (next: number) => {
    latest.current = next;
    if (!onPreview) {
      onCommit(next);
      return;
    }
    if (previewRaf.current) return;
    previewRaf.current = requestAnimationFrame(() => {
      previewRaf.current = 0;
      onPreview(latest.current);
    });
  };

  const endDrag = (commit: boolean) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (previewRaf.current) {
      cancelAnimationFrame(previewRaf.current);
      previewRaf.current = 0;
    }
    const finalValue = latest.current;
    setDragValue(null);
    if (commit) onCommit(finalValue);
  };

  return (
    <div
      className={`flex w-56 max-w-full items-center gap-3 ${disabled ? "opacity-40" : ""}`}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={dragValue ?? value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={dragValue ?? value}
        aria-label={label}
        disabled={disabled}
        className="sidebar-opacity-slider min-w-0 flex-1 disabled:cursor-not-allowed"
        onPointerDown={() => {
          dragging.current = true;
        }}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onLostPointerCapture={() => endDrag(true)}
        onBlur={() => endDrag(dragValue != null)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (dragging.current && onPreview) {
            setDragValue(next);
            flushPreview(next);
          } else {
            // Keyboard step or track click: commit immediately.
            onCommit(next);
          }
        }}
      />
      <span className="w-10 shrink-0 text-right text-[12px] text-content tabular-nums">
        {display}
      </span>
    </div>
  );
});

const ACCENT_COLOR_PRESETS = [
  "#4da3f5",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
] as const;

function AccentColorPicker({
  value,
  onPreview,
  onChange,
}: {
  value: string | null;
  onPreview?: (value: string | null) => void;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const colorIndex = value
    ? ACCENT_COLOR_PRESETS.indexOf(
        value as (typeof ACCENT_COLOR_PRESETS)[number],
      )
    : -1;
  const presetIndex = value == null ? 0 : colorIndex >= 0 ? colorIndex + 1 : -1;
  const { t } = useLocale();

  return (
    <div ref={root} className="w-48">
      <ColorSwatchRow
        colors={["var(--color-content)", ...ACCENT_COLOR_PRESETS]}
        labels={[
          t("settings.accent.default"),
          t("settings.accent.blue"),
          t("settings.accent.violet"),
          t("settings.accent.pink"),
          t("settings.accent.red"),
          t("settings.accent.orange"),
          t("settings.accent.green"),
        ]}
        colorIndex={presetIndex >= 0 ? presetIndex : undefined}
        customColor={presetIndex < 0 ? (value ?? undefined) : undefined}
        customPickerOpen={open}
        onPickIndex={(index) => {
          setOpen(false);
          onChange(
            index === 0
              ? ACCENT_COLOR_DEFAULT
              : (ACCENT_COLOR_PRESETS[index - 1] ?? ACCENT_COLOR_PRESETS[0]),
          );
        }}
        onToggleCustom={() => setOpen((current) => !current)}
      />
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={248}
          onDismiss={() => setOpen(false)}
          className="px-2 pb-2"
        >
          <ColorPickerPopover
            value={value ?? ACCENT_COLOR_PRESETS[0]}
            onChange={onChange}
            onPreview={onPreview ? (hex) => onPreview(hex) : undefined}
            onCommit={onChange}
          />
        </Popover>
      ) : null}
    </div>
  );
}

/** macOS keeps the decision after the first prompt; only System Settings can flip it. Windows toasts are governed by Settings > Notifications. */
function NotificationsBlocked() {
  const { t } = useLocale();
  return (
    <span className="flex flex-wrap items-center gap-2 text-[12px] text-content/45">
      {t("settings.general.notifications.permission_needed")}
      {IS_MAC || IS_WIN ? (
        <button
          type="button"
          onClick={() => {
            void openNotificationSettings().catch(() => {});
          }}
          className="rounded-md border border-content/10 px-2 py-1 text-content/70 hover:bg-content/10 hover:text-content"
        >
          {t("settings.general.notifications.open_system_settings")}
        </button>
      ) : (
        <span className="basis-full">
          {t("settings.general.notifications.linux_denied_hint")}
        </span>
      )}
    </span>
  );
}

const Toggle = memo(function Toggle({
  label,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        onChange(!on);
        playCue("switch");
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-accent" : "bg-content/20"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
          on ? "left-4.5" : "left-0.5"
        }`}
      />
    </button>
  );
});

/** Theme-aware dropdown for a Settings row: a trigger button opening a Popover listbox. Used instead of a native select, whose option popup is OS-rendered and unreadable in dark mode on Windows/Linux. */
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const activeId =
    options[active] != null ? `${listId}-opt-${active}` : undefined;

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
      return;
    }
    if (e.key === "Tab") {
      const option = options[active];
      if (option && option.value !== value) onChange(option.value);
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) pick(option.value);
    }
  };

  return (
    <div ref={root} className="relative max-w-52">
      <button
        type="button"
        ref={trigger}
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-content/10 bg-content/5 px-2 py-1 text-left text-[12px] text-content outline-none hover:border-content/20"
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.label : value}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-content/50 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={280}
          maxHeight={320}
          autoFocus
          onDismiss={(reason) => {
            setOpen(false);
            if (reason === "escape") trigger.current?.focus();
          }}
          role="listbox"
          aria-label={label}
          aria-activedescendant={activeId}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className="overflow-y-auto overscroll-contain p-1"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const highlighted = index === active;
            return (
              <button
                key={option.value}
                ref={highlighted ? activeOption : undefined}
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
                  highlighted || isSelected
                    ? "bg-selection text-content"
                    : "text-content hover:bg-content/5"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
                ) : null}
              </button>
            );
          })}
        </Popover>
      ) : null}
    </div>
  );
}
