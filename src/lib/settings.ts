import { ALT, MOD, SHIFT } from "./platform";
import {
  NEXT_STEP_ACTIONS,
  type NextStepAction,
  type NextStepSelection,
} from "./nextSteps";
import { loadLocale, t, type Locale, type LocaleKey } from "./locale";

const SECTION_KEY = "monocode.settingsSection";

export type SettingsSectionId =
  | "general"
  | "notifications"
  | "performance"
  | "appearance"
  | "keybindings"
  | "chat"
  | "providers"
  | "skills"
  | "inbox"
  | "archive"
  | "worktrees"
  | "experimental";

/** Rail buckets. Sections list in order under their group label. */
export type SettingsGroupId = "app" | "agents" | "workspace" | "experimental";

export const SETTINGS_GROUPS: { id: SettingsGroupId; label: LocaleKey }[] = [
  { id: "app", label: "settings.group.app" },
  { id: "agents", label: "settings.group.agents" },
  { id: "workspace", label: "settings.group.workspace" },
  // Last on purpose: the rail renders groups in array order, and unstable
  // features read better as a bucket at the foot of the list.
  { id: "experimental", label: "settings.group.experimental" },
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
      "version update notes rail language idioma portugues locale traducao translation",
  },
  {
    id: "notifications",
    group: "app",
    label: "settings.section.notifications.label",
    description: "settings.section.notifications.description",
    keywords:
      "sounds notifications notify alert toast permission reminder background mute audio cue chime volume sons notificacoes notificar aviso permissao silenciar",
  },
  {
    id: "performance",
    group: "app",
    label: "settings.section.performance.label",
    description: "settings.section.performance.description",
    keywords:
      "gpu webgl terminal performance render slow lag desempenho aceleracao hardware",
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
    keywords:
      "transcript composer prompt message diff review layout transcricao conversa mensagem",
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
  {
    id: "experimental",
    group: "experimental",
    label: "settings.section.experimental.label",
    description: "settings.section.experimental.description",
    keywords: "experimental unstable lab beta try flag instavel beta teste",
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
 * The `data-setting-id` Settings should reveal when it opens: one of the ids in
 * `SETTINGS_INDEX`. Inbox integrations pass their provider id.
 */
export type SettingsAnchor = string;

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
    section: "notifications",
    label: "settings.general.sounds.label",
    keywords: "audio cue chime mute volume som mudo",
  },
  {
    id: "sounds-turnFinished",
    section: "notifications",
    label: "settings.general.sounds.cue.turnFinished",
    keywords:
      "custom sound file audio ogg wav mp3 som personalizado arquivo turno finished done flac m4a opus",
  },
  {
    id: "sounds-inboxUnseen",
    section: "notifications",
    label: "settings.general.sounds.cue.inboxUnseen",
    keywords:
      "custom sound file audio ogg wav mp3 som personalizado arquivo inbox activity atividade caixa entrada flac m4a opus",
  },
  {
    id: "sounds-linkedActivity",
    section: "notifications",
    label: "settings.general.sounds.cue.linkedActivity",
    keywords:
      "custom sound file audio ogg wav mp3 som personalizado arquivo linked pr issue atividade vinculada flac m4a opus",
  },
  {
    id: "sounds-updateAvailable",
    section: "notifications",
    label: "settings.general.sounds.cue.updateAvailable",
    keywords:
      "custom sound file audio ogg wav mp3 som personalizado arquivo update available atualizacao flac m4a opus",
  },
  {
    id: "notifications",
    section: "notifications",
    label: "settings.general.notifications.label",
    keywords:
      "notify alert toast permission reminder background notificar aviso permissao",
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
    id: "session-review-shell",
    section: "general",
    label: "settings.general.session_review_shell.label",
    keywords:
      "session review changes shell terminal command adopt review diff sessao revisao alteracoes shell terminal comando",
  },
  {
    id: "hardware-acceleration",
    section: "performance",
    label: "settings.general.hardware_acceleration.label",
    keywords:
      "gpu webgl terminal performance render aceleracao hardware desempenho",
  },
  {
    id: "terminal-gpu",
    section: "performance",
    label: "settings.general.terminal_gpu.label",
    keywords: "gpu webgl terminal performance render xterm",
  },
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
    keywords:
      "glass blur backdrop popover toast picker dialog performance desfoque interface",
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
    id: "tasks-pill",
    section: "chat",
    label: "settings.chat.tasks_pill.label",
    keywords: "tasks todo pill near chat composer fixar tarefas",
  },
  {
    id: "experimental-animations",
    section: "experimental",
    label: "settings.experimental.experimental_animations.label",
    keywords:
      "experimental animations motion transition enter exit composer strip animacoes movimento transicao",
  },
  {
    id: "follow-up",
    section: "chat",
    label: "settings.chat.follow_up.label",
    keywords:
      "queue steer interrupt send while running fila redirecionar acompanhamento",
  },
  {
    id: "next-steps",
    section: "experimental",
    label: "settings.experimental.next_steps.label",
    keywords:
      "next steps suggestions shortcuts experimental composer proximos passos sugestoes atalhos",
  },
  {
    id: "next-step-suggest",
    section: "experimental",
    label: "settings.experimental.next_steps.suggest.label",
    keywords:
      "next step suggest model llm ai follow ups proximos passos sugerir modelo sugerir",
  },
  {
    id: "next-step-jump-to-bottom",
    section: "experimental",
    label: "settings.experimental.next_steps.action.jump-to-bottom.label",
    keywords:
      "next step jump latest scroll bottom scroll to end proximos passos pular final rolar",
  },
  {
    id: "next-step-search-transcript",
    section: "experimental",
    label: "settings.experimental.next_steps.action.search-transcript.label",
    keywords:
      "next step find search transcript text next steps pesquisar buscar transcricao texto",
  },
  {
    id: "next-step-review-changes",
    section: "experimental",
    label: "settings.experimental.next_steps.action.review-changes.label",
    keywords:
      "next step review diff changes working tree proximos passos revisar diff alteracoes",
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
    section: "experimental",
    label: "settings.experimental.composer_mascot.label",
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
    section: "experimental",
    label: "settings.experimental.empty_session_games.label",
    keywords: "pacman snake arcade grid fun jogos cobrinha",
  },
  {
    id: "debug-logging",
    section: "experimental",
    label: "settings.experimental.diagnostics.debug_scopes.label",
    keywords:
      "debug logging scopes diagnostics verbose log logs depuracao registro escopos",
  },
  {
    id: "claude-hooks",
    section: "providers",
    label: "settings.providers.claude_hooks.label",
    keywords: "pretooluse settings.json block command notification hooks",
  },
  {
    id: "project-notifications",
    section: "notifications",
    label: "settings.inbox.project_notifications.title",
    keywords:
      "mute resume sounds banners reminders categories silenciar notificacoes",
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

/** Strips combining marks so "desfoque" matches "desfóque" and vice versa. */
function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Ranks a label/keyword pair against a lowercased needle; `null` means no match. */
function matchScore(
  needle: string,
  label: string,
  keywords?: string,
): number | null {
  const foldedNeedle = foldAccents(needle);
  const lower = foldAccents(label.toLowerCase());
  if (lower.startsWith(foldedNeedle)) return 0;
  if (lower.includes(foldedNeedle)) return 1;
  if (keywords && foldAccents(keywords.toLowerCase()).includes(foldedNeedle)) {
    return 2;
  }
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

export const FOLLOW_UP_BEHAVIOR_DEFAULT: FollowUpBehavior = "queue";

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

const NEXT_STEPS_ENABLED_KEY = "monocode.nextStepsEnabled";

/**
 * The model call is separable from the bar. Both are experimental, but they
 * cost different things: the static shortcuts are free and local, the
 * suggestions are a short side-channel call on every completed turn.
 */
const NEXT_STEPS_SUGGEST_KEY = "monocode.nextSteps.suggest";
export const NEXT_STEPS_SUGGEST_DEFAULT = true;

/**
 * One flag per action. The previous `monocode.nextStepsCount` was a `2 | 3`
 * number that the caller then filtered down from, so the number lied; naming
 * the actions directly makes the choice explicit and reachable.
 */
const NEXT_STEP_ACTION_KEYS = {
  "jump-to-bottom": "monocode.nextSteps.jumpToBottom",
  "search-transcript": "monocode.nextSteps.searchTranscript",
  "review-changes": "monocode.nextSteps.reviewChanges",
} as const satisfies Record<NextStepAction, string>;

/**
 * Defaults keep the two actions the old count selector could actually show,
 * and leave `review-changes` off: at a count of 2 it was unreachable, and at 3
 * it required jump-to-bottom to be visible at the same time.
 */
export const NEXT_STEP_ACTION_DEFAULTS: NextStepSelection = {
  "jump-to-bottom": true,
  "search-transcript": true,
  "review-changes": false,
};

/** The same defaults in snapshot form, for the server/client fallback. */
export const NEXT_STEP_ACTION_DEFAULTS_RAW = NEXT_STEP_ACTIONS.map((action) =>
  NEXT_STEP_ACTION_DEFAULTS[action] ? "1" : "0",
).join("");

export const NEXT_STEPS_CHANGE_EVENT = "monocode:next-steps-change";
export const NEXT_STEPS_ENABLED_DEFAULT = false;

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NEXT_STEPS_CHANGE_EVENT));
}

