import React, {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from "react";

export type Locale = "en" | "pt-BR";

export const LOCALE_DEFAULT: Locale = "en";

const LOCALE_KEY = "monocode.locale";

/** Fired on `window` whenever the app language changes (detail: Locale). */
export const LOCALE_CHANGE_EVENT = "monocode:localechange";

function normalizeLocale(value: unknown): Locale | null {
  if (value === "en") return "en";
  if (
    typeof value === "string" &&
    (value === "pt-BR" || value.toLowerCase().startsWith("pt"))
  ) {
    return "pt-BR";
  }
  return null;
}

function detectLocale(): Locale {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.language === "string" &&
    navigator.language.toLowerCase().startsWith("pt")
  ) {
    return "pt-BR";
  }
  return LOCALE_DEFAULT;
}

export function loadLocale(): Locale {
  try {
    const stored = normalizeLocale(localStorage.getItem(LOCALE_KEY));
    if (stored) return stored;
  } catch {
    // private mode: fall through to detection
  }
  return detectLocale();
}

/** Persist first: `applyLocale` dispatches synchronously, so listeners that
 * read the store must already see the new value. */
export function saveLocale(value: Locale): Locale {
  const next = normalizeLocale(value) ?? LOCALE_DEFAULT;
  try {
    localStorage.setItem(LOCALE_KEY, next);
  } catch {
    // private mode / quota
  }
  return next;
}

export function applyLocale(value: Locale): Locale {
  const next = normalizeLocale(value) ?? LOCALE_DEFAULT;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: next }),
    );
  }
  return next;
}

/** Boot helper: persist the first-run detection, then apply it. */
export function initLocale(): Locale {
  const initial = loadLocale();
  saveLocale(initial);
  applyLocale(initial);
  return initial;
}

export function subscribeLocale(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
}

/** BCP 47 tag for `Intl` formatters following the app language. */
export function getIntlLocale(locale: Locale = loadLocale()): string {
  return locale === "pt-BR" ? "pt-BR" : "en-US";
}

