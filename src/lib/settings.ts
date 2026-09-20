import { ALT, IS_MAC, IS_WIN, MOD, SHIFT } from "./platform";
import { loadLocale, t, type Locale, type LocaleKey } from "./locale";

const SECTION_KEY = "monocode.settingsSection";

export type SettingsSectionId =
  | "general"
  | "appearance"
  | "keybindings"
  | "chat"
  | "providers"
  | "skills"
  | "inbox"
  | "archive"
  | "worktrees";

/** Rail buckets. Sections list in order under their group label. */
export type SettingsGroupId = "app" | "agents" | "workspace";

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: LocaleKey }[] = [
  { id: "app", label: "settings.group.app" },
  { id: "agents", label: "settings.group.agents" },
  { id: "workspace", label: "settings.group.workspace" },
];

export type SettingsSection = {
  id: SettingsSectionId;
  group: SettingsGroupId;
  label: LocaleKey;
  description: LocaleKey;
  /** Extra words search matches the section on, beyond its label. */
  keywords?: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "general",
    group: "app",
    label: "settings.section.general.label",
    description: "settings.section.general.description",
    keywords:
      "version update sounds notifications notes rail gpu hardware acceleration performance terminal language idioma portugues locale traducao translation",
  },
  {
    id: "appearance",
    group: "app",
    label: "settings.section.appearance.label",
    description: "settings.section.appearance.description",
    keywords:
      "theme dark light color accent glass blur zoom scale wallpaper tema escuro claro cor destaque vidro desfoque escala",
  },
  {
    id: "keybindings",
    group: "app",
    label: "settings.section.keybindings.label",
    description: "settings.section.keybindings.description",
    keywords: "shortcut hotkey keyboard binding atalho teclado",
  },
  {
    id: "chat",
    group: "agents",
    label: "settings.section.chat.label",
    description: "settings.section.chat.description",
    keywords: "transcript composer prompt message diff review layout transcricao conversa mensagem",
  },
  {
    id: "providers",
    group: "agents",
    label: "settings.section.providers.label",
    description: "settings.section.providers.description",
    keywords:
      "model harness claude codex gemini cli default hooks modelo provedor padrao",
  },
  {
    id: "skills",
    group: "agents",
    label: "settings.section.skills.label",
    description: "settings.section.skills.description",
    keywords: "skill instructions prompt habilidade instrucao",
  },
  {
    id: "inbox",
    group: "workspace",
    label: "settings.section.inbox.label",
    description: "settings.section.inbox.description",
    keywords:
      "github gitlab linear connect token integration caixa entrada integracao",
  },
  {
    id: "archive",
    group: "workspace",
    label: "settings.section.archive.label",
    description: "settings.section.archive.description",
    keywords: "archived restore delete hidden arquivado restaurar excluir",
  },
  {
    id: "worktrees",
    group: "workspace",
    label: "settings.worktrees.label",
    description: "settings.worktrees.description",
    keywords: "git branch worktree working copy project create delete",
  },
];

export function settingsSectionsByGroup(): {
  id: SettingsGroupId;
  label: LocaleKey;
  sections: SettingsSection[];
}[] {
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: SETTINGS_SECTIONS.filter((section) => section.group === group.id),
  })).filter((group) => group.sections.length > 0);
}

/**
 * One searchable control. `id` is the row's `data-setting-id` in SettingsView,
 * which is also what Settings scrolls to when it opens on an anchor.
 */
export type SettingsEntry = {
  id: string;
  section: SettingsSectionId;
  label: LocaleKey;
  keywords?: string;
};