export function loadNextStepsEnabled(): boolean {
  return readFlag(NEXT_STEPS_ENABLED_KEY, NEXT_STEPS_ENABLED_DEFAULT);
}

export function saveNextStepsEnabled(value: boolean) {
  writeFlag(NEXT_STEPS_ENABLED_KEY, value);
}

export function loadNextStepsSuggest(): boolean {
  return readFlag(NEXT_STEPS_SUGGEST_KEY, NEXT_STEPS_SUGGEST_DEFAULT);
}

export function saveNextStepsSuggest(value: boolean) {
  writeFlag(NEXT_STEPS_SUGGEST_KEY, value);
}

export function loadNextStepAction(action: NextStepAction): boolean {
  return readFlag(
    NEXT_STEP_ACTION_KEYS[action],
    NEXT_STEP_ACTION_DEFAULTS[action],
  );
}

export function saveNextStepAction(action: NextStepAction, value: boolean) {
  writeFlag(NEXT_STEP_ACTION_KEYS[action], value);
}

/**
 * Store snapshot: one character per action, in `NEXT_STEP_ACTIONS` order.
 *
 * A primitive on purpose. Handing `useSyncExternalStore` a fresh object per
 * read means `Object.is` never matches and the view re-renders forever;
 * callers derive the object with `parseNextStepSelection`.
 */
