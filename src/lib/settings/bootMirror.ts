/**
 * The localStorage keys `index.html` reads before React loads.
 *
 * The inline boot script in index.html is synchronous and runs before the
 * bundle, so it cannot go through IPC to read `settings.json`. These keys
 * exist for that one reason: they let the window paint the right theme on the
 * first frame instead of flashing the default.
 *
 * That makes them a *cache of the store*, not a second source of truth, and it
 * only stays a cache if there is exactly one writer. Every write goes through
 * this module -- `writeBootMirror` -- so the store, the pre-React path, and
 * the native file can never disagree about which value is current.
 *
 * The rule this module exists to enforce: nothing outside it may call
 * `localStorage.setItem` for any of these keys. There is a test that reads
 * the source of every module under src/ and fails on a direct write.
 */

import { DEFAULT_SETTINGS, type AppearanceSettings } from "./schema";

/**
 * The keys the boot script reads, in the order it reads them. Kept as data so
 * the test that forbids direct writes has something to check against.
 */
export const BOOT_MIRROR_KEYS = [
  "monocode.themeHue",
  "monocode.themeSaturation",
  "monocode.sidebarOpacity",
  "monocode.colorScheme",
  "monocode.bodyGlass",
  "monocode.accentColor",
  "monocode.uiBlur",
  "monocode.chatBackgroundEmptyOpacity",
  "monocode.chatBackgroundSessionOpacity",
  "monocode.chatBackgroundBlur",
  "monocode.chatBackgroundScope",
  "monocode.uiScale",
  "monocode.experimentalAnimations",
] as const;