export const SETTINGS_INDEX: SettingsEntry[] = [
  {
    id: "update",
    section: "general",
    label: "settings.general.update.label",
    keywords:
      "update upgrade release what's new build changelog atualizacao versao novidades",
  },
  {
    id: "sounds",
    section: "general",
    label: "settings.general.sounds.label",
    keywords: "audio cue chime mute volume som mudo",
  },
  {
    id: "notifications",
    section: "general",
    label: "settings.general.notifications.label",
    keywords: "notify alert toast permission reminder background notificar aviso permissao",
  },
  {
    id: "language",
    section: "general",
    label: "settings.general.language.label",
    keywords: "language idioma portugues locale translation traducao",
  },
  {
    id: "notes",
    section: "general",
    label: "settings.general.notes.label",
    keywords: "notebook markdown rail scratchpad notas bloco",
  },
  {
    id: "working-agents",
    section: "general",
    label: "settings.general.working_agents.label",
    keywords: "live running sessions rail card agentes ativos",
  },
  {
    id: "hardware-acceleration",
    section: "general",
    label: "settings.general.hardware_acceleration.label",
    keywords: "gpu webgl terminal performance render aceleracao hardware desempenho",
  },
  {
    id: "terminal-gpu",
    section: "general",
    label: "settings.general.terminal_gpu.label",
    keywords: "gpu webgl terminal performance render xterm",
  },
  ...(IS_WIN
    ? [
        {
          id: "close-to-tray",
          section: "general",
          label: "settings.general.close_to_tray.label",
          keywords:
            "minimize background quit exit window taskbar windows bandeja",
        } satisfies SettingsEntry,
      ]
    : []),
  {
    id: "theme",
    section: "appearance",
    label: "settings.appearance.theme.label",
    keywords: "dark light system appearance mode escuro claro sistema tema",
  },
  {
    id: "accent-color",
    section: "appearance",
    label: "settings.appearance.accent.label",
    keywords: "highlight bubble send button tint destaque",
  },
  {
    id: "hue",
    section: "appearance",
    label: "settings.appearance.hue.label",
    keywords: "tint color chrome matiz",
  },
  {
    id: "saturation",
    section: "appearance",
    label: "settings.appearance.saturation.label",
    keywords: "tint color neutral grey gray saturacao cinza",
  },
  {
    id: "dark-lightness",
    section: "appearance",
    label: "settings.appearance.dark_lightness.label",
    keywords: "black brightness contrast background preto brilho luminosidade",
  },
  {
    id: "sidebar-opacity",
    section: "appearance",
    label: "settings.appearance.sidebar_opacity.label",
    keywords: "glass translucent transparency vibrancy opacidade barra lateral",
  },
  {
    id: "blur",
    section: "appearance",
    label: "settings.appearance.blur.label",
    keywords: "glass translucent vibrancy backdrop desfoque",
  },
  {
    id: "interface-blur",
    section: "appearance",
    label: "settings.appearance.interface_blur.label",
    keywords: "glass blur backdrop popover toast picker dialog performance desfoque interface",
  },
  {
    id: "main-pane-glass",
    section: "appearance",
    label: "settings.appearance.main_pane_glass.label",
    keywords: "translucent transparency body window painel principal vidro",
  },
  {
    id: "interface-scale",
    section: "appearance",
    label: "settings.appearance.interface_scale.label",
    keywords: "zoom font size bigger smaller ui escala fonte maior menor",
  },
  {
    id: "pets",
    section: "appearance",
    label: "settings.appearance.pets.label",
    keywords: "mascot pets pixel sprite hide custom draw",
  },
  {
    id: "chat-background",
    section: "appearance",
    label: "settings.appearance.chat_background.title",
    keywords: "wallpaper image picture opacity backdrop fundo imagem",
  },
  {
    id: "transcript-layout",
    section: "chat",
    label: "settings.chat.transcript_layout.label",
    keywords: "full width chat bubble message largura total transcricao",
  },
  {
    id: "anchor-prompts",
    section: "chat",
    label: "settings.chat.anchor_prompts.label",
    keywords: "scroll position sticky message fixar topo",
  },
  {
    id: "follow-up",
    section: "chat",
    label: "settings.chat.follow_up.label",
    keywords: "queue steer interrupt send while running fila redirecionar acompanhamento",
  },
  {
    id: "model-controls",
    section: "chat",
    label: "settings.chat.model_controls.label",
    keywords:
      "effort thinking reasoning fast service tier model picker composer esforco modelo controles",
  },
  {
    id: "composer-mascot",
    section: "chat",
    label: "settings.chat.composer_mascot.label",
    keywords: "runner animation coin fun mascote animacao",
  },
  {
    id: "diff-view",
    section: "chat",
    label: "settings.chat.diff_view.label",
    keywords: "unified editor review changes working tree unificada revisao",
  },
  {
    id: "empty-session-games",
    section: "chat",
    label: "settings.chat.empty_session_games.label",
    keywords: "pacman snake arcade grid fun jogos cobrinha",
  },
  {
    id: "claude-hooks",
    section: "providers",
    label: "settings.providers.claude_hooks.label",
    keywords: "pretooluse settings.json block command notification hooks",
  },
  {
    id: "project-notifications",
    section: "inbox",
    label: "settings.inbox.project_notifications.title",
    keywords: "mute resume sounds banners reminders categories silenciar notificacoes",
  },
  {
    id: "github",
    section: "inbox",
    label: "settings.inbox.github.title",
    keywords: "gh cli connect pull request sign in conectar",
  },
  {
    id: "gitlab",
    section: "inbox",
    label: "settings.inbox.gitlab.title",
    keywords: "token self-managed merge request connect conectar",
  },
  {
    id: "linear",
    section: "inbox",
    label: "settings.inbox.linear.title",
    keywords: "api key issues teams connect chave equipes",
  },
  {
    id: "show-archived",
    section: "archive",
    label: "settings.archive.show_archived.label",
    keywords: "hidden conversations list ocultas arquivadas",
  },
  {
    id: "project-worktrees",
    section: "worktrees",
    label: "settings.worktrees.project.label",
    keywords: "git branch working copy create delete manage",
  },
];

