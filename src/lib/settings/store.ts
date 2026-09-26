import { invoke } from "@tauri-apps/api/core";
import { readBootMirror, writeBootMirror } from "./bootMirror";
import {
  DEFAULT_SETTINGS,
  type AppearanceSettings,
  type AppSettings,
  type ColorScheme,
  type Locale,
} from "./schema";

/**
 * One place settings are read from and written to.
 *
 * The shape here is a small store rather than a context: a React context would
 * re-render every subscriber on every slider tick, and the transcript pane
 * subscribes to some of these. `useSyncExternalStore` over a module-level
 * snapshot lets a row subscribe to the one field it draws.
 *
 * ## The snapshot is replaced, never mutated
 *
 * `current` is reassigned on every write and read back by reference. That is
 * the whole contract with `useSyncExternalStore`, which compares snapshots with
 * `Object.is`: returning a fresh object per read -- which an earlier version
 * of this design did twice -- means "changed" forever, and the view renders
 * until React gives up. There is a test pinning the reference.
 */

/** The only broadcast. One event for the whole store, whatever changed. */
export const SETTINGS_CHANGE_EVENT = "monocode:settings-change";

/**
 * Native writes are debounced so a hue drag does not serialise twelve
 * settings.json writes. The mirror is *not* debounced: a relaunch mid-debounce
 * must still boot with the theme the user is looking at.
 */
const NATIVE_WRITE_DEBOUNCE_MS = 120;

/**
 * A fresh copy of the defaults, never `DEFAULT_SETTINGS` itself: handing the
 * shared object out would let one caller mutating it corrupt every later
 * reader, including the reset path.
 */
function freshSettings(): AppSettings {
  return {
    general: { ...DEFAULT_SETTINGS.general },
    appearance: { ...DEFAULT_SETTINGS.appearance },
    performance: { ...DEFAULT_SETTINGS.performance },
    experimental: {
      ...DEFAULT_SETTINGS.experimental,
      nextSteps: {
        ...DEFAULT_SETTINGS.experimental.nextSteps,
        actions: { ...DEFAULT_SETTINGS.experimental.nextSteps.actions },
      },
    },
    debugScopes: [...DEFAULT_SETTINGS.debugScopes],
  };
}

let current: AppSettings = freshSettings();

/**
 * Whether the last write actually reached localStorage.
 *
 * The mirror can fail on its own -- private mode, quota -- and the codebase
 * already has a rule for that: a value that did not persist is not broadcast,
 * because a subscriber must never observe a value the store does not hold.
 * `appearance.ts` reads this to keep that contract while the store owns the
 * write.
 */
let mirrorPersisted = true;

export function lastWritePersisted(): boolean {
  return mirrorPersisted;
}
let nativeTimer: ReturnType<typeof setTimeout> | null = null;
let nativeDirty = false;

export function getSettings(): AppSettings {
  return current;
}

export function subscribeSettings(onStoreChange: () => void): () => void {
  window.addEventListener(SETTINGS_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, onStoreChange);
}

/**
 * Apply a partial update at the top level. Nested groups are replaced whole:
 * `updateSettings({ appearance })` is the caller's job to build, and a deep
 * merge here would hide a caller that forgot a field.
 */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = { ...current, ...patch };
  if (next === current) return current;
  current = next;
  mirrorPersisted = writeBootMirror(next.appearance);
  if (mirrorPersisted) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
    }
    scheduleNativeWrite();
  }
  return current;
}

/** Appearance-only, for the many callers that only ever change the theme. */
export function updateAppearance(
  patch: Partial<AppearanceSettings>,
): AppSettings {
  return updateSettings({ appearance: { ...current.appearance, ...patch } });
}

function scheduleNativeWrite(): void {
  nativeDirty = true;
  if (nativeTimer != null) return;
  nativeTimer = setTimeout(() => {
    nativeTimer = null;
    if (!nativeDirty) return;
    nativeDirty = false;
    void persist();
  }, NATIVE_WRITE_DEBOUNCE_MS);
}

async function persist(): Promise<void> {
  try {
    await invoke("settings_save", { settings: toWire(current) });
  } catch (error) {
    // The mirror and the in-memory value already hold the change, so the
    // session behaves correctly; only the next launch is affected, and
    // writing to localStorage as well would be a second source of truth.
    console.debug("[monocode] settings persist failed", error);
  }
}

/** The wire shape, which is the Rust struct's. */
function toWire(settings: AppSettings): unknown {
  return {
    schema: 1,
    prefs: {
      general: { locale: settings.general.locale },
      appearance: {
        colorScheme: settings.appearance.colorScheme,
        themeHue: settings.appearance.themeHue,
        // The app works in a 0..1 alpha ratio; the file stores a whole
        // percent, because u8 on disk has no float rounding to argue about.
        // Converting here rather than changing either side's own semantics is
        // what keeps appearance.ts, the CSS variable, and the Rust struct
        // each in the units they were written for.
        sidebarOpacity: Math.round(settings.appearance.sidebarOpacity * 100),
      },
      chat: {
        nextSteps: {
          enabled: settings.experimental.nextSteps.enabled,
          suggest: settings.experimental.nextSteps.suggest,
          actions: {
            jumpToBottom: settings.experimental.nextSteps.actions.jumpToBottom,
            searchTranscript:
              settings.experimental.nextSteps.actions.searchTranscript,
            reviewChanges:
              settings.experimental.nextSteps.actions.reviewChanges,
          },
        },
      },
      diagnostics: { debugScopes: settings.debugScopes },
    },
    view: {
      projectRailOpen: settings.appearance.projectRailOpen,
      settingsSection: settings.appearance.settingsSection,
      sidebarTabOrder: [],
    },
    runtime: { lastUpdateCheck: 0 },
  };
}