// English is the source of truth: `LocaleKey` is derived from it, so a key
// missing from pt-BR is a `tsc` error by construction.
const en = {
  "settings.header.region_aria": "Settings",
  "settings.header.breadcrumb": "Settings",
  "settings.header.restore_defaults": "Restore defaults",
  "settings.header.back": "Back",
  "settings.search.placeholder": "Search settings",
  "settings.search.aria": "Search settings",
  "settings.search.clear": "Clear settings search",
  "settings.search.results_aria": "Settings search results",
  "settings.search.empty": "No matching settings",
  "settings.search.page_badge": "Page",
  "settings.group.app": "App",
  "settings.group.agents": "Agents",
  "settings.group.workspace": "Workspace",
  "settings.section.general.label": "General",
  "settings.section.general.description":
    "The build you are running, and the panels it shows.",
  "settings.section.notifications.label": "Notifications",
  "settings.section.notifications.description":
    "How MonoCode reaches you while you are looking somewhere else.",
  "settings.section.performance.label": "Performance",
  "settings.section.performance.description":
    "How MonoCode uses your hardware: GPU fast paths and terminal rendering.",
  "settings.section.appearance.label": "Appearance",
  "settings.section.appearance.description":
    "Theme, tint, translucency, and the image behind your conversations.",
  "settings.section.keybindings.label": "Keybindings",
  "settings.section.keybindings.description":
    "Every shortcut the workspace handles, from the app menu and the key handler.",
  "settings.section.chat.label": "Chat",
  "settings.section.chat.description":
    "How transcripts read, what the composer does with a follow-up, and how diffs open.",
  "settings.section.providers.label": "Providers",
  "settings.section.providers.description":
    "Agent CLIs MonoCode can drive, and the model new sessions start with.",
  "settings.section.skills.label": "Skills",
  "settings.section.skills.description":
    "Discover and manage file skills from project, personal, and harness folders.",
  "settings.section.inbox.label": "Inbox",
  "settings.section.inbox.description":
    "Connect the Inbox services that surface work alongside your sessions.",
  "settings.section.archive.label": "Archive",
  "settings.section.archive.description":
    "Projects and conversations you have archived.",
  "settings.accent.default": "Default",
  "settings.accent.blue": "Blue",
  "settings.accent.violet": "Violet",
  "settings.accent.pink": "Pink",
  "settings.accent.red": "Red",
  "settings.accent.orange": "Orange",
  "settings.accent.green": "Green",
  "settings.general.alerts.title": "Alerts",
  "settings.general.alerts.description":
    "How MonoCode reaches you while you are looking somewhere else.",
  "settings.general.sounds.label": "Sounds",
  "settings.general.sounds.description":
    "Short cues for project activity, finished turns, and available updates. Choose project notification categories in Inbox settings. Switches and Copy on a finished turn also play.",
  "settings.general.sounds.toggle": "Sounds",
  "settings.general.sounds.custom.title": "Custom sounds",
  "settings.general.sounds.custom.description":
    "Give each alert its own sound: keep the built-in cue or pick any audio file from this machine (.ogg, .wav, .mp3, .flac, .m4a, .opus).",
  "settings.general.sounds.cue.turnFinished": "Turn finished",
  "settings.general.sounds.cue.inboxUnseen": "Inbox activity",
  "settings.general.sounds.cue.linkedActivity": "Linked PR/issue activity",
  "settings.general.sounds.cue.updateAvailable": "Update available",
  "settings.general.sounds.preset": "Preset",
  "settings.general.sounds.custom.pick": "Custom file…",
  "settings.general.sounds.custom.file": "Custom file",
  "settings.general.sounds.test": "Test",
  "settings.general.sounds.preview_ignores_mute":
    "Preview plays even while muted",
  "settings.general.sounds.reset": "Reset",
  "settings.general.sounds.error.missing": "File not found — pick it again",
  "settings.general.sounds.error.decode":
    "This format cannot be decoded here — try .ogg or .wav",
  "settings.general.sounds.error.unavailable":
    "Audio playback is unavailable on this system",
  "settings.general.sounds.engine.unavailable":
    "Audio unavailable — the host WebKitGTK needs working audio (GStreamer sink + Pulse/PipeWire)",
  "settings.general.notifications.label": "Notifications",
  "settings.general.notifications.description":
    "Notify when a reminder is due, or when an agent finishes or needs input in another session or while MonoCode is in the background. Click the notification to open that session.",
  "settings.general.notifications.unsupported":
    "Not available on this platform",
  "settings.general.notifications.toggle": "Notifications",
  "settings.general.notifications.permission_needed": "Permission needed",
  "settings.general.notifications.open_system_settings":
    "Open System Settings",
  "settings.general.notifications.linux_denied_hint":
    "If notifications stay silent, allow them in your desktop's notification settings, then return here.",
  "settings.general.workspace.title": "Workspace",
  "settings.general.workspace.description":
    "Panels the project rail can carry. Turning one off hides it everywhere.",
  "settings.general.notes.label": "Notes",
  "settings.general.notes.description":
    "A global markdown notebook on the project rail. Save a finished turn from the transcript, then mention it later with @note or add it to chat.",
  "settings.general.notes.toggle": "Notes",
  "settings.general.working_agents.label": "Working agents",
  "settings.general.working_agents.description":
    "When two or more chats are in flight, a card on the project rail lists them so you can jump across projects. Finished turns stay until you open that session.",
  "settings.general.working_agents.toggle": "Working agents",
  "settings.general.session_review_shell.label": "Shell edits in review",
  "settings.general.session_review_shell.description":
    "After a shell command finishes, pull files it changed into this session's review card. Off by default: in a shared project the shell delta may include another session's edits, so adopted files are listed but never undoable.",
  "settings.general.session_review_shell.toggle": "Shell edits in review",
  "settings.general.performance.title": "Performance",
  "settings.general.performance.description":
    "How MonoCode uses your hardware. The master switch gates every fast path at once: terminal GPU rendering, glass blur, and off-viewport skipping in transcripts, diffs, and diagrams.",
  "settings.general.hardware_acceleration.label": "Hardware acceleration",
  "settings.general.hardware_acceleration.description":
    "Master switch for GPU and compositor fast paths. Applies right away, no restart needed. Turn it off on weak hardware or remote sessions.",
  "settings.general.hardware_acceleration.toggle": "Hardware acceleration",
  "settings.general.terminal_gpu.label": "Terminal GPU rendering",
  "settings.general.terminal_gpu.description":
    "Render terminals with the GPU (WebGL2) when available, falling back to software rendering otherwise. Only applies while hardware acceleration is on.",
  "settings.general.terminal_gpu.toggle": "Terminal GPU rendering",
  "settings.general.terminal_gpu.requires_master":
    "Requires the Hardware acceleration master switch above.",
  "settings.general.about.title": "About",
  "settings.general.language.label": "Language",
  "settings.general.language.description":
    "The language of the Settings interface. More surfaces follow in later updates.",
  "settings.general.language.option.english": "English",
  "settings.general.language.option.portuguese": "Português (Brasil)",
  "settings.general.update.label": "Version",
  "settings.general.update.available": "Version {availableVersion} is available.",
  "settings.general.update.downloading": "Downloading {progress}%",
  "settings.general.update.downloading_pending": "Downloading…",
  "settings.general.update.checking": "Checking for updates…",
  "settings.general.update.current": "You're on the latest version.",
  "settings.general.update.failed": "Update check failed.",
  "settings.general.update.failed_detail": "Couldn't check for updates: {error}",
  "settings.general.update.last_checked": "Last checked {time}",
  "settings.general.update.idle":
    "MonoCode updates itself from the release feed.",
  "settings.general.update.flatpak":
    "Updates are managed by Flatpak.",
  "settings.general.update.whats_new": "What's new",
  "settings.general.update.download": "Download",
  "settings.general.update.check": "Check for updates",
  "updater.dialog.title": "MonoCode",
  "updater.dialog.latest": "You're on the latest version.",
  "updater.dialog.flatpak":
    "Updates are managed by Flatpak. Update MonoCode from your software center or with `flatpak update`.",
  "updater.dialog.available_title": "Update available",
  "updater.dialog.available_body":
    "MonoCode {availableVersion} is available (you have {currentVersion}).{detail}\n\nInstall now?",
  "updater.dialog.not_configured":
    "Automatic updates aren't configured for this build.\n\nDownload releases at https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "updater.dialog.check_failed": "Couldn't check for updates.\n\n{error}",
  "updater.dialog.install_failed": "Couldn't install the update.\n\n{error}",
  "updater.permission_hint":
    "No write permission to the install folder (system path such as /usr/local/bin). Reinstall per-user into ~/.local/bin with `scripts/install-linux-desktop.sh`, or run with write access to that folder. Manual download: https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "updater.no_space_hint":
    "Not enough disk space to download the update. Free some space and try again. Manual download: https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "settings.chat.transcript.title": "Transcript",
  "settings.chat.transcript.description":
    "How a conversation reads as it grows.",
  "settings.chat.transcript_layout.label": "Transcript layout",
  "settings.chat.transcript_layout.description":
    "Full width keeps user prompts as a spanning card. Chat aligns them to the right with a max width, like a messaging app.",
  "settings.chat.transcript_layout.selector": "Transcript layout",
  "settings.chat.transcript_layout.full": "Full width",
  "settings.chat.transcript_layout.chat": "Chat",
  "settings.chat.anchor_prompts.label": "Anchor prompts to top",
  "settings.chat.anchor_prompts.description":
    "When you send, the new prompt sits at the top of the transcript and the reply grows into the space below. Turn this off to keep the classic layout, with the latest message resting on the composer.",
  "settings.chat.anchor_prompts.toggle": "Anchor prompts to top",
  "settings.chat.tasks_pill.label": "Tasks near chat",
  "settings.chat.tasks_pill.description":
    "Pin a compact task summary above the composer while the task list is scrolled out of view. Clicking it jumps back to the full list.",
  "settings.chat.tasks_pill.toggle": "Tasks near chat",
  "settings.chat.experimental_animations.label": "Experimental animations",
  "settings.chat.experimental_animations.description":
    "Smooth enter/exit for sidebars, the file pane, popovers, modals and work folds (180ms in, 150ms out). Off by default; off keeps the instant show and hide.",
  "settings.chat.experimental_animations.toggle": "Experimental animations",
  "settings.chat.composer.title": "Composer",
  "settings.chat.composer.description":
    "What the composer does with what you type.",
  "settings.chat.follow_up.label": "Follow-up behavior",
  "settings.chat.follow_up.description":
    "Queue follow-ups until the active turn finishes, or steer the active turn immediately.",
  "settings.chat.follow_up.selector": "Follow-up behavior",
  "settings.chat.follow_up.queue": "Queue",
  "settings.chat.follow_up.steer": "Steer",
  "settings.chat.model_controls.label": "Model controls",
  "settings.chat.model_controls.description":
    "Show model options beside the picker instead of inside the model menu.",
  "settings.chat.model_controls.selector": "Model controls",
  "settings.chat.model_controls.menu": "Menu",
  "settings.chat.model_controls.beside": "Beside",
  "settings.worktrees.label": "Worktrees",
  "settings.worktrees.description":
    "Manage additional worktrees for each project.",
  "settings.worktrees.project.label": "Project worktrees",
  "settings.worktrees.create": "Create worktree",
  "settings.worktrees.intro":
    "Sessions can share a worktree. Deleting one keeps its sessions by default and discards uncommitted changes. Its branch and commits are kept.",
  "settings.worktrees.refresh": "Refresh",
  "settings.worktrees.refresh_aria": "Refresh worktrees",
  "settings.worktrees.refresh_failed": "Refresh failed: {error}. Click to retry.",
  "settings.worktrees.add_project": "Add a project to manage its worktrees.",
  "settings.worktrees.loading": "Loading worktrees…",
  "settings.worktrees.empty_title": "No additional worktrees",
  "settings.worktrees.empty_body":
    "Create a worktree to work on another branch in a separate folder.",
  "settings.worktrees.unlock_first": "Unlock this worktree in Git first",
  "settings.worktrees.branch_first":
    "Create a branch before deleting this detached worktree",
  "settings.worktrees.selected_folder": "Selected project folder",
  "settings.worktrees.current_branch": "Current branch: {branch}",
  "settings.worktrees.detached_at": "Detached at {hash}",
  "settings.worktrees.sessions_using_one": "{count} session using this worktree is",
  "settings.worktrees.sessions_using_other": "{count} sessions using this worktree are",
  "settings.worktrees.missing": "Missing folder",
  "settings.worktrees.status_unavailable": "Status unavailable",
  "settings.worktrees.dirty": "Uncommitted changes",
  "settings.worktrees.clean": "Clean",
  "settings.worktrees.unpushed_one": "{count} commit is not on a remote. It stays on the branch.",
  "settings.worktrees.unpushed_other": "{count} commits are not on a remote. They stay on the branch.",
  "settings.worktrees.unpushed_one_short": "{count} commit",
  "settings.worktrees.unpushed_other_short": "{count} commits",
  "settings.worktrees.locked": "Locked",
  "settings.worktrees.reveal_aria": "Reveal {name}",
  "settings.worktrees.reveal_title": "Reveal folder",
  "settings.worktrees.delete_aria": "Delete {name}",
  "settings.worktrees.delete_title": "Delete worktree",
  "settings.worktrees.created_in": "New worktrees are created in {path}.",
  "settings.worktrees.error_sessions_kept":
    "Sessions still use this worktree and could not be deleted.",
  "settings.worktrees.error_sessions_partial":
    "Some sessions could not be deleted, so the worktree was kept.",
  "settings.worktrees.error_partial_deleted":
    "The sessions were deleted, but the worktree was kept. {error}",
  "settings.worktrees.create_title": "Create worktree",
  "settings.worktrees.create_intro":
    "An independent working copy of {path}. Existing uncommitted changes stay in their current working copy.",
  "settings.worktrees.branch_label": "Branch",
  "settings.worktrees.branch_type": "Branch type",
  "settings.worktrees.branch_new": "Create a new branch",
  "settings.worktrees.branch_existing": "Use an existing local branch",
  "settings.worktrees.branch_search": "Search options…",
  "settings.worktrees.existing_label": "Existing branch",
  "settings.worktrees.new_name": "New branch name",
  "settings.worktrees.choose_branch": "Choose a branch…",
  "settings.worktrees.search_branches": "Search local branches…",
  "settings.worktrees.no_branches": "No matching local branches",
  "settings.worktrees.new_placeholder": "feature/my-task",
  "settings.worktrees.start_from": "Start from",
  "settings.worktrees.start_search": "Search branches and refs…",
  "settings.worktrees.current_commit": "Current commit{ref}",
  "settings.worktrees.created_in_root": "Created in {path}",
  "settings.worktrees.cancel": "Cancel",
  "settings.worktrees.create_confirm": "Create worktree",
  "settings.worktrees.creating": "Creating worktree…",
  "settings.worktrees.deleting": "Deleting worktree…",
  "settings.worktrees.delete_title_confirm": "Delete worktree?",
  "settings.worktrees.delete_body":
    "This permanently deletes the working copy and everything inside it.",
  "settings.worktrees.sessions_kept": "kept. Select a branch or worktree to continue them.",
  "settings.worktrees.sessions_deleted": "permanently deleted.",
  "settings.worktrees.dirty_discarded":
    "All uncommitted and untracked changes here are discarded.",
  "settings.worktrees.unchecked_discarded":
    "Changes could not be checked. Anything uncommitted here is discarded.",
  "settings.worktrees.branch_kept": "branch and its commits are kept.",
  "settings.worktrees.branch_kept_prefix": "The",
  "settings.worktrees.branch_kept_bare": "The branch is kept.",
  "settings.worktrees.unpushed_kept": "not on a remote. They stay on the branch.",
  "settings.worktrees.delete_sessions_label": "Also delete associated sessions",
  "settings.worktrees.type_to_confirm_prefix": "Type",
  "settings.worktrees.type_to_confirm_suffix": "to confirm",
  "settings.worktrees.type_to_confirm_aria": "Type {name} to confirm",
  "settings.worktrees.delete_confirm_one": "Delete worktree and session",
  "settings.worktrees.delete_confirm_other": "Delete worktree and sessions",
  "settings.worktrees.picker_choose": "Choose working copy",
  "settings.worktrees.picker_continue":
    "Select a branch or worktree to continue this session",
  "settings.worktrees.picker_working_copy": "Working copy: {path}",
  "settings.worktrees.picker_title": "Working copies",
  "settings.worktrees.picker_search": "Search working copies…",
  "settings.worktrees.picker_search_aria": "Search working copies",
  "settings.worktrees.picker_removed":
    "This session’s worktree was deleted. Select a working copy to continue.",
  "settings.worktrees.picker_new_session":
    "Another working copy opens a new session.",
  "settings.worktrees.picker_loading": "Loading working copies…",
  "settings.worktrees.picker_unavailable": "Worktree unavailable",
  "settings.worktrees.picker_no_repo": "No repo",
  "settings.worktrees.picker_loading_short": "Loading…",
  "settings.worktrees.picker_detached": "detached {ref}",
  "settings.worktrees.picker_no_branch": "No branch selected",
  "settings.worktrees.picker_project_folder": "Project folder",
  "settings.worktrees.picker_missing": "Missing",
  "settings.worktrees.picker_no_match": "No matching working copies",
  "settings.worktrees.picker_create": "Create worktree…",
  "settings.worktrees.picker_switch": "Switch branch in this working copy…",
  "settings.worktrees.picker_manage": "Manage worktrees…",
  "settings.worktrees.picker_detached_row": "Detached {hash}",
  "settings.common.close": "Close",
  "settings.archive.sessions.delete_title": "Delete “{name}”?",
  "settings.archive.sessions.delete_description":
    "The conversation and its transcript are removed for good.",
  "settings.project_picker.choose": "Choose project",
  "settings.project_picker.move_note": "Move note to project",
  "settings.project_picker.switch": "Switch project",
  "settings.project_picker.choose_for_note": "Choose project for note",
  "settings.project_picker.title": "Project picker",
  "settings.project_picker.search": "Search projects...",
  "settings.project_picker.search_label": "Search projects",
  "settings.project_picker.no_projects": "No projects found",
  "settings.project_picker.new_project": "New project",
  "settings.project_picker.action_current": "{action}, current project {label}",
  "settings.searchable_select.choose": "Choose an option…",
  "settings.searchable_select.search": "Search options…",
  "settings.searchable_select.empty": "No matching options",
  "settings.appearance.pets.label": "Pets",
  "settings.appearance.pets.description":
    "Draw your own project pets, hide the built-ins you never pick, and bring them back any time.",
  "settings.appearance.pets.add_title": "Add a pet",
  "settings.appearance.pets.add_description":
    "Draw two 8×8 frames — resting and talking. Filled cells pick up the project color everywhere the pet appears.",
  "settings.appearance.pets.frame_group": "Frame",
  "settings.appearance.pets.frame_rest": "Rest",
  "settings.appearance.pets.frame_talk": "Talk",
  "settings.appearance.pets.pixel_editor": "Pixel editor",
  "settings.appearance.pets.pixel_aria": "Pixel row {row} column {column} {state}",
  "settings.appearance.pets.pixel_filled": "filled",
  "settings.appearance.pets.pixel_empty": "empty",
  "settings.appearance.pets.name_placeholder": "Name your pet",
  "settings.appearance.pets.name_aria": "Pet name",
  "settings.appearance.pets.save": "Save pet",
  "settings.appearance.pets.saved": "Saved — pick it from any project menu.",
  "settings.appearance.pets.error_invalid":
    "Give it a unique name (letters, numbers, dashes) and keep both frames on the grid.",
  "settings.appearance.pets.delete": "Delete",
  "settings.appearance.pets.confirm": "Confirm?",
  "settings.appearance.pets.hide": "Hide",
  "settings.appearance.pets.hidden_title": "Hidden ({count})",
  "settings.appearance.pets.restore_all": "Restore all",
  "settings.appearance.pets.show_title": "Show {name}",
  "settings.appearance.background_blur.label": "Background blur",
  "settings.appearance.background_blur.description":
    "Soften the wallpaper so text stays readable. Zero disables it.",
  "settings.appearance.background_blur.slider": "Chat background blur",
  "settings.appearance.background_blur.off": "Off",
  "settings.chat.code_review.title": "Code review",
  "settings.chat.code_review.description":
    "Where a turn's changes open when you go to read them.",
  "settings.chat.diff_view.label": "Diff view",
  "settings.chat.diff_view.description":
    "Editor keeps working-tree changes in the file. Unified stacks every changed file in one review, with sticky headers and collapsed unchanged lines.",
  "settings.chat.diff_view.selector": "Diff view",
  "settings.chat.diff_view.editor": "Editor",
  "settings.chat.diff_view.unified": "Unified",
  "settings.chat.extras.title": "Extras",
  "settings.chat.extras.description":
    "Idle animation, and nothing else. Turn both off for a still workspace.",
  "settings.chat.composer_mascot.label": "Composer mascot",
  "settings.chat.composer_mascot.description":
    "When a turn is running, the project mascot runs along the composer, bonks the scroll-to-latest button the first time, then jumps it, and sometimes grabs a coin.",
  "settings.chat.composer_mascot.toggle": "Composer mascot",
  "settings.chat.empty_session_games.label": "Empty session games",
  "settings.chat.empty_session_games.description":
    "Pac-man and snake idle on the empty-session grid. Hover the band to take control of whichever is on screen. Turn this off to keep the pane still.",
  "settings.chat.empty_session_games.toggle": "Empty session games",
  "settings.inbox.github.title": "GitHub",
  "settings.inbox.github.description":
    "Pull requests, reviews, and issues, read through the GitHub CLI.",
  "settings.inbox.gitlab.title": "GitLab",
  "settings.inbox.gitlab.description":
    "Merge requests from GitLab.com or a self-managed instance.",
  "settings.inbox.linear.title": "Linear",
  "settings.inbox.linear.description":
    "Issues assigned to you, from the teams you pick.",
  "settings.inbox.github.connection.label": "Connection",
  "settings.inbox.github.connection.connected":
    "GitHub CLI is installed and authenticated. MonoCode uses it for GitHub inbox items.",
  "settings.inbox.github.connection.auth_needed":
    "Run gh auth login in a terminal, complete the sign-in flow, then check again.",
  "settings.inbox.github.connection.not_installed":
    "Install GitHub CLI from cli.github.com, run gh auth login in a terminal, then check again.",
  "settings.inbox.github.connection.checking": "Checking",
  "settings.inbox.github.connection.connected_status": "Connected",
  "settings.inbox.github.connection.sign_in_required": "Sign in required",
  "settings.inbox.github.connection.not_installed_status": "Not installed",
  "settings.inbox.github.connection.installation_guide": "Installation guide",
  "settings.inbox.github.connection.checking_button": "Checking",
  "settings.inbox.github.connection.check_again": "Check again",
  "settings.inbox.gitlab.connection.label": "Connection",
  "settings.inbox.gitlab.connection.description":
    "Connect GitLab.com or a self-managed GitLab instance. Use a personal access token with API access; the token is stored locally and Disconnect deletes it.",
  "settings.inbox.gitlab.connection.url_placeholder": "https://gitlab.com",
  "settings.inbox.gitlab.connection.url_aria": "GitLab URL",
  "settings.inbox.gitlab.connection.token_placeholder": "glpat-…",
  "settings.inbox.gitlab.connection.token_aria": "GitLab access token",
  "settings.inbox.gitlab.connection.disconnect": "Disconnect",
  "settings.inbox.gitlab.connection.saving": "Saving",
  "settings.inbox.gitlab.connection.connect": "Connect",
  "settings.inbox.linear.api_key.label": "API key",
  "settings.inbox.linear.api_key.description":
    "Create a personal API key in Linear → Settings → Security & Access. Disconnect deletes it.",
  "settings.inbox.linear.api_key.disconnect": "Disconnect",
  "settings.inbox.linear.api_key.placeholder": "lin_api_…",
  "settings.inbox.linear.api_key.aria": "Linear API key",
  "settings.inbox.linear.api_key.saving": "Saving",
  "settings.inbox.linear.api_key.connect": "Connect",
  "settings.inbox.linear.teams.title": "Teams",
  "settings.inbox.linear.teams.description":
    "Unchecked teams stay out of the inbox.",
  "settings.inbox.linear.teams.shown": "Shown",
  "settings.inbox.linear.teams.hidden": "Hidden",
  "settings.appearance.theme_group.title": "Theme",
  "settings.appearance.theme_group.description":
    "Dark and light share the same tint, so the color settings below apply to both.",
  "settings.appearance.theme.label": "Theme",
  "settings.appearance.theme.description": "System follows the OS appearance.",
  "settings.appearance.theme.selector": "Theme",
  "settings.appearance.theme.system": "System",
  "settings.appearance.theme.dark": "Dark",
  "settings.appearance.theme.light": "Light",
  "settings.appearance.accent.label": "Accent color",
  "settings.appearance.accent.description":
    "Used for the composer send button and your message bubbles.",
  "settings.appearance.color_group.title": "Color",
  "settings.appearance.color_group.description":
    "Hue and saturation tint every surface. Lightness only moves the dark theme.",
  "settings.appearance.hue.label": "Hue",
  "settings.appearance.hue.description":
    "Base hue for accents and tinted surfaces.",
  "settings.appearance.hue.slider": "Hue",
  "settings.appearance.saturation.label": "Saturation",
  "settings.appearance.saturation.description":
    "How strongly the hue tints the interface. Zero keeps it neutral.",
  "settings.appearance.saturation.slider": "Saturation",
  "settings.appearance.dark_lightness.label": "Dark-mode lightness",
  "settings.appearance.dark_lightness.disabled":
    "This only affects dark mode. Your dark-mode value is preserved.",
  "settings.appearance.dark_lightness.description":
    "Base brightness of the dark theme. Lower values are darker; zero is true black.",
  "settings.appearance.dark_lightness.slider": "Dark-mode lightness",
  "settings.appearance.translucency_group.title": "Translucency",
  "settings.appearance.translucency_group.disabled":
    "Light mode always uses an opaque window, so these are off. Your dark-mode values are preserved.",
  "settings.appearance.translucency_group.description":
    "How much of the desktop shows through MonoCode. Blur costs more to composite the higher it goes.",
  "settings.appearance.sidebar_opacity.label": "Sidebar opacity",
  "settings.appearance.sidebar_opacity.description":
    "Applies to the project rail and the other glass panes.",
  "settings.appearance.sidebar_opacity.slider": "Sidebar opacity",
  "settings.appearance.blur.label": "Blur radius",
  "settings.appearance.blur.description": "Background blur behind the window.",
  "settings.appearance.blur.slider": "Blur radius",
  "settings.appearance.interface_blur.label": "Interface blur",
  "settings.appearance.interface_blur.description":
    "Backdrop blur inside popovers, toasts, pickers, and dialogs. Turn it off for the fastest paint on software compositing — surfaces go solid instead of translucent.",
  "settings.appearance.interface_blur.description_disabled":
    "Disabled while Hardware acceleration is off: the master switch already suspends every blur.",
  "settings.appearance.interface_blur.toggle": "Interface blur",
  "settings.appearance.main_pane_glass.label": "Main pane glass",
  "settings.appearance.main_pane_glass.description":
    "Extend the translucent treatment to the main pane behind sessions and editors.",
  "settings.appearance.main_pane_glass.toggle": "Main pane glass",
  "settings.appearance.layout_group.title": "Layout",
  "settings.appearance.interface_scale.label": "Interface scale",
  "settings.appearance.interface_scale.description":
    "Zoom the whole interface. You can also use Ctrl+=, Ctrl+-, and Ctrl+0 (Cmd on macOS).",
  "settings.appearance.interface_scale.slider": "Interface scale",
  "settings.appearance.interface_scale.reset": "Reset to 100%",
  "settings.appearance.interface_blur.open_performance": "Go to Performance",
  "settings.appearance.chat_background.title": "Chat background",
  "settings.appearance.chat_background.description":
    "An image behind your chat panes. It stays on this device.",
  "settings.appearance.chat_background.preview": "Empty chat preview at {value}%",
  "settings.appearance.chat_background.choose": "Choose an image",
  "settings.appearance.chat_background.change": "Change",
  "settings.appearance.chat_background.remove": "Remove",
  "settings.appearance.chat_background.remove_title": "Remove chat background?",
  "settings.appearance.chat_background.remove_description":
    "The conversation background returns to the default.",
  "settings.appearance.chat_background.remove_action": "Remove",
  "settings.appearance.restore_defaults.confirm_title":
    "Restore appearance defaults?",
  "settings.appearance.restore_defaults.confirm_description":
    "Theme, colors, translucency, chat background, and interface scale return to their defaults.",
  "settings.appearance.restore_defaults.confirm_action": "Restore",
  "settings.appearance.chat_background.scope.label": "Show on",
  "settings.appearance.chat_background.scope.description":
    "Empty sessions only, or every conversation.",
  "settings.appearance.chat_background.scope.selector": "Show background on",
  "settings.appearance.chat_background.scope.empty": "Empty only",
  "settings.appearance.chat_background.scope.all": "All sessions",
  "settings.appearance.chat_background.effect.label": "Background effect",
  "settings.appearance.chat_background.effect.selector": "Background effect",
  "settings.appearance.chat_background.effect.none": "None",
  "settings.appearance.chat_background.effect.dither": "Dither",
  "settings.appearance.chat_background.effect.ascii": "ASCII",
  "settings.appearance.chat_background.effect.halftone": "Halftone",
  "settings.appearance.chat_background.effect.scanlines": "Scanlines",
  "settings.appearance.chat_background.effect.description.none":
    "Shows the original artwork.",
  "settings.appearance.chat_background.effect.description.dither":
    "Rebuilds the artwork with a dithered color palette.",
  "settings.appearance.chat_background.effect.description.ascii":
    "Recreates the artwork with colored characters on black.",
  "settings.appearance.chat_background.effect.description.halftone":
    "Recreates the artwork with colored print dots on black.",
  "settings.appearance.chat_background.effect.description.scanlines":
    "Adds a pronounced horizontal display-line texture.",
  "settings.appearance.chat_background.empty_visibility.label":
    "Empty chat visibility",
  "settings.appearance.chat_background.empty_visibility.description":
    "Background strength before a chat has messages.",
  "settings.appearance.chat_background.empty_visibility.slider":
    "Empty chat background visibility",
  "settings.appearance.chat_background.session_visibility.label":
    "Session visibility",
  "settings.appearance.chat_background.session_visibility.description":
    "Background strength once the conversation has messages.",
  "settings.appearance.chat_background.session_visibility.slider":
    "Session background visibility",
  "settings.keybindings.group.title": "Shortcuts",
  "settings.keybindings.group.description":
    "Bindings come from the app menu and the workspace key handler; they aren’t customizable yet.",
  "settings.keybindings.count.singular": "binding",
  "settings.keybindings.count.plural": "bindings",
  "settings.keybindings.filter.placeholder": "Filter",
  "settings.keybindings.filter.aria": "Filter keybindings",
  "settings.keybindings.table.command": "Command",
  "settings.keybindings.table.keybinding": "Keybinding",
  "settings.keybindings.table.when": "When",
  "settings.keybindings.list.empty": "No matching bindings",
  "settings.keybindings.when.always": "Always",
  "settings.keybindings.when.session_focus": "In session",
  "settings.keybindings.when.browsing": "When not typing",
  "settings.keybindings.when.outside_editor": "Outside the editor",
  "settings.keybindings.when.composer": "Draft session composer",
  "settings.keybindings.cmd.app_search": "App: Search",
  "settings.keybindings.cmd.app_go_to_file": "App: Go to File",
  "settings.keybindings.cmd.app_command_palette": "App: Command Palette",
  "settings.keybindings.cmd.app_find_in_files": "App: Find in Files",
  "settings.keybindings.cmd.app_open_project": "App: Open Project",
  "settings.keybindings.cmd.app_new_window": "App: New Window",
  "settings.keybindings.cmd.app_toggle_sidebar": "App: Toggle Sidebar",
  "settings.keybindings.cmd.app_switch_model": "App: Switch Model",
  "settings.keybindings.cmd.composer_toggle_workspace": "Composer: Toggle Workspace",
  "settings.keybindings.cmd.view_reload": "View: Reload",
  "settings.keybindings.cmd.view_zoom_in": "View: Zoom In",
  "settings.keybindings.cmd.view_zoom_out": "View: Zoom Out",
  "settings.keybindings.cmd.view_reset_zoom": "View: Reset Zoom",
  "settings.keybindings.cmd.view_toggle_fullscreen": "View: Toggle Fullscreen",
  "settings.keybindings.cmd.tab_new": "Tab: New",
  "settings.keybindings.cmd.tab_close_others": "Tab: Close Others",
  "settings.keybindings.cmd.tab_close_all": "Tab: Close All",
  "settings.keybindings.cmd.tab_next": "Tab: Next",
  "settings.keybindings.cmd.tab_previous": "Tab: Previous",
  "settings.keybindings.cmd.tab_cycle_next": "Tab: Cycle Next",
  "settings.keybindings.cmd.tab_cycle_previous": "Tab: Cycle Previous",
  "settings.keybindings.cmd.tab_back": "Tab: Back",
  "settings.keybindings.cmd.tab_forward": "Tab: Forward",
  "settings.keybindings.cmd.tab_activate_range": "Tab: Activate 1–8",
  "settings.keybindings.cmd.tab_activate_last": "Tab: Activate Last",
  "settings.keybindings.cmd.session_archive": "Session: Archive",
  "settings.keybindings.cmd.session_previous": "Session: Previous",
  "settings.keybindings.cmd.session_next": "Session: Next",
  "settings.keybindings.cmd.project_previous": "Project: Previous",
  "settings.keybindings.cmd.project_next": "Project: Next",
  "settings.keybindings.cmd.pane_close": "Pane: Close",
  "settings.keybindings.cmd.pane_split_right": "Pane: Split Right",
  "settings.keybindings.cmd.pane_split_down": "Pane: Split Down",
  "settings.keybindings.cmd.pane_focus_left": "Pane: Focus Left",
  "settings.keybindings.cmd.pane_focus_right": "Pane: Focus Right",
  "settings.keybindings.cmd.pane_focus_up": "Pane: Focus Up",
  "settings.keybindings.cmd.pane_focus_down": "Pane: Focus Down",
  "settings.keybindings.cmd.terminal_new": "Terminal: New",
  "settings.keybindings.cmd.terminal_new_tab": "Terminal: New Tab",
  "settings.keybindings.cmd.terminal_toggle_dock": "Terminal: Toggle Dock",
  "settings.keybindings.cmd.editor_find": "Editor: Find",
  "settings.keybindings.cmd.editor_replace": "Editor: Replace",
  "settings.providers.group.title": "Agent CLIs",
  "settings.providers.group.description":
    "A provider is listed as installed once its CLI is found on your PATH. Uninstalled CLIs stay listed but are left out of the model picker, as are installed ones with Show in picker off. The model beside a provider is what its new conversations start with; Use by default picks the provider itself.",
  "settings.providers.default_hint":
    "New sessions start with the model of the provider marked Default.",
  "settings.providers.advanced.title": "Advanced",
  "settings.providers.claude_hooks.label": "Claude Code hooks",
  "settings.providers.claude_hooks.description":
    "Run the hooks configured in your settings.json files — PreToolUse command rewrites, blocks, notifications, and the rest — just as the Claude Code CLI would. Turn this off if a hook is misbehaving and you need the session back. Takes effect on the next turn.",
  "settings.providers.claude_hooks.toggle": "Claude Code hooks",
  "settings.providers.row.badge_default": "Default",
  "settings.providers.row.models_available_one": "1 model available.",
  "settings.providers.row.models_available_other":
    "{count} models available.",
  "settings.providers.row.model_selector": "{harness} model",
  "settings.providers.row.default_active": "Default",
  "settings.providers.row.use_default": "Use by default",
  "settings.providers.row.show_in_picker": "Show in picker",
  "settings.providers.row.show_in_picker_toggle":
    "Show {harness} in the model picker",
  "settings.providers.row.unavailable":
    "{name} not found{how}. Install it, or restart MonoCode if it is already installed.",
  "settings.skills.filter.placeholder": "Filter",
  "settings.skills.filter.aria": "Filter skills",
  "settings.skills.refresh": "Refresh skills",
  "settings.skills.refresh_hint": "Rescan skill folders",
  "settings.skills.count.one": "1 skill",
  "settings.skills.count.other": "{count} skills",
  "settings.skills.loading": "Loading skills…",
  "settings.skills.empty.none":
    "No skills yet. Add skill creates a starter SKILL.md.",
  "settings.skills.empty.no_match": "No matching skills",
  "settings.skills.scope.personal": "Personal",
  "settings.skills.scope.project": "Project",
  "settings.skills.preview.label": "Skill preview",
  "settings.skills.preview.close": "Close skill preview",
  "settings.skills.preview.close_hint": "Close preview (Escape)",
  "settings.skills.preview.loading": "Loading skill…",
  "settings.skills.preview.error": "Could not read SKILL.md. {error}",
  "settings.skills.preview.name_hint": "Preview {name}",
  "settings.skills.list.preview_action": "Preview skill",
  "settings.skills.list.preview_of": "Preview skill {name}",
  "settings.skills.list.copy_action": "Copy path",
  "settings.skills.list.copy_of": "Copy path of {name}",
  "settings.skills.list.reveal_action": "Reveal in file manager",
  "settings.skills.list.reveal_of": "Reveal {name} in file explorer",
  "settings.skills.list.include": "Include {name} in MonoCode catalog",
  "settings.skills.error.save":
    "Could not save the skill preference. Try again.",
  "settings.skills.error.reveal": "Could not open the folder: {error}",
  "settings.skills.error.copy": "Could not copy the path to the clipboard.",
  "settings.skills.footer.lead":
    "Hidden skills stay on disk and are excluded from MonoCode's file-skill catalog. Provider-managed skills and native commands are unaffected. Skills live in ",
  "settings.skills.footer.middle": " for this project and ",
  "settings.skills.footer.tail":
    " for you personally; harness folders are also picked up.",
  "settings.skills.form.hint": "Writes a starter SKILL.md you can edit.",
  "settings.skills.form.name_label": "Skill name",
  "settings.skills.form.name_hint":
    "Use lowercase letters, numbers, and hyphens.",
  "settings.skills.form.add": "Add skill",
  "settings.skills.form.close": "Close",
  "settings.skills.form.close_hint": "Close skill form",
  "settings.skills.form.create_hint":
    "Create a starter SKILL.md you can edit",
  "settings.skills.form.cancel": "Cancel",
  "settings.skills.form.create": "Create",
  "settings.skills.form.creating": "Creating…",
  "settings.archive.projects.title": "Archived projects",
  "settings.archive.projects.description":
    "Archive a project from the rail to keep its conversations without listing it in the sidebar.",
  "settings.archive.projects.empty": "No archived projects.",
  "settings.archive.projects.restore": "Restore",
  "settings.archive.projects.delete": "Delete",
  "settings.archive.sessions.title_in_project": "Archived in {projectName}",
  "settings.archive.sessions.title": "Archived conversations",
  "settings.archive.show_archived.label": "Show archived in the sidebar",
  "settings.archive.show_archived.description":
    "Keep archived conversations listed alongside the active ones.",
  "settings.archive.show_archived.toggle": "Show archived in the sidebar",
  "settings.archive.sessions.empty_no_project":
    "Open a project to see its archived conversations.",
  "settings.archive.sessions.empty": "No archived conversations in this project.",
  "settings.archive.sessions.unarchive": "Unarchive",
  "settings.archive.sessions.delete": "Delete",
  "settings.archive.sessions.filter_placeholder": "Filter conversations",
  "settings.archive.sessions.filter_aria": "Filter archived conversations",
  "settings.archive.sessions.empty_no_match": "No matching conversations",
  "settings.archive.dialog.aria_delete": "Delete {name}",
  "settings.archive.dialog.title": "Delete “{name}”?",
  "settings.archive.dialog.body":
    "All conversations for this project will be deleted. It also leaves the sidebar. The folder on disk stays put, and opening it again brings the project back empty.",
  "settings.archive.dialog.count_one": "1 saved conversation will be removed.",
  "settings.archive.dialog.count_other":
    "{count} saved conversations will be removed.",
  "settings.archive.dialog.cancel": "Cancel",
  "settings.archive.dialog.confirm": "Delete",
  "settings.sessions.delete.title": "Delete “{name}”?",
  "settings.sessions.delete.body": "“{name}” will be permanently deleted.",
  "settings.sessions.delete.worktree": "Also delete the unused worktree",
  "settings.sessions.delete.worktree_note":
    "The branch is kept. If files have uncommitted changes, the worktree stays.",
  "settings.sessions.delete.confirm": "Delete session",
  "settings.inbox.category.pull_requests": "Pull requests / Merge requests",
  "settings.inbox.category.issues": "Issues and Linear tasks",
  "settings.inbox.category.agent_finished": "Agent finished",
  "settings.inbox.category.agent_input": "Agent approvals and questions",
  "settings.inbox.category.reminders": "Reminders",
  "settings.inbox.project_notifications.title": "Project notifications",
  "settings.inbox.project_notifications.description":
    "Choose sounds, banners and sidebar indicators by category. Mute pauses them without changing your choices. Unread items stay marked in Inbox.",
  "settings.inbox.project_notifications.select_projects": "Select projects",
  "settings.inbox.project_notifications.done": "Done",
  "settings.inbox.project_notifications.save_error":
    "Could not save notification preferences. Please try again.",
  "settings.inbox.project_notifications.empty":
    "Open a project or connect an Inbox provider to configure its notifications.",
  "settings.inbox.project_notifications.select_all": "Select all projects",
  "settings.inbox.project_notifications.selected_count_one": "1 selected",
  "settings.inbox.project_notifications.selected_count_other":
    "{count} selected",
  "settings.inbox.project_notifications.mute_selected":
    "Mute selected projects",
  "settings.inbox.project_notifications.select_project": "Select {name}",
  "settings.inbox.project_notifications.categories_for":
    "Notification categories for {name}",
  "settings.inbox.project_notifications.category_for":
    "{category} for {name}",
  "settings.inbox.project_notifications.local": "Local project · ",
  "settings.inbox.project_notifications.all_paused":
    "All notifications paused",
  "settings.inbox.project_notifications.all_enabled":
    "All categories enabled",
  "settings.inbox.project_notifications.partial":
    "{enabled} of {total} enabled",
  "settings.inbox.project_notifications.mute_hint":
    "Your category choices apply when notifications resume. You can edit them while muted.",
  "settings.inbox.mute.status_resumed": "Muted until resumed",
  "settings.inbox.mute.status_until": "Muted until {date}",
  "settings.inbox.mute.hour_one": "hour",
  "settings.inbox.mute.hour_other": "hours",
  "settings.inbox.mute.until_resumed": "Until resumed",
  "settings.inbox.mute.custom": "Choose date and time",
  "settings.inbox.mute.tomorrow": "Tomorrow, ",
  "settings.inbox.mute.projects_muted": "{muted} of {total} projects muted",
  "settings.inbox.mute.resume": "Resume notifications",
  "settings.inbox.mute.change_duration": "Change mute duration",
  "settings.inbox.mute.mute_button": "Mute notifications",
  "settings.inbox.mute.title":
    "Mute pauses all project notifications without changing your category choices.",
  "settings.inbox.mute.muted": "Muted",
  "settings.inbox.mute.mute": "Mute",
  "settings.inbox.mute.menu_header": "Mute all notifications for",
  "settings.inbox.mute.menu_aria": "Mute notifications",
  "settings.inbox.mute.dialog_aria": "Mute project notifications",
  "settings.inbox.mute.save_error":
    "Could not save notification preferences. Please try again.",
  "settings.inbox.mute.picker_title": "Mute all notifications until",
  "settings.inbox.mute.picker_invalid": "Choose a valid date and time.",
  "settings.inbox.mute.picker_past": "Choose a date and time in the future.",
  "settings.inbox.mute.picker_cancel": "Cancel",
  "settings.inbox.mute.picker_confirm": "Mute until then",
  "session.review.shared_heading": "Shared with another session",
  "session.review.shared_by": "Also changed by {sessions}",
  "session.review.inexact.adopted": "Shell changes",
  "session.review.inexact.diverged": "Changed outside session",
  "session.review.inexact.adopted_hint":
    "Changed outside the session's edits, pulled in for review. Undo is unavailable; Keep dismisses this card.",
  "session.review.inexact.diverged_hint":
    "Changed again after the session's edit, so the diff mixes both. Undo is unavailable; Keep dismisses this card.",
};