export type BootMirrorKey = (typeof BOOT_MIRROR_KEYS)[number];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readNumber(key: string): number | null {
  const raw = read(key);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFlag(key: string, fallback: boolean): boolean {
  const raw = read(key);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

/** The subset of appearance the boot script actually reads. */
export function readBootMirror(): Partial<AppearanceSettings> {
  const themeHue = readNumber("monocode.themeHue");
  const themeSaturation = readNumber("monocode.themeSaturation");
  const sidebarOpacity = readNumber("monocode.sidebarOpacity");
  const chatBackgroundEmptyOpacity = readNumber(
    "monocode.chatBackgroundEmptyOpacity",
  );
  const chatBackgroundSessionOpacity = readNumber(
    "monocode.chatBackgroundSessionOpacity",
  );
  const chatBackgroundBlur = readNumber("monocode.chatBackgroundBlur");
  const uiScale = readNumber("monocode.uiScale");
  const colorScheme = read("monocode.colorScheme");
  const chatBackgroundScope = read("monocode.chatBackgroundScope");
  const accentColor = read("monocode.accentColor");

  return {
    ...(themeHue != null ? { themeHue } : {}),
    ...(themeSaturation != null ? { themeSaturation } : {}),
    ...(sidebarOpacity != null ? { sidebarOpacity } : {}),
    ...(chatBackgroundEmptyOpacity != null
      ? { chatBackgroundEmptyOpacity }
      : {}),
    ...(chatBackgroundSessionOpacity != null
      ? { chatBackgroundSessionOpacity }
      : {}),
    ...(chatBackgroundBlur != null ? { chatBackgroundBlur } : {}),
    ...(uiScale != null ? { uiScale } : {}),
    ...(colorScheme === "dark" || colorScheme === "light"
      ? { colorScheme }
      : {}),
    ...(chatBackgroundScope === "empty" || chatBackgroundScope === "all"
      ? { chatBackgroundScope }
      : {}),
    ...(accentColor != null ? { accentColor } : {}),
    bodyGlass: readFlag("monocode.bodyGlass", true),
    uiBlur: readFlag("monocode.uiBlur", true),
    experimentalAnimations: readFlag("monocode.experimentalAnimations", false),
  };
}

/**
 * Write the mirror. Synchronous on purpose: a deferred write would let a
 * relaunch in between serve a stale theme, which is the exact flash this
 * module exists to remove.
 */
/**
 * Write all 13 keys, and say whether they landed.
 *
 * The boolean is the caller's only way to honour the codebase rule that a
 * value which failed to persist is not broadcast, so it must be the real
 * result and not optimistically true.
 */
export function writeBootMirror(appearance: AppearanceSettings): boolean {
  try {
    localStorage.setItem("monocode.themeHue", String(appearance.themeHue));
    localStorage.setItem(
      "monocode.themeSaturation",
      String(appearance.themeSaturation),
    );
    localStorage.setItem(
      "monocode.sidebarOpacity",
      String(appearance.sidebarOpacity),
    );
    localStorage.setItem("monocode.colorScheme", appearance.colorScheme);
    localStorage.setItem("monocode.bodyGlass", bool(appearance.bodyGlass));
    localStorage.setItem("monocode.uiBlur", bool(appearance.uiBlur));
    if (appearance.accentColor == null) {
      localStorage.removeItem("monocode.accentColor");
    } else {
      localStorage.setItem("monocode.accentColor", appearance.accentColor);
    }
    localStorage.setItem(
      "monocode.chatBackgroundEmptyOpacity",
      String(appearance.chatBackgroundEmptyOpacity),
    );
    localStorage.setItem(
      "monocode.chatBackgroundSessionOpacity",
      String(appearance.chatBackgroundSessionOpacity),
    );
    localStorage.setItem(
      "monocode.chatBackgroundBlur",
      String(appearance.chatBackgroundBlur),
    );
    localStorage.setItem(
      "monocode.chatBackgroundScope",
      appearance.chatBackgroundScope,
    );
    localStorage.setItem("monocode.uiScale", String(appearance.uiScale));
    localStorage.setItem(
      "monocode.experimentalAnimations",
      bool(appearance.experimentalAnimations),
    );
    return true;
  } catch {
    // Private mode / quota. The store still holds the value, and skipping the
    // native write is deliberate: a native write is a promise that the next
    // launch keeps it, and a caller that was told the mirror failed should not
    // be handed a value that only lives in this process.
    return false;
  }
}

function bool(value: boolean): string {
  return value ? "1" : "0";
}

/**
 * Map a mirrored key to the appearance field it holds, so a writer can hand
 * the value to the store instead of touching localStorage.
 *
 * Returns null for a key the mirror does not own, which is the caller's signal
 * to write localStorage itself -- that is how the fields still pending
 * migration keep working.
 */
export function bootMirrorPatch(
  key: string,
  value: boolean | number | string | null,
): Partial<AppearanceSettings> | null {
  const appearance = DEFAULT_SETTINGS.appearance;
  switch (key) {
    case "monocode.themeHue":
      return typeof value === "number" ? { themeHue: value } : null;
    case "monocode.themeSaturation":
      return typeof value === "number" ? { themeSaturation: value } : null;
    case "monocode.sidebarOpacity":
      return typeof value === "number" ? { sidebarOpacity: value } : null;
    case "monocode.colorScheme":
      return value === "dark" || value === "light"
        ? { colorScheme: value }
        : null;
    case "monocode.bodyGlass":
      return typeof value === "boolean" ? { bodyGlass: value } : null;
    case "monocode.uiBlur":
      return typeof value === "boolean" ? { uiBlur: value } : null;
    case "monocode.accentColor":
      return typeof value === "string" || value === null
        ? { accentColor: value }
        : null;
    case "monocode.chatBackgroundEmptyOpacity":
      return typeof value === "number"
        ? { chatBackgroundEmptyOpacity: value }
        : null;
    case "monocode.chatBackgroundSessionOpacity":
      return typeof value === "number"
        ? { chatBackgroundSessionOpacity: value }
        : null;
    case "monocode.chatBackgroundBlur":
      return typeof value === "number" ? { chatBackgroundBlur: value } : null;
    case "monocode.chatBackgroundScope":
      return value === "empty" || value === "all"
        ? { chatBackgroundScope: value }
        : null;
    case "monocode.uiScale":
      return typeof value === "number" ? { uiScale: value } : null;
    case "monocode.experimentalAnimations":
      return typeof value === "boolean"
        ? { experimentalAnimations: value }
        : null;
    default:
      void appearance;
      return null;
  }
}