function str(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

function num(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && value >= min && value <= max
    ? value
    : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return value === true ? true : value === false ? false : fallback;
}

/**
 * Read the native file. Every value is checked rather than cast: the wire is
 * `unknown`, and a hand-edited or half-written file should cost the field it
 * got wrong, not the whole load.
 */
function fromWire(raw: unknown): Partial<AppSettings> {
  if (!raw || typeof raw !== "object") return {};
  const prefs = (raw as { prefs?: unknown }).prefs;
  if (!prefs || typeof prefs !== "object") return {};
  const p = prefs as Record<string, unknown>;

  const locale = str(
    (p.general as Record<string, unknown> | undefined)?.locale,
    ["en", "pt-BR"],
  );
  const wireAppearance =
    (p.appearance as Record<string, unknown> | undefined) ?? {};
  const colorScheme = str(wireAppearance.colorScheme, ["dark", "light"]);
  const themeHue = num(wireAppearance.themeHue, 0, 360);
  const sidebarOpacityPercent = num(wireAppearance.sidebarOpacity, 0, 100);

  const appearance: AppearanceSettings = {
    ...DEFAULT_SETTINGS.appearance,
    ...(colorScheme ? { colorScheme: colorScheme as ColorScheme } : {}),
    ...(themeHue != null ? { themeHue } : {}),
    ...(sidebarOpacityPercent != null
      ? { sidebarOpacity: sidebarOpacityPercent / 100 }
      : {}),
  };

  const nextSteps = (p.chat as Record<string, unknown> | undefined)
    ?.nextSteps as Record<string, unknown> | undefined;
  const actions =
    (nextSteps?.actions as Record<string, unknown> | undefined) ?? {};

  const scopes = (p.diagnostics as Record<string, unknown> | undefined)
    ?.debugScopes;

  const view = (raw as { view?: unknown }).view as
    Record<string, unknown> | undefined;

  return {
    ...(locale ? { general: { locale: locale as Locale } } : {}),
    appearance: {
      ...appearance,
      ...(view && typeof view.settingsSection === "string"
        ? { settingsSection: view.settingsSection }
        : {}),
      ...(view ? { projectRailOpen: bool(view.projectRailOpen, true) } : {}),
    },
    ...(nextSteps
      ? {
          experimental: {
            ...DEFAULT_SETTINGS.experimental,
            nextSteps: {
              enabled: bool(nextSteps.enabled, false),
              suggest: flag(nextSteps.suggest, true),
              actions: {
                jumpToBottom: flag(actions.jumpToBottom, true),
                searchTranscript: flag(actions.searchTranscript, true),
                reviewChanges: flag(actions.reviewChanges, false),
              },
            },
          },
        }
      : {}),
    ...(Array.isArray(scopes)
      ? {
          debugScopes: scopes.filter((s): s is string => typeof s === "string"),
        }
      : {}),
  };
}

/**
 * Load before the first render.
 *
 * Two sources, and the order matters. `settings.json` is the destination, but
 * on a fresh install it does not exist yet, so it would answer with defaults
 * and wipe every preference the user has today. The mirror still holds those,
 * so it is read afterwards and wins for the fields that have not been migrated
 * across yet. As each field moves in a later step this overlay shrinks, and
 * eventually it is gone.
 */
export async function hydrateSettings(): Promise<AppSettings> {
  let fromNative: Partial<AppSettings> = {};
  try {
    fromNative = fromWire(await invoke("settings_load"));
  } catch (error) {
    // No command yet, or the file is unreadable. The mirror covers it.
    console.debug("[monocode] settings hydrate skipped", error);
  }

  const migrated: Partial<AppSettings> = {
    ...fromNative,
    appearance: { ...DEFAULT_SETTINGS.appearance, ...fromNative.appearance },
    experimental: {
      ...DEFAULT_SETTINGS.experimental,
      ...fromNative.experimental,
    },
  };
  // Still owned by localStorage: the mirror is the truth for these until the
  // migration reaches them. `appearance` is always set two lines above, so the
  // fallback is unreachable rather than a guess.
  const appearance: AppearanceSettings = {
    ...DEFAULT_SETTINGS.appearance,
    ...migrated.appearance,
    ...readBootMirror(),
  };
  current = { ...DEFAULT_SETTINGS, ...migrated, appearance };
  writeBootMirror(appearance);
  return current;
}

/** Test seam: the store is module state, and its debounce holds a timer. */
export function __resetSettingsStore(): void {
  current = freshSettings();
  nativeDirty = false;
  if (nativeTimer != null) {
    clearTimeout(nativeTimer);
    nativeTimer = null;
  }
}
