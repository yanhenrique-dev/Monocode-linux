/**
 * The settings shape, mirroring `src-tauri/src/settings.rs`.
 *
 * Both sides carry the field names and the defaults, and the Rust side is the
 * one that validates. This file is the TypeScript half of one contract, not a
 * second source of truth: when a field moves here it moves there too, and
 * `settings.rs` is what rejects a value that would break the UI.
 *
 * Migration is field by field, not all at once. Until a key moves across, its
 * value still lives in the boot mirror, and `hydrateSettings` reads it from
 * there rather than letting the default win. That is what lets the store exist
 * without a single launch resetting a preference.
 */

export type ColorScheme = "dark" | "light";
export type ThemePreference = ColorScheme | "system";
export type TranscriptLayout = "full" | "chat";
export type ChangesView = "list" | "tree";
export type ChatBackgroundScope = "empty" | "all";
export type Locale = "en" | "pt-BR";
/** Declared here, not in appearance.ts, so the store can name it without a cycle. */
export type SidebarTabId = "files" | "sessions" | "changes" | "inbox";
export const DEFAULT_SIDEBAR_TAB_ORDER: readonly SidebarTabId[] = [
  "sessions",
  "inbox",
  "files",
  "changes",
];

/** One flag per action. See `NextStepActions` in settings.rs for why. */
export type NextStepSelection = {
  jumpToBottom: boolean;
  searchTranscript: boolean;
  reviewChanges: boolean;
};

export type AppearanceSettings = {
  themePreference: ThemePreference;
  /** The resolved scheme, derived from themePreference; what the UI reads. */
  colorScheme: ColorScheme;
  themeHue: number;
  themeSaturation: number;
  themeDarkLightness: number;
  /** 0-100, so the wire format carries no float rounding. */
  sidebarOpacity: number;
  sidebarBlur: number;
  bodyGlass: boolean;
  uiBlur: boolean;
  /** #rrggbb, or null to follow the default accent. */
  accentColor: string | null;
  chatBackgroundPath: string | null;
  chatBackgroundEmptyOpacity: number;
  chatBackgroundSessionOpacity: number;
  chatBackgroundBlur: number;
  chatBackgroundScope: ChatBackgroundScope;
  transcriptLayout: TranscriptLayout;
  transcriptAnchor: boolean;
  tasksPill: boolean;
  experimentalAnimations: boolean;
  /** 0.5-2, matching the UI scale control. */
  uiScale: number;
  projectRailOpen: boolean;
  projectRailWidth: number;
  changesView: ChangesView;
  /** Which rail section Settings opens on. Not a preference; remembered view. */
  settingsSection: string;
  sidebarTabOrder: SidebarTabId[];
};

export type PerformanceSettings = {
  hardwareAcceleration: boolean;
  terminalGpu: boolean;
};

export type ExperimentalSettings = {
  composerMascot: boolean;
  emptySessionGames: boolean;
  nextSteps: {
    enabled: boolean;
    /** The model call, separable from the free local shortcuts. */
    suggest: boolean;
    actions: NextStepSelection;
  };
};

export type GeneralSettings = {
  locale: Locale;
};

export type AppSettings = {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  performance: PerformanceSettings;
  experimental: ExperimentalSettings;
  /** Comma-separated, or "*". Empty means debug output is off. */
  debugScopes: string[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  general: { locale: "en" },
  appearance: {
    themePreference: "dark",
    colorScheme: "dark",
    themeHue: 240,
    themeSaturation: 0,
    themeDarkLightness: 9,
    // A CSS alpha ratio, 0..1, matching appearance.ts and --sidebar-opacity.
    // The wire format is a whole percent; see toWire in store.ts.
    sidebarOpacity: 0.85,
    sidebarBlur: 24,
    bodyGlass: true,
    uiBlur: true,
    accentColor: null,
    chatBackgroundPath: null,
    chatBackgroundEmptyOpacity: 24,
    chatBackgroundSessionOpacity: 24,
    chatBackgroundBlur: 0,
    chatBackgroundScope: "empty",
    transcriptLayout: "full",
    transcriptAnchor: true,
    tasksPill: true,
    experimentalAnimations: false,
    uiScale: 1,
    projectRailOpen: true,
    projectRailWidth: 200,
    changesView: "list",
    settingsSection: "general",
    sidebarTabOrder: [...DEFAULT_SIDEBAR_TAB_ORDER],
  },
  performance: { hardwareAcceleration: true, terminalGpu: true },
  experimental: {
    composerMascot: false,
    emptySessionGames: false,
    nextSteps: {
      enabled: false,
      suggest: true,
      actions: {
        jumpToBottom: true,
        searchTranscript: true,
        reviewChanges: false,
      },
    },
  },
  debugScopes: [],
};