export type SettingsSearchResult = {
  section: SettingsSectionId;
  sectionLabel: string;
  /** Row to scroll to, or `null` when the whole section matched. */
  settingId: string | null;
  label: string;
};

/** Ranks a label/keyword pair against a lowercased needle; `null` means no match. */
function matchScore(
  needle: string,
  label: string,
  keywords?: string,
): number | null {
  const lower = label.toLowerCase();
  if (lower.startsWith(needle)) return 0;
  if (lower.includes(needle)) return 1;
  if (keywords?.toLowerCase().includes(needle)) return 2;
  return null;
}

/** Individual settings first, then whole sections, so a row wins its own name. */
export function searchSettings(
  query: string,
  limit = 8,
  locale: Locale = loadLocale(),
): SettingsSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const scored: { score: number; result: SettingsSearchResult }[] = [];

  for (const entry of SETTINGS_INDEX) {
    const label = t(locale, entry.label);
    const score = matchScore(needle, label, entry.keywords);
    if (score == null) continue;
    scored.push({
      score,
      result: {
        section: entry.section,
        sectionLabel: t(locale, settingsSectionLabel(entry.section)),
        settingId: entry.id,
        label,
      },
    });
  }

  for (const section of SETTINGS_SECTIONS) {
    const label = t(locale, section.label);
    const score = matchScore(
      needle,
      label,
      `${label} ${t(locale, section.description)} ${section.keywords ?? ""}`,
    );
    if (score == null) continue;
    scored.push({
      score: score + 0.5,
      result: {
        section: section.id,
        sectionLabel: label,
        settingId: null,
        label,
      },
    });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score || a.result.label.localeCompare(b.result.label),
    )
    .slice(0, limit)
    .map((item) => item.result);
}

export const SETTINGS_SECTION_DEFAULT: SettingsSectionId = "general";

export function isSettingsSectionId(
  value: unknown,
): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function settingsSectionLabel(id: SettingsSectionId): LocaleKey {
  return (
    SETTINGS_SECTIONS.find((section) => section.id === id)?.label ??
    "settings.section.general.label"
  );
}

export function settingsSectionDescription(id: SettingsSectionId): LocaleKey {
  return (
    SETTINGS_SECTIONS.find((section) => section.id === id)?.description ??
    "settings.section.general.description"
  );
}