export function loadNextStepSelectionRaw(): string {
  return NEXT_STEP_ACTIONS.map((action) =>
    readFlag(NEXT_STEP_ACTION_KEYS[action], NEXT_STEP_ACTION_DEFAULTS[action])
      ? "1"
      : "0",
  ).join("");
}

/** Inverse of `loadNextStepSelectionRaw`, with defaults for a short string. */
export function parseNextStepSelection(raw: string): NextStepSelection {
  const selection = { ...NEXT_STEP_ACTION_DEFAULTS };
  NEXT_STEP_ACTIONS.forEach((action, index) => {
    const bit = raw[index];
    if (bit === "1") selection[action] = true;
    else if (bit === "0") selection[action] = false;
  });
  return selection;
}

export function subscribeNextSteps(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === NEXT_STEPS_ENABLED_KEY ||
      event.key === NEXT_STEPS_SUGGEST_KEY ||
      NEXT_STEP_ACTIONS.some(
        (action) => event.key === NEXT_STEP_ACTION_KEYS[action],
      )
    ) {
      onStoreChange();
    }
  };
  window.addEventListener(NEXT_STEPS_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(NEXT_STEPS_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
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

export const COMPOSER_RUNNER_DEFAULT = false;

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

const REVIEW_ADOPT_SHELL_KEY = "monocode.reviewAdoptShell";

/** Adopt shell-made file changes into session review. Off by default: in a
 * shared project the shell delta may contain bytes written by another
 * session, so adopted entries are never exact nor undoable. */
export const REVIEW_ADOPT_SHELL_DEFAULT = false;

/** Fired on `window` when the shell-adopt review setting flips. */
export const REVIEW_ADOPT_SHELL_CHANGE_EVENT =
  "monocode:review-adopt-shell-change";

export function loadReviewAdoptShell(): boolean {
  try {
    const raw = localStorage.getItem(REVIEW_ADOPT_SHELL_KEY);
    if (raw == null) return REVIEW_ADOPT_SHELL_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return REVIEW_ADOPT_SHELL_DEFAULT;
  }
}

export function saveReviewAdoptShell(value: boolean) {
  try {
    localStorage.setItem(REVIEW_ADOPT_SHELL_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(REVIEW_ADOPT_SHELL_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeReviewAdoptShell(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(REVIEW_ADOPT_SHELL_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(REVIEW_ADOPT_SHELL_CHANGE_EVENT, onStoreChange);
}

const GRID_ARCADE_ENABLED_KEY = "monocode.gridArcadeEnabled";

export const GRID_ARCADE_ENABLED_DEFAULT = false;

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

const CTRL = "Ctrl+";

export type KeybindingRow = {
  command: LocaleKey;
  keys: string;
  when: string;
};

/** Human labels for `when` guards; unknown expressions render verbatim. */
export const KEYBINDING_ALWAYS_KEY =
  "settings.keybindings.when.always" as const;

const KEYBINDING_WHEN_LABELS: Record<string, LocaleKey> = {
  Always: KEYBINDING_ALWAYS_KEY,
  "sessionFocus && !overlay": "settings.keybindings.when.session_focus",
  "!overlay && (!textFocus || emptyComposer)":
    "settings.keybindings.when.browsing",
  "!editorFocus": "settings.keybindings.when.outside_editor",
  "Draft session composer": "settings.keybindings.when.composer",
};

export function keybindingWhenLabel(
  when: string,
  locale: Locale = loadLocale(),
): string {
  const key = KEYBINDING_WHEN_LABELS[when];
  return key ? t(locale, key) : when;
}

/**
 * Mirrors the bindings we actually handle: the native menu accelerators in
 * `src-tauri/src/menu.rs`, `tabCommand`, the window key handler in App, and
 * focused surface handlers such as the draft composer workspace toggle.
 */
export const KEYBINDINGS: KeybindingRow[] = [
  {
    command: "settings.keybindings.cmd.app_search",
    keys: `${MOD}K`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_go_to_file",
    keys: `${MOD}P`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_command_palette",
    keys: `${MOD}${SHIFT}P`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_find_in_files",
    keys: `${MOD}${SHIFT}F`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_open_project",
    keys: `${MOD}O`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_new_window",
    keys: `${MOD}${SHIFT}N`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_toggle_sidebar",
    keys: `${MOD}B`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.app_switch_model",
    keys: `${MOD}.`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.composer_toggle_workspace",
    keys: `${MOD}${SHIFT}G`,
    when: "Draft session composer",
  },
  {
    command: "settings.keybindings.cmd.view_reload",
    keys: `${MOD}${SHIFT}R`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.view_zoom_in",
    keys: `${MOD}+`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.view_zoom_out",
    keys: `${MOD}-`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.view_reset_zoom",
    keys: `${MOD}0`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.view_toggle_fullscreen",
    keys: "F11",
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_new",
    keys: `${MOD}T`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_close_others",
    keys: `${MOD}${ALT}T`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_close_all",
    keys: `${MOD}${SHIFT}W`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_next",
    keys: `${MOD}${SHIFT}]`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_previous",
    keys: `${MOD}${SHIFT}[`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_cycle_next",
    keys: `${CTRL}Tab`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_cycle_previous",
    keys: `${CTRL}${SHIFT}Tab`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_back",
    keys: `${MOD}[`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_forward",
    keys: `${MOD}]`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_activate_range",
    keys: `${MOD}1 … ${MOD}8`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.tab_activate_last",
    keys: `${MOD}9`,
    when: "Always",
  },
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
  {
    command: "settings.keybindings.cmd.pane_close",
    keys: `${MOD}W`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.pane_split_right",
    keys: `${MOD}D`,
    when: "!editorFocus",
  },
  {
    command: "settings.keybindings.cmd.pane_split_down",
    keys: `${MOD}${SHIFT}D`,
    when: "!editorFocus",
  },
  {
    command: "settings.keybindings.cmd.pane_focus_left",
    keys: `${MOD}${ALT}←`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.pane_focus_right",
    keys: `${MOD}${ALT}→`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.pane_focus_up",
    keys: `${MOD}${ALT}↑`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.pane_focus_down",
    keys: `${MOD}${ALT}↓`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.terminal_new",
    keys: `${MOD}\``,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.terminal_new_tab",
    keys: `${MOD}${SHIFT}\``,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.terminal_toggle_dock",
    keys: `${MOD}J`,
    when: "Always",
  },
  {
    command: "settings.keybindings.cmd.editor_find",
    keys: `${MOD}F`,
    when: "editorFocus",
  },
  {
    command: "settings.keybindings.cmd.editor_replace",
    keys: `${MOD}${ALT}F`,
    when: "editorFocus",
  },
];

export function filterKeybindings(
  rows: KeybindingRow[],
  query: string,
  locale: Locale = loadLocale(),
): KeybindingRow[] {
  const needle = foldAccents(query.trim().toLowerCase());
  if (!needle) return rows;
  return rows.filter((row) => {
    const command = foldAccents(t(locale, row.command).toLowerCase());
    return (
      command.includes(needle) ||
      row.keys.toLowerCase().includes(needle) ||
      foldAccents(row.when.toLowerCase()).includes(needle) ||
      foldAccents(keybindingWhenLabel(row.when, locale).toLowerCase()).includes(
        needle,
      )
    );
  });
}