export type LocaleKey = keyof typeof en;

const ptBR: Record<LocaleKey, string> = {
  "settings.header.region_aria": "Configurações",
  "settings.header.breadcrumb": "Configurações",
  "settings.header.restore_defaults": "Restaurar padrões",
  "settings.header.back": "Voltar",
  "settings.search.placeholder": "Pesquisar configurações",
  "settings.search.aria": "Pesquisar configurações",
  "settings.search.clear": "Limpar pesquisa",
  "settings.search.results_aria": "Resultados da pesquisa",
  "settings.search.empty": "Nenhuma configuração encontrada",
  "settings.search.page_badge": "Página",
  "settings.group.app": "App",
  "settings.group.agents": "Agentes",
  "settings.group.workspace": "Espaço de trabalho",
  "settings.section.general.label": "Geral",
  "settings.section.general.description":
    "A versão em execução e os painéis exibidos.",
  "settings.section.notifications.label": "Notificações",
  "settings.section.notifications.description":
    "Como o MonoCode avisa você quando você está olhando para outro lugar.",
  "settings.section.performance.label": "Desempenho",
  "settings.section.performance.description":
    "Como o MonoCode usa seu hardware: recursos rápidos de GPU e renderização do terminal.",
  "settings.section.appearance.label": "Aparência",
  "settings.section.appearance.description":
    "Tema, matiz, translucidez e a imagem atrás das suas conversas.",
  "settings.section.keybindings.label": "Atalhos de teclado",
  "settings.section.keybindings.description":
    "Todos os atalhos do espaço de trabalho, do menu do app e do gerenciador de teclas.",
  "settings.section.chat.label": "Chat",
  "settings.section.chat.description":
    "Como as transcrições são exibidas, o que o composer faz com acompanhamentos e como os diffs abrem.",
  "settings.section.providers.label": "Provedores",
  "settings.section.providers.description":
    "CLIs de agente que o MonoCode pode usar e o modelo com que novas sessões começam.",
  "settings.section.skills.label": "Skills",
  "settings.section.skills.description":
    "Descubra e gerencie skills de arquivo das pastas do projeto, pessoais e do harness.",
  "settings.section.inbox.label": "Caixa de entrada",
  "settings.section.inbox.description":
    "Conecte os serviços da Caixa de entrada que mostram trabalho ao lado das suas sessões.",
  "settings.section.archive.label": "Arquivo",
  "settings.section.archive.description":
    "Projetos e conversas que você arquivou.",
  "settings.accent.default": "Padrão",
  "settings.accent.blue": "Azul",
  "settings.accent.violet": "Violeta",
  "settings.accent.pink": "Rosa",
  "settings.accent.red": "Vermelho",
  "settings.accent.orange": "Laranja",
  "settings.accent.green": "Verde",
  "settings.general.alerts.title": "Alertas",
  "settings.general.alerts.description":
    "Como o MonoCode avisa você quando você está olhando para outro lugar.",
  "settings.general.sounds.label": "Sons",
  "settings.general.sounds.description":
    "Sons curtos para atividade do projeto, turnos finalizados e atualizações disponíveis. Escolha as categorias nas configurações da Caixa de entrada. Alternar e Copiar em um turno finalizado também emitem som.",
  "settings.general.sounds.toggle": "Sons",
  "settings.general.sounds.custom.title": "Sons personalizados",
  "settings.general.sounds.custom.description":
    "Dê a cada alerta o próprio som: mantenha o som embutido ou escolha um arquivo de áudio desta máquina (.ogg, .wav, .mp3, .flac, .m4a, .opus).",
  "settings.general.sounds.cue.turnFinished": "Turno finalizado",
  "settings.general.sounds.cue.inboxUnseen": "Atividade na Caixa de entrada",
  "settings.general.sounds.cue.linkedActivity": "Atividade em PR/issue vinculado",
  "settings.general.sounds.cue.updateAvailable": "Atualização disponível",
  "settings.general.sounds.preset": "Padrão",
  "settings.general.sounds.custom.pick": "Arquivo personalizado…",
  "settings.general.sounds.custom.file": "Arquivo personalizado",
  "settings.general.sounds.test": "Testar",
  "settings.general.sounds.preview_ignores_mute":
    "A prévia toca mesmo com o som desligado",
  "settings.general.sounds.reset": "Redefinir",
  "settings.general.sounds.error.missing": "Arquivo não encontrado — selecione novamente",
  "settings.general.sounds.error.decode":
    "Este formato não pode ser decodificado aqui — tente .ogg ou .wav",
  "settings.general.sounds.error.unavailable":
    "Reprodução de áudio indisponível neste sistema",
  "settings.general.sounds.engine.unavailable":
    "Áudio indisponível — o WebKitGTK do host precisa de áudio funcional (sink GStreamer + Pulse/PipeWire)",
  "settings.general.notifications.label": "Notificações",
  "settings.general.notifications.description":
    "Avisar quando um lembrete vencer ou quando um agente terminar ou precisar de atenção em outra sessão ou com o MonoCode em segundo plano. Clique na notificação para abrir a sessão.",
  "settings.general.notifications.unsupported":
    "Não disponível nesta plataforma",
  "settings.general.notifications.toggle": "Notificações",
  "settings.general.notifications.permission_needed": "Permissão necessária",
  "settings.general.notifications.open_system_settings":
    "Abrir Configurações do Sistema",
  "settings.general.notifications.linux_denied_hint":
    "Se as notificações continuarem silenciosas, libere-as nas configurações de notificação do seu ambiente e volte aqui.",
  "settings.general.workspace.title": "Espaço de trabalho",
  "settings.general.workspace.description":
    "Painéis que a barra de projetos pode exibir. Desativar um deles o oculta em todos os lugares.",
  "settings.general.notes.label": "Notas",
  "settings.general.notes.description":
    "Um bloco de notas Markdown global na barra de projetos. Salve um turno finalizado da conversa e mencione-o depois com @note ou adicione-o ao chat.",
  "settings.general.notes.toggle": "Notas",
  "settings.general.working_agents.label": "Agentes ativos",
  "settings.general.working_agents.description":
    "Quando dois ou mais chats estão em andamento, um cartão na barra de projetos os lista para você alternar entre projetos. Turnos finalizados permanecem até você abrir a sessão.",
  "settings.general.working_agents.toggle": "Agentes ativos",
  "settings.general.session_review_shell.label": "Edições do shell na revisão",
  "settings.general.session_review_shell.description":
    "Após um comando do shell terminar, inclui os arquivos alterados no cartão de revisão desta sessão. Desativado por padrão: num projeto compartilhado o resultado pode incluir edições de outra sessão, então arquivos adotados são listados mas nunca desfeitos.",
  "settings.general.session_review_shell.toggle": "Edições do shell na revisão",
  "settings.general.performance.title": "Desempenho",
  "settings.general.performance.description":
    "Como o MonoCode usa seu hardware. A chave principal controla de uma vez todos os recursos rápidos: renderização do terminal via GPU, desfoque de vidro e omissão de conteúdo fora da tela em conversas, diffs e diagramas.",
  "settings.general.hardware_acceleration.label": "Aceleração de hardware",
  "settings.general.hardware_acceleration.description":
    "Chave principal para os recursos rápidos de GPU e composição. Aplica na hora, sem reiniciar. Desative em hardware fraco ou sessões remotas.",
  "settings.general.hardware_acceleration.toggle": "Aceleração de hardware",
  "settings.general.terminal_gpu.label": "Renderização do terminal via GPU",
  "settings.general.terminal_gpu.description":
    "Renderiza terminais com a GPU (WebGL2) quando disponível, com retorno para software caso contrário. Vale apenas com a aceleração de hardware ativada.",
  "settings.general.terminal_gpu.toggle": "Renderização do terminal via GPU",
  "settings.general.terminal_gpu.requires_master":
    "Requer a chave principal Aceleração de hardware acima.",
  "settings.general.about.title": "Sobre",
  "settings.general.language.label": "Idioma",
  "settings.general.language.description":
    "O idioma da interface de Configurações. Outras telas acompanham em atualizações futuras.",
  "settings.general.language.option.english": "English",
  "settings.general.language.option.portuguese": "Português (Brasil)",
  "settings.general.update.label": "Versão",
  "settings.general.update.available": "Versão {availableVersion} disponível.",
  "settings.general.update.downloading": "Baixando {progress}%",
  "settings.general.update.downloading_pending": "Baixando…",
  "settings.general.update.checking": "Verificando atualizações…",
  "settings.general.update.current": "Você está na versão mais recente.",
  "settings.general.update.failed": "Falha ao verificar atualizações.",
  "settings.general.update.failed_detail":
    "Não foi possível verificar atualizações: {error}",
  "settings.general.update.last_checked": "Última verificação: {time}",
  "settings.general.update.idle":
    "O MonoCode se atualiza pelo feed de lançamentos.",
  "settings.general.update.flatpak":
    "Atualizações gerenciadas pelo Flatpak.",
  "settings.general.update.whats_new": "Novidades",
  "settings.general.update.download": "Baixar",
  "settings.general.update.check": "Verificar atualizações",
  "updater.dialog.title": "MonoCode",
  "updater.dialog.latest": "Você está na versão mais recente.",
  "updater.dialog.flatpak":
    "Atualizações gerenciadas pelo Flatpak. Atualize o MonoCode pela central de programas ou com `flatpak update`.",
  "updater.dialog.available_title": "Atualização disponível",
  "updater.dialog.available_body":
    "MonoCode {availableVersion} disponível (você tem {currentVersion}).{detail}\n\nInstalar agora?",
  "updater.dialog.not_configured":
    "Atualizações automáticas não configuradas nesta build.\n\nBaixe lançamentos em https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "updater.dialog.check_failed": "Não foi possível verificar atualizações.\n\n{error}",
  "updater.dialog.install_failed": "Não foi possível instalar a atualização.\n\n{error}",
  "updater.permission_hint":
    "Sem permissão de escrita na pasta de instalação (caminho de sistema como /usr/local/bin). Reinstale por usuário em ~/.local/bin com `scripts/install-linux-desktop.sh`, ou execute com acesso de escrita a essa pasta. Download manual: https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "updater.no_space_hint":
    "Sem espaço em disco para baixar a atualização. Libere espaço e tente de novo. Download manual: https://github.com/yanhenrique-dev/Monocode-linux/releases/latest",
  "settings.chat.transcript.title": "Transcrição",
  "settings.chat.transcript.description":
    "Como a conversa é exibida à medida que cresce.",
  "settings.chat.transcript_layout.label": "Layout da transcrição",
  "settings.chat.transcript_layout.description":
    "Largura total mantém seus prompts como um cartão estendido. Chat os alinha à direita com largura máxima, como um app de mensagens.",
  "settings.chat.transcript_layout.selector": "Layout da transcrição",
  "settings.chat.transcript_layout.full": "Largura total",
  "settings.chat.transcript_layout.chat": "Chat",
  "settings.chat.anchor_prompts.label": "Fixar prompts no topo",
  "settings.chat.anchor_prompts.description":
    "Ao enviar, o novo prompt fica no topo da transcrição e a resposta cresce no espaço abaixo. Desative para manter o layout clássico, com a mensagem mais recente junto ao composer.",
  "settings.chat.anchor_prompts.toggle": "Fixar prompts no topo",
  "settings.chat.tasks_pill.label": "Tarefas perto do chat",
  "settings.chat.tasks_pill.description":
    "Fixa um resumo compacto das tarefas acima do composer enquanto a lista está fora da visão. Clicar volta para a lista completa.",
  "settings.chat.tasks_pill.toggle": "Tarefas perto do chat",
  "settings.chat.experimental_animations.label": "Animações experimentais",
  "settings.chat.experimental_animations.description":
    "Entrada/saída suave para sidebars, painel de arquivos, popovers, modais e dobras de trabalho (180ms entrando, 150ms saindo). Desligado por padrão; desligado mantém mostrar e esconder na hora.",
  "settings.chat.experimental_animations.toggle": "Animações experimentais",
  "settings.chat.composer.title": "Composer",
  "settings.chat.composer.description":
    "O que o composer faz com o que você digita.",
  "settings.chat.follow_up.label": "Comportamento de acompanhamento",
  "settings.chat.follow_up.description":
    "Enfileire acompanhamentos até o turno atual terminar ou redirecione o turno atual na hora.",
  "settings.chat.follow_up.selector": "Comportamento de acompanhamento",
  "settings.chat.follow_up.queue": "Enfileirar",
  "settings.chat.follow_up.steer": "Redirecionar",
  "settings.chat.model_controls.label": "Controles do modelo",
  "settings.chat.model_controls.description":
    "Mostra as opções do modelo ao lado do seletor em vez de dentro do menu.",
  "settings.chat.model_controls.selector": "Controles do modelo",
  "settings.chat.model_controls.menu": "Menu",
  "settings.chat.model_controls.beside": "Ao lado",
  "settings.worktrees.label": "Worktrees",
  "settings.worktrees.description":
    "Gerencie worktrees adicionais para cada projeto.",
  "settings.worktrees.project.label": "Worktrees do projeto",
  "settings.worktrees.create": "Criar worktree",
  "settings.worktrees.intro":
    "Sessões podem compartilhar um worktree. Excluir um mantém suas sessões por padrão e descarta alterações não commitadas. Seu branch e commits são mantidos.",
  "settings.worktrees.refresh": "Atualizar",
  "settings.worktrees.refresh_aria": "Atualizar worktrees",
  "settings.worktrees.refresh_failed": "Falha ao atualizar: {error}. Clique para tentar de novo.",
  "settings.worktrees.add_project": "Adicione um projeto para gerenciar seus worktrees.",
  "settings.worktrees.loading": "Carregando worktrees…",
  "settings.worktrees.empty_title": "Nenhum worktree adicional",
  "settings.worktrees.empty_body":
    "Crie um worktree para trabalhar em outro branch numa pasta separada.",
  "settings.worktrees.unlock_first": "Destrave este worktree no Git primeiro",
  "settings.worktrees.branch_first":
    "Crie um branch antes de excluir este worktree destacado",
  "settings.worktrees.selected_folder": "Pasta do projeto selecionada",
  "settings.worktrees.current_branch": "Branch atual: {branch}",
  "settings.worktrees.detached_at": "Destacado em {hash}",
  "settings.worktrees.sessions_using_one": "{count} sessão neste worktree está",
  "settings.worktrees.sessions_using_other": "{count} sessões neste worktree estão",
  "settings.worktrees.missing": "Pasta ausente",
  "settings.worktrees.status_unavailable": "Status indisponível",
  "settings.worktrees.dirty": "Alterações não commitadas",
  "settings.worktrees.clean": "Limpo",
  "settings.worktrees.unpushed_one": "{count} commit não está em um remoto. Ele permanece no branch.",
  "settings.worktrees.unpushed_other": "{count} commits não estão em um remoto. Eles permanecem no branch.",
  "settings.worktrees.unpushed_one_short": "{count} commit",
  "settings.worktrees.unpushed_other_short": "{count} commits",
  "settings.worktrees.locked": "Bloqueado",
  "settings.worktrees.reveal_aria": "Revelar {name}",
  "settings.worktrees.reveal_title": "Revelar pasta",
  "settings.worktrees.delete_aria": "Excluir {name}",
  "settings.worktrees.delete_title": "Excluir worktree",
  "settings.worktrees.created_in": "Novos worktrees são criados em {path}.",
  "settings.worktrees.error_sessions_kept":
    "Sessões ainda usam este worktree e não puderam ser excluídas.",
  "settings.worktrees.error_sessions_partial":
    "Algumas sessões não puderam ser excluídas, então o worktree foi mantido.",
  "settings.worktrees.error_partial_deleted":
    "As sessões foram excluídas, mas o worktree foi mantido. {error}",
  "settings.worktrees.create_title": "Criar worktree",
  "settings.worktrees.create_intro":
    "Uma cópia de trabalho independente de {path}. Alterações não commitadas existentes ficam na cópia atual.",
  "settings.worktrees.branch_label": "Branch",
  "settings.worktrees.branch_type": "Tipo de branch",
  "settings.worktrees.branch_new": "Criar um novo branch",
  "settings.worktrees.branch_existing": "Usar um branch local existente",
  "settings.worktrees.branch_search": "Pesquisar opções…",
  "settings.worktrees.existing_label": "Branch existente",
  "settings.worktrees.new_name": "Nome do novo branch",
  "settings.worktrees.choose_branch": "Escolha um branch…",
  "settings.worktrees.search_branches": "Pesquisar branches locais…",
  "settings.worktrees.no_branches": "Nenhum branch local correspondente",
  "settings.worktrees.new_placeholder": "feature/minha-tarefa",
  "settings.worktrees.start_from": "Começar de",
  "settings.worktrees.start_search": "Pesquisar branches e refs…",
  "settings.worktrees.current_commit": "Commit atual{ref}",
  "settings.worktrees.created_in_root": "Criado em {path}",
  "settings.worktrees.cancel": "Cancelar",
  "settings.worktrees.create_confirm": "Criar worktree",
  "settings.worktrees.creating": "Criando worktree…",
  "settings.worktrees.deleting": "Excluindo worktree…",
  "settings.worktrees.delete_title_confirm": "Excluir worktree?",
  "settings.worktrees.delete_body":
    "Isso exclui permanentemente a cópia de trabalho e tudo dentro dela.",
  "settings.worktrees.sessions_kept": "mantidas. Selecione um branch ou worktree para continuar.",
  "settings.worktrees.sessions_deleted": "excluídas permanentemente.",
  "settings.worktrees.dirty_discarded":
    "Todas as alterações não commitadas e não rastreadas aqui são descartadas.",
  "settings.worktrees.unchecked_discarded":
    "Não foi possível verificar as alterações. Tudo que não está commitado aqui é descartado.",
  "settings.worktrees.branch_kept": "e seus commits são mantidos.",
  "settings.worktrees.branch_kept_prefix": "O branch",
  "settings.worktrees.branch_kept_bare": "O branch é mantido.",
  "settings.worktrees.unpushed_kept": "não estão em um remoto. Eles ficam no branch.",
  "settings.worktrees.delete_sessions_label": "Excluir também as sessões associadas",
  "settings.worktrees.type_to_confirm_prefix": "Digite",
  "settings.worktrees.type_to_confirm_suffix": "para confirmar",
  "settings.worktrees.type_to_confirm_aria": "Digite {name} para confirmar",
  "settings.worktrees.delete_confirm_one": "Excluir worktree e sessão",
  "settings.worktrees.delete_confirm_other": "Excluir worktree e sessões",
  "settings.worktrees.picker_choose": "Escolher cópia de trabalho",
  "settings.worktrees.picker_continue":
    "Selecione um branch ou worktree para continuar esta sessão",
  "settings.worktrees.picker_working_copy": "Cópia de trabalho: {path}",
  "settings.worktrees.picker_title": "Cópias de trabalho",
  "settings.worktrees.picker_search": "Pesquisar cópias de trabalho…",
  "settings.worktrees.picker_search_aria": "Pesquisar cópias de trabalho",
  "settings.worktrees.picker_removed":
    "O worktree desta sessão foi excluído. Selecione uma cópia de trabalho para continuar.",
  "settings.worktrees.picker_new_session":
    "Outra cópia de trabalho abre uma nova sessão.",
  "settings.worktrees.picker_loading": "Carregando cópias de trabalho…",
  "settings.worktrees.picker_unavailable": "Worktree indisponível",
  "settings.worktrees.picker_no_repo": "Sem repo",
  "settings.worktrees.picker_loading_short": "Carregando…",
  "settings.worktrees.picker_detached": "destacado {ref}",
  "settings.worktrees.picker_no_branch": "Nenhum branch selecionado",
  "settings.worktrees.picker_project_folder": "Pasta do projeto",
  "settings.worktrees.picker_missing": "Ausente",
  "settings.worktrees.picker_no_match": "Nenhuma cópia correspondente",
  "settings.worktrees.picker_create": "Criar worktree…",
  "settings.worktrees.picker_switch": "Trocar de branch nesta cópia…",
  "settings.worktrees.picker_manage": "Gerenciar worktrees…",
  "settings.worktrees.picker_detached_row": "Destacado {hash}",
  "settings.common.close": "Fechar",
  "settings.archive.sessions.delete_title": "Excluir “{name}”?",
  "settings.archive.sessions.delete_description":
    "A conversa e sua transcrição são removidas permanentemente.",
  "settings.project_picker.choose": "Escolher projeto",
  "settings.project_picker.move_note": "Mover nota para o projeto",
  "settings.project_picker.switch": "Trocar de projeto",
  "settings.project_picker.choose_for_note": "Escolher projeto para a nota",
  "settings.project_picker.title": "Seletor de projeto",
  "settings.project_picker.search": "Pesquisar projetos...",
  "settings.project_picker.search_label": "Pesquisar projetos",
  "settings.project_picker.no_projects": "Nenhum projeto encontrado",
  "settings.project_picker.new_project": "Novo projeto",
  "settings.project_picker.action_current": "{action}, projeto atual {label}",
  "settings.searchable_select.choose": "Escolha uma opção…",
  "settings.searchable_select.search": "Pesquisar opções…",
  "settings.searchable_select.empty": "Nenhuma opção correspondente",
  "settings.appearance.pets.label": "Pets",
  "settings.appearance.pets.description":
    "Desenhe seus próprios pets de projeto, oculte os embutidos que você nunca escolhe e traga-os de volta quando quiser.",
  "settings.appearance.pets.add_title": "Adicionar um pet",
  "settings.appearance.pets.add_description":
    "Desenhe dois quadros 8×8 — descansando e falando. As células preenchidas ganham a cor do projeto onde quer que o pet apareça.",
  "settings.appearance.pets.frame_group": "Quadro",
  "settings.appearance.pets.frame_rest": "Descanso",
  "settings.appearance.pets.frame_talk": "Falando",
  "settings.appearance.pets.pixel_editor": "Editor de pixels",
  "settings.appearance.pets.pixel_aria": "Pixel linha {row} coluna {column} {state}",
  "settings.appearance.pets.pixel_filled": "preenchido",
  "settings.appearance.pets.pixel_empty": "vazio",
  "settings.appearance.pets.name_placeholder": "Dê um nome ao pet",
  "settings.appearance.pets.name_aria": "Nome do pet",
  "settings.appearance.pets.save": "Salvar pet",
  "settings.appearance.pets.saved": "Salvo — escolha em qualquer menu de projeto.",
  "settings.appearance.pets.error_invalid":
    "Dê um nome único (letras, números, hífens) e mantenha os dois quadros na grade.",
  "settings.appearance.pets.delete": "Excluir",
  "settings.appearance.pets.confirm": "Confirmar?",
  "settings.appearance.pets.hide": "Ocultar",
  "settings.appearance.pets.hidden_title": "Ocultos ({count})",
  "settings.appearance.pets.restore_all": "Restaurar tudo",
  "settings.appearance.pets.show_title": "Mostrar {name}",
  "settings.appearance.background_blur.label": "Desfoque do fundo",
  "settings.appearance.background_blur.description":
    "Suavize o papel de parede para o texto continuar legível. Zero desativa.",
  "settings.appearance.background_blur.slider": "Desfoque do fundo do chat",
  "settings.appearance.background_blur.off": "Desligado",
  "settings.chat.code_review.title": "Revisão de código",
  "settings.chat.code_review.description":
    "Onde as alterações de um turno abrem quando você vai lê-las.",
  "settings.chat.diff_view.label": "Visualização de diff",
  "settings.chat.diff_view.description":
    "Editor mantém as alterações do diretório de trabalho no arquivo. Unificada empilha todos os arquivos alterados em uma revisão, com cabeçalhos fixos e linhas inalteradas recolhidas.",
  "settings.chat.diff_view.selector": "Visualização de diff",
  "settings.chat.diff_view.editor": "Editor",
  "settings.chat.diff_view.unified": "Unificada",
  "settings.chat.extras.title": "Extras",
  "settings.chat.extras.description":
    "Animação de inatividade, e nada mais. Desative ambas para um espaço de trabalho estático.",
  "settings.chat.composer_mascot.label": "Mascote do composer",
  "settings.chat.composer_mascot.description":
    "Quando um turno está rodando, o mascote do projeto corre pelo composer, esbarra no botão de rolar para o mais recente na primeira vez, depois o salta e às vezes pega uma moeda.",
  "settings.chat.composer_mascot.toggle": "Mascote do composer",
  "settings.chat.empty_session_games.label": "Jogos da sessão vazia",
  "settings.chat.empty_session_games.description":
    "Pac-man e cobrinha parados na grade da sessão vazia. Passe o mouse sobre a faixa para controlar o que estiver na tela. Desative para manter o painel parado.",
  "settings.chat.empty_session_games.toggle": "Jogos da sessão vazia",
  "settings.inbox.github.title": "GitHub",
  "settings.inbox.github.description":
    "Pull requests, revisões e issues, lidos via GitHub CLI.",
  "settings.inbox.gitlab.title": "GitLab",
  "settings.inbox.gitlab.description":
    "Merge requests do GitLab.com ou de uma instância própria.",
  "settings.inbox.linear.title": "Linear",
  "settings.inbox.linear.description":
    "Issues atribuídas a você, das equipes que você escolher.",
  "settings.inbox.github.connection.label": "Conexão",
  "settings.inbox.github.connection.connected":
    "GitHub CLI instalado e autenticado. O MonoCode o usa para os itens da caixa de entrada do GitHub.",
  "settings.inbox.github.connection.auth_needed":
    "Execute gh auth login em um terminal, conclua o login e verifique de novo.",
  "settings.inbox.github.connection.not_installed":
    "Instale o GitHub CLI em cli.github.com, execute gh auth login em um terminal e verifique de novo.",
  "settings.inbox.github.connection.checking": "Verificando",
  "settings.inbox.github.connection.connected_status": "Conectado",
  "settings.inbox.github.connection.sign_in_required": "Login necessário",
  "settings.inbox.github.connection.not_installed_status": "Não instalado",
  "settings.inbox.github.connection.installation_guide": "Guia de instalação",
  "settings.inbox.github.connection.checking_button": "Verificando",
  "settings.inbox.github.connection.check_again": "Verificar de novo",
  "settings.inbox.gitlab.connection.label": "Conexão",
  "settings.inbox.gitlab.connection.description":
    "Conecte o GitLab.com ou uma instância própria do GitLab. Use um token pessoal com acesso à API; ele fica salvo localmente e Desconectar o apaga.",
  "settings.inbox.gitlab.connection.url_placeholder": "https://gitlab.com",
  "settings.inbox.gitlab.connection.url_aria": "URL do GitLab",
  "settings.inbox.gitlab.connection.token_placeholder": "glpat-…",
  "settings.inbox.gitlab.connection.token_aria": "Token de acesso do GitLab",
  "settings.inbox.gitlab.connection.disconnect": "Desconectar",
  "settings.inbox.gitlab.connection.saving": "Salvando",
  "settings.inbox.gitlab.connection.connect": "Conectar",
  "settings.inbox.linear.api_key.label": "Chave de API",
  "settings.inbox.linear.api_key.description":
    "Crie uma chave de API pessoal em Linear → Configurações → Segurança e acesso. Desconectar a apaga.",
  "settings.inbox.linear.api_key.disconnect": "Desconectar",
  "settings.inbox.linear.api_key.placeholder": "lin_api_…",
  "settings.inbox.linear.api_key.aria": "Chave de API da Linear",
  "settings.inbox.linear.api_key.saving": "Salvando",
  "settings.inbox.linear.api_key.connect": "Conectar",
  "settings.inbox.linear.teams.title": "Equipes",
  "settings.inbox.linear.teams.description":
    "Equipes desmarcadas ficam fora da caixa de entrada.",
  "settings.inbox.linear.teams.shown": "Exibida",
  "settings.inbox.linear.teams.hidden": "Oculta",
  "settings.appearance.theme_group.title": "Tema",
  "settings.appearance.theme_group.description":
    "Os modos claro e escuro compartilham a mesma matiz, então os ajustes abaixo valem para ambos.",
  "settings.appearance.theme.label": "Tema",
  "settings.appearance.theme.description": "Sistema segue a aparência do SO.",
  "settings.appearance.theme.selector": "Tema",
  "settings.appearance.theme.system": "Sistema",
  "settings.appearance.theme.dark": "Escuro",
  "settings.appearance.theme.light": "Claro",
  "settings.appearance.accent.label": "Cor de destaque",
  "settings.appearance.accent.description":
    "Usada no botão de enviar e nas suas mensagens.",
  "settings.appearance.color_group.title": "Cor",
  "settings.appearance.color_group.description":
    "Matiz e saturação tingem todas as superfícies. Luminosidade afeta só o tema escuro.",
  "settings.appearance.hue.label": "Matiz",
  "settings.appearance.hue.description":
    "Matiz base para destaques e superfícies tingidas.",
  "settings.appearance.hue.slider": "Matiz",
  "settings.appearance.saturation.label": "Saturação",
  "settings.appearance.saturation.description":
    "Intensidade da matiz na interface. Zero mantém neutro.",
  "settings.appearance.saturation.slider": "Saturação",
  "settings.appearance.dark_lightness.label": "Luminosidade do modo escuro",
  "settings.appearance.dark_lightness.disabled":
    "Vale só para o modo escuro. Seu valor é preservado.",
  "settings.appearance.dark_lightness.description":
    "Brilho base do tema escuro. Valores menores são mais escuros; zero é preto puro.",
  "settings.appearance.dark_lightness.slider": "Luminosidade do modo escuro",
  "settings.appearance.translucency_group.title": "Translucidez",
  "settings.appearance.translucency_group.disabled":
    "O modo claro usa janela opaca, então isto fica desativado. Seus valores do modo escuro são preservados.",
  "settings.appearance.translucency_group.description":
    "Quanto da área de trabalho aparece através do MonoCode. Mais desfoque custa mais para compor.",
  "settings.appearance.sidebar_opacity.label": "Opacidade da barra lateral",
  "settings.appearance.sidebar_opacity.description":
    "Aplica-se à barra de projetos e aos outros painéis de vidro.",
  "settings.appearance.sidebar_opacity.slider": "Opacidade da barra lateral",
  "settings.appearance.blur.label": "Raio do desfoque",
  "settings.appearance.blur.description": "Desfoque do fundo atrás da janela.",
  "settings.appearance.blur.slider": "Raio do desfoque",
  "settings.appearance.interface_blur.label": "Desfoque da interface",
  "settings.appearance.interface_blur.description":
    "Desfoque de fundo em popovers, avisos, seletores e diálogos. Desligue para pintura mais rápida na composição por software — as superfícies ficam sólidas em vez de translúcidas.",
  "settings.appearance.interface_blur.description_disabled":
    "Desativado enquanto Aceleração de hardware está desligada: o interruptor mestre já suspende todo desfoque.",
  "settings.appearance.interface_blur.toggle": "Desfoque da interface",
  "settings.appearance.main_pane_glass.label": "Vidro no painel principal",
  "settings.appearance.main_pane_glass.description":
    "Estende a translucidez ao painel principal atrás de sessões e editores.",
  "settings.appearance.main_pane_glass.toggle": "Vidro no painel principal",
  "settings.appearance.layout_group.title": "Layout",
  "settings.appearance.interface_scale.label": "Escala da interface",
  "settings.appearance.interface_scale.description":
    "Amplia toda a interface. Use também Ctrl+=, Ctrl+- e Ctrl+0 (Cmd no macOS).",
  "settings.appearance.interface_scale.slider": "Escala da interface",
  "settings.appearance.interface_scale.reset": "Redefinir para 100%",
  "settings.appearance.interface_blur.open_performance": "Ir para Performance",
  "settings.appearance.chat_background.title": "Fundo do chat",
  "settings.appearance.chat_background.description":
    "Uma imagem atrás dos painéis de chat. Fica só neste dispositivo.",
  "settings.appearance.chat_background.preview":
    "Prévia do chat vazio a {value}%",
  "settings.appearance.chat_background.choose": "Escolher imagem",
  "settings.appearance.chat_background.change": "Trocar",
  "settings.appearance.chat_background.remove": "Remover",
  "settings.appearance.chat_background.remove_title":
    "Remover fundo do chat?",
  "settings.appearance.chat_background.remove_description":
    "O fundo das conversas volta ao padrão.",
  "settings.appearance.chat_background.remove_action": "Remover",
  "settings.appearance.restore_defaults.confirm_title":
    "Restaurar padrões de aparência?",
  "settings.appearance.restore_defaults.confirm_description":
    "Tema, cores, translucidez, fundo do chat e escala da interface voltam aos padrões.",
  "settings.appearance.restore_defaults.confirm_action": "Restaurar",
  "settings.appearance.chat_background.scope.label": "Exibir em",
  "settings.appearance.chat_background.scope.description":
    "Só sessões vazias ou todas as conversas.",
  "settings.appearance.chat_background.scope.selector": "Exibir fundo em",
  "settings.appearance.chat_background.scope.empty": "Só vazios",
  "settings.appearance.chat_background.scope.all": "Todas as sessões",
  "settings.appearance.chat_background.effect.label": "Efeito do fundo",
  "settings.appearance.chat_background.effect.selector": "Efeito do fundo",
  "settings.appearance.chat_background.effect.none": "Nenhum",
  "settings.appearance.chat_background.effect.dither": "Dither",
  "settings.appearance.chat_background.effect.ascii": "ASCII",
  "settings.appearance.chat_background.effect.halftone": "Meio-tom",
  "settings.appearance.chat_background.effect.scanlines": "Scanlines",
  "settings.appearance.chat_background.effect.description.none":
    "Mostra a arte original.",
  "settings.appearance.chat_background.effect.description.dither":
    "Reconstrói a arte com paleta de cores dithered.",
  "settings.appearance.chat_background.effect.description.ascii":
    "Recria a arte com caracteres coloridos sobre preto.",
  "settings.appearance.chat_background.effect.description.halftone":
    "Recria a arte com pontos de impressão coloridos sobre preto.",
  "settings.appearance.chat_background.effect.description.scanlines":
    "Adiciona textura de linhas horizontais de display.",
  "settings.appearance.chat_background.empty_visibility.label":
    "Visibilidade no chat vazio",
  "settings.appearance.chat_background.empty_visibility.description":
    "Intensidade do fundo antes de haver mensagens.",
  "settings.appearance.chat_background.empty_visibility.slider":
    "Visibilidade do fundo no chat vazio",
  "settings.appearance.chat_background.session_visibility.label":
    "Visibilidade na sessão",
  "settings.appearance.chat_background.session_visibility.description":
    "Intensidade do fundo quando já há mensagens.",
  "settings.appearance.chat_background.session_visibility.slider":
    "Visibilidade do fundo na sessão",
  "settings.keybindings.group.title": "Atalhos",
  "settings.keybindings.group.description":
    "Atalhos vêm do menu do app e do gerenciador de teclas; ainda não são personalizáveis.",
  "settings.keybindings.count.singular": "atalho",
  "settings.keybindings.count.plural": "atalhos",
  "settings.keybindings.filter.placeholder": "Filtrar",
  "settings.keybindings.filter.aria": "Filtrar atalhos",
  "settings.keybindings.table.command": "Comando",
  "settings.keybindings.table.keybinding": "Atalho",
  "settings.keybindings.table.when": "Quando",
  "settings.keybindings.list.empty": "Nenhum atalho correspondente",
  "settings.keybindings.when.always": "Sempre",
  "settings.keybindings.when.session_focus": "Na sessão",
  "settings.keybindings.when.browsing": "Quando não estiver digitando",
  "settings.keybindings.when.outside_editor": "Fora do editor",
  "settings.keybindings.when.composer": "Composer de rascunho",
  "settings.keybindings.cmd.app_search": "App: Pesquisar",
  "settings.keybindings.cmd.app_go_to_file": "App: Ir para arquivo",
  "settings.keybindings.cmd.app_command_palette": "App: Paleta de comandos",
  "settings.keybindings.cmd.app_find_in_files": "App: Pesquisar em arquivos",
  "settings.keybindings.cmd.app_open_project": "App: Abrir projeto",
  "settings.keybindings.cmd.app_new_window": "App: Nova janela",
  "settings.keybindings.cmd.app_toggle_sidebar": "App: Alternar barra lateral",
  "settings.keybindings.cmd.app_switch_model": "App: Trocar modelo",
  "settings.keybindings.cmd.composer_toggle_workspace": "Composer: Alternar workspace",
  "settings.keybindings.cmd.view_reload": "Exibir: Recarregar",
  "settings.keybindings.cmd.view_zoom_in": "Exibir: Ampliar",
  "settings.keybindings.cmd.view_zoom_out": "Exibir: Reduzir",
  "settings.keybindings.cmd.view_reset_zoom": "Exibir: Redefinir zoom",
  "settings.keybindings.cmd.view_toggle_fullscreen": "Exibir: Alternar tela cheia",
  "settings.keybindings.cmd.tab_new": "Aba: Nova",
  "settings.keybindings.cmd.tab_close_others": "Aba: Fechar outras",
  "settings.keybindings.cmd.tab_close_all": "Aba: Fechar todas",
  "settings.keybindings.cmd.tab_next": "Aba: Próxima",
  "settings.keybindings.cmd.tab_previous": "Aba: Anterior",
  "settings.keybindings.cmd.tab_cycle_next": "Aba: Alternar para próxima",
  "settings.keybindings.cmd.tab_cycle_previous": "Aba: Alternar para anterior",
  "settings.keybindings.cmd.tab_back": "Aba: Voltar",
  "settings.keybindings.cmd.tab_forward": "Aba: Avançar",
  "settings.keybindings.cmd.tab_activate_range": "Aba: Ativar 1–8",
  "settings.keybindings.cmd.tab_activate_last": "Aba: Ativar última",
  "settings.keybindings.cmd.session_archive": "Sessão: Arquivar",
  "settings.keybindings.cmd.session_previous": "Sessão: Anterior",
  "settings.keybindings.cmd.session_next": "Sessão: Próxima",
  "settings.keybindings.cmd.project_previous": "Projeto: Anterior",
  "settings.keybindings.cmd.project_next": "Projeto: Próximo",
  "settings.keybindings.cmd.pane_close": "Painel: Fechar",
  "settings.keybindings.cmd.pane_split_right": "Painel: Dividir à direita",
  "settings.keybindings.cmd.pane_split_down": "Painel: Dividir abaixo",
  "settings.keybindings.cmd.pane_focus_left": "Painel: Focar esquerda",
  "settings.keybindings.cmd.pane_focus_right": "Painel: Focar direita",
  "settings.keybindings.cmd.pane_focus_up": "Painel: Focar acima",
  "settings.keybindings.cmd.pane_focus_down": "Painel: Focar abaixo",
  "settings.keybindings.cmd.terminal_new": "Terminal: Novo",
  "settings.keybindings.cmd.terminal_new_tab": "Terminal: Nova aba",
  "settings.keybindings.cmd.terminal_toggle_dock": "Terminal: Alternar painel",
  "settings.keybindings.cmd.editor_find": "Editor: Pesquisar",
  "settings.keybindings.cmd.editor_replace": "Editor: Substituir",
  "settings.providers.group.title": "CLIs de agente",
  "settings.providers.group.description":
    "Um provedor aparece como instalado quando sua CLI está no PATH. CLIs não instaladas continuam listadas, mas ficam fora do seletor de modelos, assim como as instaladas com Exibir no seletor desligado. O modelo ao lado do provedor inicia novas conversas; Usar como padrão escolhe o provedor.",
  "settings.providers.default_hint":
    "Novas sessões começam com o modelo do provedor marcado como Padrão.",
  "settings.providers.advanced.title": "Avançado",
  "settings.providers.claude_hooks.label": "Hooks do Claude Code",
  "settings.providers.claude_hooks.description":
    "Executa os hooks dos seus settings.json — reescritas PreToolUse, bloqueios, notificações etc. — como a CLI do Claude Code. Desligue se um hook falhar e você precisar retomar a sessão. Vale a partir do próximo turno.",
  "settings.providers.claude_hooks.toggle": "Hooks do Claude Code",
  "settings.providers.row.badge_default": "Padrão",
  "settings.providers.row.models_available_one": "1 modelo disponível.",
  "settings.providers.row.models_available_other":
    "{count} modelos disponíveis.",
  "settings.providers.row.model_selector": "Modelo de {harness}",
  "settings.providers.row.default_active": "Padrão",
  "settings.providers.row.use_default": "Usar como padrão",
  "settings.providers.row.show_in_picker": "Exibir no seletor",
  "settings.providers.row.show_in_picker_toggle":
    "Exibir {harness} no seletor de modelos",
  "settings.providers.row.unavailable":
    "{name} não encontrado{how}. Instale-o ou reinicie o MonoCode se já estiver instalado.",
  "settings.skills.filter.placeholder": "Filtrar",
  "settings.skills.filter.aria": "Filtrar skills",
  "settings.skills.refresh": "Atualizar skills",
  "settings.skills.refresh_hint": "Reescanear pastas de skills",
  "settings.skills.count.one": "1 skill",
  "settings.skills.count.other": "{count} skills",
  "settings.skills.loading": "Carregando skills…",
  "settings.skills.empty.none":
    "Nenhuma skill ainda. Adicionar skill cria um SKILL.md inicial.",
  "settings.skills.empty.no_match": "Nenhuma skill correspondente",
  "settings.skills.scope.personal": "Pessoal",
  "settings.skills.scope.project": "Projeto",
  "settings.skills.preview.label": "Prévia da skill",
  "settings.skills.preview.close": "Fechar pré-visualização da skill",
  "settings.skills.preview.close_hint": "Fechar pré-visualização (Escape)",
  "settings.skills.preview.loading": "Carregando skill…",
  "settings.skills.preview.error": "Não foi possível ler SKILL.md. {error}",
  "settings.skills.preview.name_hint": "Prévia de {name}",
  "settings.skills.list.preview_action": "Prévia da skill",
  "settings.skills.list.preview_of": "Prévia da skill {name}",
  "settings.skills.list.copy_action": "Copiar caminho",
  "settings.skills.list.copy_of": "Copiar caminho de {name}",
  "settings.skills.list.reveal_action": "Revelar no gerenciador de arquivos",
  "settings.skills.list.reveal_of": "Revelar {name} no explorador de arquivos",
  "settings.skills.list.include": "Incluir {name} no catálogo do MonoCode",
  "settings.skills.error.save":
    "Não foi possível salvar a preferência da skill. Tente de novo.",
  "settings.skills.error.reveal": "Não foi possível abrir a pasta: {error}",
  "settings.skills.error.copy":
    "Não foi possível copiar o caminho para a área de transferência.",
  "settings.skills.footer.lead":
    "Skills ocultas permanecem no disco e ficam fora do catálogo de file-skills do MonoCode. Skills gerenciadas pelo provedor e comandos nativos não são afetados. Skills ficam em ",
  "settings.skills.footer.middle": " deste projeto e ",
  "settings.skills.footer.tail":
    " para você pessoalmente; pastas de harness também são detectadas.",
  "settings.skills.form.hint": "Escreve um SKILL.md inicial que você pode editar.",
  "settings.skills.form.name_label": "Nome da skill",
  "settings.skills.form.name_hint":
    "Use letras minúsculas, números e hifens.",
  "settings.skills.form.add": "Adicionar skill",
  "settings.skills.form.close": "Fechar",
  "settings.skills.form.close_hint": "Fechar formulário de skill",
  "settings.skills.form.create_hint":
    "Criar um SKILL.md inicial que você pode editar",
  "settings.skills.form.cancel": "Cancelar",
  "settings.skills.form.create": "Criar",
  "settings.skills.form.creating": "Criando…",
  "settings.archive.projects.title": "Projetos arquivados",
  "settings.archive.projects.description":
    "Arquive um projeto pela barra para guardar as conversas sem listá-lo na barra lateral.",
  "settings.archive.projects.empty": "Nenhum projeto arquivado.",
  "settings.archive.projects.restore": "Restaurar",
  "settings.archive.projects.delete": "Excluir",
  "settings.archive.sessions.title_in_project": "Arquivados em {projectName}",
  "settings.archive.sessions.title": "Conversas arquivadas",
  "settings.archive.show_archived.label": "Mostrar arquivados na barra lateral",
  "settings.archive.show_archived.description":
    "Mantém as conversas arquivadas junto das ativas.",
  "settings.archive.show_archived.toggle": "Mostrar arquivados na barra lateral",
  "settings.archive.sessions.empty_no_project":
    "Abra um projeto para ver suas conversas arquivadas.",
  "settings.archive.sessions.empty":
    "Nenhuma conversa arquivada neste projeto.",
  "settings.archive.sessions.unarchive": "Desarquivar",
  "settings.archive.sessions.delete": "Excluir",
  "settings.archive.sessions.filter_placeholder": "Filtrar conversas",
  "settings.archive.sessions.filter_aria": "Filtrar conversas arquivadas",
  "settings.archive.sessions.empty_no_match": "Nenhuma conversa correspondente",
  "settings.archive.dialog.aria_delete": "Excluir {name}",
  "settings.archive.dialog.title": "Excluir “{name}”?",
  "settings.archive.dialog.body":
    "Todas as conversas deste projeto serão excluídas. Ele também sai da barra lateral. A pasta no disco permanece, e abri-la de novo traz o projeto de volta vazio.",
  "settings.archive.dialog.count_one": "1 conversa salva será removida.",
  "settings.archive.dialog.count_other":
    "{count} conversas salvas serão removidas.",
  "settings.archive.dialog.cancel": "Cancelar",
  "settings.archive.dialog.confirm": "Excluir",
  "settings.sessions.delete.title": "Excluir “{name}”?",
  "settings.sessions.delete.body": "“{name}” será excluída permanentemente.",
  "settings.sessions.delete.worktree": "Excluir também o worktree não utilizado",
  "settings.sessions.delete.worktree_note":
    "O branch é mantido. Se houver alterações não commitadas, o worktree permanece.",
  "settings.sessions.delete.confirm": "Excluir sessão",
  "settings.inbox.category.pull_requests": "Pull requests / Merge requests",
  "settings.inbox.category.issues": "Issues e tarefas da Linear",
  "settings.inbox.category.agent_finished": "Agente finalizado",
  "settings.inbox.category.agent_input": "Aprovações e perguntas do agente",
  "settings.inbox.category.reminders": "Lembretes",
  "settings.inbox.project_notifications.title": "Notificações do projeto",
  "settings.inbox.project_notifications.description":
    "Escolha sons, banners e indicadores por categoria. Silenciar pausa sem mudar suas escolhas. Não lidos continuam marcados na Caixa de entrada.",
  "settings.inbox.project_notifications.select_projects":
    "Selecionar projetos",
  "settings.inbox.project_notifications.done": "Concluído",
  "settings.inbox.project_notifications.save_error":
    "Não foi possível salvar as preferências. Tente de novo.",
  "settings.inbox.project_notifications.empty":
    "Abra um projeto ou conecte um provedor para configurar as notificações.",
  "settings.inbox.project_notifications.select_all":
    "Selecionar todos os projetos",
  "settings.inbox.project_notifications.selected_count_one": "1 selecionado",
  "settings.inbox.project_notifications.selected_count_other":
    "{count} selecionados",
  "settings.inbox.project_notifications.mute_selected":
    "Silenciar projetos selecionados",
  "settings.inbox.project_notifications.select_project": "Selecionar {name}",
  "settings.inbox.project_notifications.categories_for":
    "Categorias de notificação de {name}",
  "settings.inbox.project_notifications.category_for":
    "{category} para {name}",
  "settings.inbox.project_notifications.local": "Projeto local · ",
  "settings.inbox.project_notifications.all_paused":
    "Todas as notificações pausadas",
  "settings.inbox.project_notifications.all_enabled":
    "Todas as categorias ativadas",
  "settings.inbox.project_notifications.partial":
    "{enabled} de {total} ativadas",
  "settings.inbox.project_notifications.mute_hint":
    "Suas escolhas valem quando as notificações voltarem. Você pode editá-las silenciado.",
  "settings.inbox.mute.status_resumed": "Silenciado até retomar",
  "settings.inbox.mute.status_until": "Silenciado até {date}",
  "settings.inbox.mute.hour_one": "hora",
  "settings.inbox.mute.hour_other": "horas",
  "settings.inbox.mute.until_resumed": "Até retomar",
  "settings.inbox.mute.custom": "Escolher data e hora",
  "settings.inbox.mute.tomorrow": "Amanhã, ",
  "settings.inbox.mute.projects_muted":
    "{muted} de {total} projetos silenciados",
  "settings.inbox.mute.resume": "Retomar notificações",
  "settings.inbox.mute.change_duration": "Alterar duração",
  "settings.inbox.mute.mute_button": "Silenciar notificações",
  "settings.inbox.mute.title":
    "Silenciar pausa todas as notificações sem mudar suas escolhas.",
  "settings.inbox.mute.muted": "Silenciado",
  "settings.inbox.mute.mute": "Silenciar",
  "settings.inbox.mute.menu_header": "Silenciar todas as notificações por",
  "settings.inbox.mute.menu_aria": "Silenciar notificações",
  "settings.inbox.mute.dialog_aria": "Silenciar notificações do projeto",
  "settings.inbox.mute.save_error":
    "Não foi possível salvar as preferências. Tente de novo.",
  "settings.inbox.mute.picker_title": "Silenciar todas as notificações até",
  "settings.inbox.mute.picker_invalid": "Escolha data e hora válidas.",
  "settings.inbox.mute.picker_past": "Escolha data e hora futuras.",
  "settings.inbox.mute.picker_cancel": "Cancelar",
  "settings.inbox.mute.picker_confirm": "Silenciar até lá",
  "session.review.shared_heading": "Compartilhado com outra sessão",
  "session.review.shared_by": "Também alterado por {sessions}",
  "session.review.inexact.adopted": "Alterações do shell",
  "session.review.inexact.diverged": "Alterado fora da sessão",
  "session.review.inexact.adopted_hint":
    "Alterado fora das edições da sessão, incluído para revisão. Desfazer indisponível; Manter dispensa este cartão.",
  "session.review.inexact.diverged_hint":
    "Alterado de novo após a edição da sessão, então o diff mistura os dois. Desfazer indisponível; Manter dispensa este cartão.",
};

export const STRINGS: Record<Locale, Record<LocaleKey, string>> = {
  en,
  "pt-BR": ptBR,
};

export function t(
  locale: Locale,
  key: LocaleKey,
  vars?: Record<string, string | number>,
): string {
  const template = STRINGS[locale][key] ?? STRINGS.en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type LocaleContextValue = {
  locale: Locale;
  t: (key: LocaleKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: LOCALE_DEFAULT,
  t: (key, vars) => t(LOCALE_DEFAULT, key, vars),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  useEffect(() => subscribeLocale(() => setLocale(loadLocale())), []);
  const value: LocaleContextValue = {
    locale,
    t: (key, vars) => t(locale, key, vars),
  };
  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