export function loadSettingsSection(): SettingsSectionId {
  try {
    const raw = localStorage.getItem(SECTION_KEY);
    return isSettingsSectionId(raw) ? raw : SETTINGS_SECTION_DEFAULT;
  } catch {
    return SETTINGS_SECTION_DEFAULT;
  }
}

export function saveSettingsSection(id: SettingsSectionId) {
  try {
    localStorage.setItem(SECTION_KEY, id);
  } catch {
    // private mode / quota
  }
}

const COMPOSER_RUNNER_KEY = "monocode.composerRunner";

const FOLLOW_UP_BEHAVIOR_KEY = "monocode.followUpBehavior";

const COMPOSER_EFFORT_VISIBLE_KEY = "monocode.composerEffortVisible";

const MODEL_CONTROLS_KEY = "monocode.modelControls";

export type FollowUpBehavior = "steer" | "queue";

export const FOLLOW_UP_BEHAVIOR_DEFAULT: FollowUpBehavior = "steer";

export function loadFollowUpBehavior(): FollowUpBehavior {
  try {
    const raw = localStorage.getItem(FOLLOW_UP_BEHAVIOR_KEY);
    return raw === "queue" || raw === "steer"
      ? raw
      : FOLLOW_UP_BEHAVIOR_DEFAULT;
  } catch {
    return FOLLOW_UP_BEHAVIOR_DEFAULT;
  }
}

export function saveFollowUpBehavior(value: FollowUpBehavior) {
  try {
    localStorage.setItem(FOLLOW_UP_BEHAVIOR_KEY, value);
  } catch {
    // private mode / quota
  }
}

export type ModelControls = "menu" | "beside";

export const MODEL_CONTROLS_DEFAULT: ModelControls = "menu";

/** Fired on `window` when the composer model controls setting flips. */
export const MODEL_CONTROLS_CHANGE_EVENT = "monocode:model-controls-change";

export function loadModelControls(): ModelControls {
  try {
    const raw = localStorage.getItem(MODEL_CONTROLS_KEY);
    if (raw === "menu" || raw === "beside") return raw;
    if (raw == null) {
      // Migrate the previous effort-control toggle: on means beside the picker.
      const legacy = localStorage.getItem(COMPOSER_EFFORT_VISIBLE_KEY);
      if (legacy === "1" || legacy === "true") return "beside";
    }
  } catch {
    // private mode / quota
  }
  return MODEL_CONTROLS_DEFAULT;
}

export function saveModelControls(value: ModelControls) {
  try {
    localStorage.setItem(MODEL_CONTROLS_KEY, value);
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ModelControls>(MODEL_CONTROLS_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeModelControls(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MODEL_CONTROLS_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(MODEL_CONTROLS_CHANGE_EVENT, onStoreChange);
}

export const COMPOSER_RUNNER_DEFAULT = true;

/** Fired on `window` when the composer mascot setting flips. */
export const COMPOSER_RUNNER_CHANGE_EVENT = "monocode:composer-runner-change";

export function loadComposerRunner(): boolean {
  try {
    const raw = localStorage.getItem(COMPOSER_RUNNER_KEY);
    if (raw == null) return COMPOSER_RUNNER_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return COMPOSER_RUNNER_DEFAULT;
  }
}

export function saveComposerRunner(value: boolean) {
  try {
    localStorage.setItem(COMPOSER_RUNNER_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(COMPOSER_RUNNER_CHANGE_EVENT, { detail: value }),
  );
}

const NOTES_ENABLED_KEY = "monocode.notesEnabled";

export const NOTES_ENABLED_DEFAULT = true;

/** Fired on `window` when the Notes UI setting flips. */
export const NOTES_ENABLED_CHANGE_EVENT = "monocode:notes-enabled-change";

export function loadNotesEnabled(): boolean {
  try {
    const raw = localStorage.getItem(NOTES_ENABLED_KEY);
    if (raw == null) return NOTES_ENABLED_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return NOTES_ENABLED_DEFAULT;
  }
}

export function saveNotesEnabled(value: boolean) {
  try {
    localStorage.setItem(NOTES_ENABLED_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(NOTES_ENABLED_CHANGE_EVENT, { detail: value }),
  );
}

export function subscribeNotesEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTES_ENABLED_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(NOTES_ENABLED_CHANGE_EVENT, onStoreChange);
}

const LIVE_AGENTS_ENABLED_KEY = "monocode.liveAgentsEnabled";

export const LIVE_AGENTS_ENABLED_DEFAULT = true;

/** Fired on `window` when the working-agents rail card setting flips. */
export const LIVE_AGENTS_ENABLED_CHANGE_EVENT =
  "monocode:live-agents-enabled-change";

export function loadLiveAgentsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LIVE_AGENTS_ENABLED_KEY);
    if (raw == null) return LIVE_AGENTS_ENABLED_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return LIVE_AGENTS_ENABLED_DEFAULT;
  }
}

export function saveLiveAgentsEnabled(value: boolean) {
  try {
    localStorage.setItem(LIVE_AGENTS_ENABLED_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(LIVE_AGENTS_ENABLED_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeLiveAgentsEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LIVE_AGENTS_ENABLED_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(LIVE_AGENTS_ENABLED_CHANGE_EVENT, onStoreChange);
}

const CLOSE_TO_TRAY_KEY = "monocode.closeToTray";

export const CLOSE_TO_TRAY_DEFAULT = true;

export function loadCloseToTray(): boolean {
  // Close to tray is Windows-only: nowhere else installs a tray icon.
  if (!IS_WIN) return false;
  try {
    const raw = localStorage.getItem(CLOSE_TO_TRAY_KEY);
    if (raw == null) return CLOSE_TO_TRAY_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return CLOSE_TO_TRAY_DEFAULT;
  }
}

export function saveCloseToTray(value: boolean) {
  try {
    localStorage.setItem(CLOSE_TO_TRAY_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
}

const GRID_ARCADE_ENABLED_KEY = "monocode.gridArcadeEnabled";

export const GRID_ARCADE_ENABLED_DEFAULT = true;

/** Fired on `window` when the empty-session games setting flips. */
export const GRID_ARCADE_ENABLED_CHANGE_EVENT =
  "monocode:grid-arcade-enabled-change";

export function loadGridArcadeEnabled(): boolean {
  try {
    const raw = localStorage.getItem(GRID_ARCADE_ENABLED_KEY);
    if (raw == null) return GRID_ARCADE_ENABLED_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return GRID_ARCADE_ENABLED_DEFAULT;
  }
}

export function saveGridArcadeEnabled(value: boolean) {
  try {
    localStorage.setItem(GRID_ARCADE_ENABLED_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(GRID_ARCADE_ENABLED_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeGridArcadeEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(GRID_ARCADE_ENABLED_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(GRID_ARCADE_ENABLED_CHANGE_EVENT, onStoreChange);
}

const TERMINAL_GPU_KEY = "monocode.terminalGpu";

export const TERMINAL_GPU_DEFAULT = true;

/** Fired on `window` when the terminal GPU rendering setting flips. */
export const TERMINAL_GPU_CHANGE_EVENT = "monocode:terminal-gpu-change";

export function loadTerminalGpu(): boolean {
  try {
    const raw = localStorage.getItem(TERMINAL_GPU_KEY);
    if (raw == null) return TERMINAL_GPU_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return TERMINAL_GPU_DEFAULT;
  }
}

export function saveTerminalGpu(value: boolean) {
  try {
    localStorage.setItem(TERMINAL_GPU_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(TERMINAL_GPU_CHANGE_EVENT, { detail: value }),
  );
}

export function subscribeTerminalGpu(
  onStoreChange: (enabled: boolean) => void,
) {
  if (typeof window === "undefined") return () => {};
  const onEvent = (event: Event) => {
    onStoreChange((event as CustomEvent<boolean>).detail);
  };
  window.addEventListener(TERMINAL_GPU_CHANGE_EVENT, onEvent);
  return () => window.removeEventListener(TERMINAL_GPU_CHANGE_EVENT, onEvent);
}

const DIFF_VIEWER_KEY = "monocode.diffViewer";

export type DiffViewer = "editor" | "unified";

export const DIFF_VIEWER_DEFAULT: DiffViewer = "editor";

/** Fired on `window` when the working-tree diff layout flips. */
export const DIFF_VIEWER_CHANGE_EVENT = "monocode:diff-viewer-change";

function isDiffViewer(value: unknown): value is DiffViewer {
  return value === "editor" || value === "unified";
}

export function loadDiffViewer(): DiffViewer {
  try {
    const raw = localStorage.getItem(DIFF_VIEWER_KEY);
    return isDiffViewer(raw) ? raw : DIFF_VIEWER_DEFAULT;
  } catch {
    return DIFF_VIEWER_DEFAULT;
  }
}

export function saveDiffViewer(value: DiffViewer) {
  const next = isDiffViewer(value) ? value : DIFF_VIEWER_DEFAULT;
  try {
    localStorage.setItem(DIFF_VIEWER_KEY, next);
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DiffViewer>(DIFF_VIEWER_CHANGE_EVENT, { detail: next }),
  );
}

export function subscribeDiffViewer(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DIFF_VIEWER_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(DIFF_VIEWER_CHANGE_EVENT, onStoreChange);
}

const CLAUDE_HOOKS_KEY = "monocode.claudeHooks";

export const CLAUDE_HOOKS_DEFAULT = true;

export function loadClaudeHooks(): boolean {
  try {
    const raw = localStorage.getItem(CLAUDE_HOOKS_KEY);
    if (raw == null) return CLAUDE_HOOKS_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return CLAUDE_HOOKS_DEFAULT;
  }
}

export function saveClaudeHooks(value: boolean) {
  try {
    localStorage.setItem(CLAUDE_HOOKS_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
}

const CTRL = IS_MAC ? "⌃" : "Ctrl+";

export type KeybindingRow = {
  command: LocaleKey;
  keys: string;
  when: string;
};

/** The single human `when` value; technical expressions render verbatim. */
export const KEYBINDING_ALWAYS_KEY = "settings.keybindings.when.always" as const;

export function keybindingWhenLabel(
  when: string,
  locale: Locale = loadLocale(),
): string {
  return when === "Always" ? t(locale, KEYBINDING_ALWAYS_KEY) : when;
}

/**
 * Mirrors the bindings we actually handle: the native menu accelerators in
 * `src-tauri/src/menu.rs`, `tabCommand`, the window key handler in App, and
 * focused surface handlers such as the draft composer workspace toggle.
 */
export const KEYBINDINGS: KeybindingRow[] = [
  { command: "settings.keybindings.cmd.app_search", keys: `${MOD}K`, when: "Always" },
  { command: "settings.keybindings.cmd.app_go_to_file", keys: `${MOD}P`, when: "Always" },
  { command: "settings.keybindings.cmd.app_command_palette", keys: `${MOD}${SHIFT}P`, when: "Always" },
  { command: "settings.keybindings.cmd.app_find_in_files", keys: `${MOD}${SHIFT}F`, when: "Always" },
  { command: "settings.keybindings.cmd.app_open_project", keys: `${MOD}O`, when: "Always" },
  { command: "settings.keybindings.cmd.app_new_window", keys: `${MOD}${SHIFT}N`, when: "Always" },
  { command: "settings.keybindings.cmd.app_toggle_sidebar", keys: `${MOD}B`, when: "Always" },
  { command: "settings.keybindings.cmd.app_switch_model", keys: `${MOD}.`, when: "Always" },
  {
    command: "settings.keybindings.cmd.composer_toggle_workspace",
    keys: `${MOD}${SHIFT}G`,
    when: "Draft session composer",
  },
  { command: "settings.keybindings.cmd.view_reload", keys: `${MOD}${SHIFT}R`, when: "Always" },
  { command: "settings.keybindings.cmd.view_zoom_in", keys: `${MOD}+`, when: "Always" },
  { command: "settings.keybindings.cmd.view_zoom_out", keys: `${MOD}-`, when: "Always" },
  { command: "settings.keybindings.cmd.view_reset_zoom", keys: `${MOD}0`, when: "Always" },
  { command: "settings.keybindings.cmd.view_toggle_fullscreen", keys: "F11", when: "Always" },
  { command: "settings.keybindings.cmd.tab_new", keys: `${MOD}T`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_close_others", keys: `${MOD}${ALT}T`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_close_all", keys: `${MOD}${SHIFT}W`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_next", keys: `${MOD}${SHIFT}]`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_previous", keys: `${MOD}${SHIFT}[`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_cycle_next", keys: `${CTRL}Tab`, when: "Always" },
  {
    command: "settings.keybindings.cmd.tab_cycle_previous",
    keys: `${CTRL}${SHIFT}Tab`,
    when: "Always",
  },
  { command: "settings.keybindings.cmd.tab_back", keys: `${MOD}[`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_forward", keys: `${MOD}]`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_activate_range", keys: `${MOD}1 … ${MOD}8`, when: "Always" },
  { command: "settings.keybindings.cmd.tab_activate_last", keys: `${MOD}9`, when: "Always" },
  {
    command: "settings.keybindings.cmd.session_archive",
    keys: `${MOD}${SHIFT}A`,
    when: "sessionFocus && !overlay",
  },
  {
    command: "settings.keybindings.cmd.session_previous",
    keys: `${MOD}${SHIFT}↑`,
    when: "!overlay && (!textFocus || emptyComposer)",
  },
  {
    command: "settings.keybindings.cmd.session_next",
    keys: `${MOD}${SHIFT}↓`,
    when: "!overlay && (!textFocus || emptyComposer)",
  },
  {
    command: "settings.keybindings.cmd.project_previous",
    keys: `${MOD}${SHIFT}←`,
    when: "!overlay && (!textFocus || emptyComposer)",
  },
  {
    command: "settings.keybindings.cmd.project_next",
    keys: `${MOD}${SHIFT}→`,
    when: "!overlay && (!textFocus || emptyComposer)",
  },
  { command: "settings.keybindings.cmd.pane_close", keys: `${MOD}W`, when: "Always" },
  { command: "settings.keybindings.cmd.pane_split_right", keys: `${MOD}D`, when: "!editorFocus" },
  {
    command: "settings.keybindings.cmd.pane_split_down",
    keys: `${MOD}${SHIFT}D`,
    when: "!editorFocus",
  },
  { command: "settings.keybindings.cmd.pane_focus_left", keys: `${MOD}${ALT}←`, when: "Always" },
  { command: "settings.keybindings.cmd.pane_focus_right", keys: `${MOD}${ALT}→`, when: "Always" },
  { command: "settings.keybindings.cmd.pane_focus_up", keys: `${MOD}${ALT}↑`, when: "Always" },
  { command: "settings.keybindings.cmd.pane_focus_down", keys: `${MOD}${ALT}↓`, when: "Always" },
  { command: "settings.keybindings.cmd.terminal_new", keys: `${MOD}\``, when: "Always" },
  { command: "settings.keybindings.cmd.terminal_new_tab", keys: `${MOD}${SHIFT}\``, when: "Always" },
  { command: "settings.keybindings.cmd.terminal_toggle_dock", keys: `${MOD}J`, when: "Always" },
  { command: "settings.keybindings.cmd.editor_find", keys: `${MOD}F`, when: "editorFocus" },
  { command: "settings.keybindings.cmd.editor_replace", keys: `${MOD}${ALT}F`, when: "editorFocus" },
];

export function filterKeybindings(
  rows: KeybindingRow[],
  query: string,
  locale: Locale = loadLocale(),
): KeybindingRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const command = t(locale, row.command).toLowerCase();
    return (
      command.includes(needle) ||
      row.keys.toLowerCase().includes(needle) ||
      row.when.toLowerCase().includes(needle) ||
      keybindingWhenLabel(row.when, locale).toLowerCase().includes(needle)
    );
  });
}
