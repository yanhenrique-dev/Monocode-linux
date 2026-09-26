import { convertFileSrc } from "@tauri-apps/api/core";
import { isHexColor } from "./colorUtils";
import { applyUiScale, loadUiScale } from "./uiScale";
import {
  applyPreparedNewThreadBackground,
  clearPreparedNewThreadBackground,
} from "./newThreadBackgroundEffects";

const ACCENT_COLOR_KEY = "monocode.accentColor";
const THEME_HUE_KEY = "monocode.themeHue";
const THEME_SATURATION_KEY = "monocode.themeSaturation";
const THEME_DARK_LIGHTNESS_KEY = "monocode.themeDarkLightness";
const OPACITY_KEY = "monocode.sidebarOpacity";
const BLUR_KEY = "monocode.sidebarBlur";
const PROJECT_RAIL_OPEN_KEY = "monocode.projectRailOpen";
const BODY_KEY = "monocode.bodyGlass";
const UI_BLUR_KEY = "monocode.uiBlur";
const SCHEME_KEY = "monocode.colorScheme";
const SIDEBAR_TAB_ORDER_KEY = "monocode.sidebarTabOrder";
const PROJECT_RAIL_WIDTH_KEY = "monocode.projectRailWidth";
const TRANSCRIPT_LAYOUT_KEY = "monocode.transcriptLayout";
const TRANSCRIPT_ANCHOR_KEY = "monocode.transcriptAnchor";
const TASKS_PILL_KEY = "monocode.tasksPill";
const TASKS_LOADING_STYLE_KEY = "monocode.tasksLoadingStyle";
const EXPERIMENTAL_ANIMATIONS_KEY = "monocode.experimentalAnimations";
const CHAT_BACKGROUND_PATH_KEY = "monocode.chatBackgroundPath";
const CHAT_BACKGROUND_OPACITY_KEY = "monocode.chatBackgroundOpacity";
const CHAT_BACKGROUND_EMPTY_OPACITY_KEY = "monocode.chatBackgroundEmptyOpacity";
const CHAT_BACKGROUND_SESSION_OPACITY_KEY =
  "monocode.chatBackgroundSessionOpacity";
const CHAT_BACKGROUND_SCOPE_KEY = "monocode.chatBackgroundScope";
const CHAT_BACKGROUND_BLUR_KEY = "monocode.chatBackgroundBlur";
const NEW_THREAD_BACKGROUND_EFFECT_KEY = "monocode.newThreadBackgroundEffect";
const CHANGES_VIEW_KEY = "monocode.changesView";
let chatBackgroundRevision = Date.now();

export const CHAT_BACKGROUND_PATH_CHANGE_EVENT =
  "monocode:chat-background-path-change";
export const CHAT_BACKGROUND_BLUR_CHANGE_EVENT =
  "monocode:chat-background-blur-change";

export type ColorScheme = "dark" | "light";
export type ThemePreference = ColorScheme | "system";
export type TranscriptLayout = "full" | "chat";
export type TasksLoadingStyle = "classic" | "square";
export type ChatBackgroundScope = "empty" | "all";
export type NewThreadBackgroundEffect =
  | "none"
  | "dither"
  | "ascii"
  | "halftone"
  | "scanlines";
export type ChangesView = "list" | "tree";

export const NEW_THREAD_BACKGROUND_EFFECTS: readonly NewThreadBackgroundEffect[] =
  ["none", "dither", "ascii", "halftone", "scanlines"];

export const NEW_THREAD_BACKGROUND_EFFECT_DEFAULT: NewThreadBackgroundEffect =
  "none";

export const THEME_PREFERENCE_DEFAULT: ThemePreference = "dark";

export const ACCENT_COLOR_DEFAULT = null;

/** Fired on `window` whenever the color scheme flips (detail: ColorScheme). */
export const SCHEME_CHANGE_EVENT = "monocode:schemechange";

/**
 * Fired on `window` whenever any persisted appearance value changes.
 * Same-window only: Tauri webviews do not share DOM events, so a second
 * window still needs its own reload or a Tauri event to stay in sync.
 */
export const APPEARANCE_CHANGE_EVENT = "monocode:appearance-change";

export function notifyAppearanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT));
}

export function subscribeAppearance(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(APPEARANCE_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(APPEARANCE_CHANGE_EVENT, onStoreChange);
}

export const TRANSCRIPT_LAYOUT_DEFAULT: TranscriptLayout = "full";

export const CHANGES_VIEW_DEFAULT: ChangesView = "list";

export const TRANSCRIPT_ANCHOR_DEFAULT = true;

export const TASKS_PILL_DEFAULT = true;

/** Fired on `window` whenever the tasks pill flips (detail: boolean). */
export const TASKS_PILL_CHANGE_EVENT = "monocode:taskspillchange";

export const TASKS_LOADING_STYLE_DEFAULT: TasksLoadingStyle = "square";

/** Fired on `window` whenever the tasks loading style flips (detail: TasksLoadingStyle). */
export const TASKS_LOADING_STYLE_CHANGE_EVENT =
  "monocode:tasksloadingstylechange";

/**
 * Fired on `window` when a fullscreen overlay (settings/search/inbox/notes)
 * opens or closes (detail: boolean). Chrome portaled to the body — like the
 * composer runner pet — hides while one is open.
 */
export const OVERLAY_OPEN_CHANGE_EVENT = "monocode:overlay-open-change";

let overlayOpen = false;

export function notifyOverlayOpenChanged(open: boolean) {
  overlayOpen = open;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(OVERLAY_OPEN_CHANGE_EVENT, { detail: open }));
}

export function subscribeOverlayOpenChanged(
  onChange: (open: boolean) => void,
) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) =>
    onChange((event as CustomEvent<boolean>).detail ?? false);
  window.addEventListener(OVERLAY_OPEN_CHANGE_EVENT, listener);
  onChange(overlayOpen);
  return () => window.removeEventListener(OVERLAY_OPEN_CHANGE_EVENT, listener);
}

export const EXPERIMENTAL_ANIMATIONS_DEFAULT = false;

/** Fired on `window` whenever experimental animations flip (detail: boolean). */
export const EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT =
  "monocode:experimentalanimationschange";

/** Fired on `window` whenever prompt-to-top anchoring flips (detail: boolean). */
export const TRANSCRIPT_ANCHOR_CHANGE_EVENT = "monocode:transcriptanchorchange";

/** Fired on `window` whenever the transcript layout flips (detail: TranscriptLayout). */
export const TRANSCRIPT_LAYOUT_CHANGE_EVENT = "monocode:transcriptlayoutchange";

export type SidebarTabId = "files" | "sessions" | "changes" | "inbox";

const DEFAULT_SIDEBAR_TAB_ORDER: SidebarTabId[] = [
  "sessions",
  "inbox",
  "files",
  "changes",
];

export const THEME_HUE_MIN = 0;
export const THEME_HUE_MAX = 360;
export const THEME_HUE_DEFAULT = 240;

export const THEME_SATURATION_MIN = 0;
export const THEME_SATURATION_MAX = 100;
export const THEME_SATURATION_DEFAULT = 0;

export const THEME_DARK_LIGHTNESS_MIN = 0;
export const THEME_DARK_LIGHTNESS_MAX = 30;
export const THEME_DARK_LIGHTNESS_DEFAULT = 9;

export const SIDEBAR_OPACITY_MIN = 0.15;
export const SIDEBAR_OPACITY_MAX = 1;
export const SIDEBAR_OPACITY_DEFAULT = 0.85;

export const SIDEBAR_BLUR_MIN = 1;
export const SIDEBAR_BLUR_MAX = 64;
export const SIDEBAR_BLUR_DEFAULT = 24;

export const PROJECT_RAIL_WIDTH_MIN = 180;
export const PROJECT_RAIL_WIDTH_MAX = 360;
export const PROJECT_RAIL_WIDTH_DEFAULT = 200;

export const BODY_GLASS_DEFAULT = true;

/** In-app CSS blur (popovers, toasts, pickers). Default on, see UI_BLUR_CLASS. */
export const UI_BLUR_DEFAULT = true;

/** Class applied to <html> while in-app blur is off. */
export const UI_BLUR_OFF_CLASS = "no-ui-blur";

export const CHAT_BACKGROUND_OPACITY_MIN = 0.05;
export const CHAT_BACKGROUND_OPACITY_MAX = 0.65;
export const CHAT_BACKGROUND_OPACITY_DEFAULT = 0.24;
export const CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT =
  CHAT_BACKGROUND_OPACITY_DEFAULT;
export const CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT =
  CHAT_BACKGROUND_OPACITY_DEFAULT;
export const CHAT_BACKGROUND_SCOPE_DEFAULT: ChatBackgroundScope = "all";
export const CHAT_BACKGROUND_BLUR_MIN = 0;
export const CHAT_BACKGROUND_BLUR_MAX = 24;
export const CHAT_BACKGROUND_BLUR_DEFAULT = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** True when the value landed in storage. Broadcasts must wait for this. */
function writeNumber(key: string, value: number): boolean {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return false;
  }
}

function readFlag(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: boolean): boolean {
  try {
    localStorage.setItem(key, value ? "1" : "0");
    return true;
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return false;
  }
}

function normalizeAccentColor(value: unknown): string | null {
  return typeof value === "string" && isHexColor(value)
    ? value.toLowerCase()
    : ACCENT_COLOR_DEFAULT;
}

function accentForeground(color: string): "#000000" | "#ffffff" {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function loadAccentColor(): string | null {
  try {
    return normalizeAccentColor(localStorage.getItem(ACCENT_COLOR_KEY));
  } catch {
    return ACCENT_COLOR_DEFAULT;
  }
}

export function saveAccentColor(value: string | null) {
  try {
    const next = normalizeAccentColor(value);
    if (next == null) localStorage.removeItem(ACCENT_COLOR_KEY);
    else localStorage.setItem(ACCENT_COLOR_KEY, next);
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return;
  }
  notifyAppearanceChanged();
}

export function applyAccentColor(value: string | null) {
  const next = normalizeAccentColor(value);
  document.documentElement.classList.toggle("has-user-accent", next != null);
  if (next == null) {
    document.documentElement.style.removeProperty("--user-accent-color");
    document.documentElement.style.removeProperty("--user-accent-foreground");
    return next;
  }
  document.documentElement.style.setProperty("--user-accent-color", next);
  document.documentElement.style.setProperty(
    "--user-accent-foreground",
    accentForeground(next),
  );
  return next;
}

export function loadThemeHue(): number {
  return Math.round(
    clamp(
      readNumber(THEME_HUE_KEY) ?? THEME_HUE_DEFAULT,
      THEME_HUE_MIN,
      THEME_HUE_MAX,
    ),
  );
}

export function saveThemeHue(value: number) {
  if (
    writeNumber(
      THEME_HUE_KEY,
      Math.round(clamp(value, THEME_HUE_MIN, THEME_HUE_MAX)),
    )
  ) {
    notifyAppearanceChanged();
  }
}

export function loadThemeSaturation(): number {
  return Math.round(
    clamp(
      readNumber(THEME_SATURATION_KEY) ?? THEME_SATURATION_DEFAULT,
      THEME_SATURATION_MIN,
      THEME_SATURATION_MAX,
    ),
  );
}

export function saveThemeSaturation(value: number) {
  if (
    writeNumber(
      THEME_SATURATION_KEY,
      Math.round(clamp(value, THEME_SATURATION_MIN, THEME_SATURATION_MAX)),
    )
  ) {
    notifyAppearanceChanged();
  }
}

export function loadThemeDarkLightness(): number {
  return Math.round(
    clamp(
      readNumber(THEME_DARK_LIGHTNESS_KEY) ?? THEME_DARK_LIGHTNESS_DEFAULT,
      THEME_DARK_LIGHTNESS_MIN,
      THEME_DARK_LIGHTNESS_MAX,
    ),
  );
}

export function saveThemeDarkLightness(value: number) {
  if (
    writeNumber(
      THEME_DARK_LIGHTNESS_KEY,
      Math.round(
        clamp(value, THEME_DARK_LIGHTNESS_MIN, THEME_DARK_LIGHTNESS_MAX),
      ),
    )
  ) {
    notifyAppearanceChanged();
  }
}

export function applyThemeDarkLightness(value: number) {
  const next = Math.round(
    clamp(value, THEME_DARK_LIGHTNESS_MIN, THEME_DARK_LIGHTNESS_MAX),
  );
  document.documentElement.style.setProperty(
    "--theme-dark-lightness",
    `${next}%`,
  );
  return next;
}

export function applyThemeTint(hue: number, saturation: number) {
  const nextHue = Math.round(clamp(hue, THEME_HUE_MIN, THEME_HUE_MAX));
  const nextSaturation = Math.round(
    clamp(saturation, THEME_SATURATION_MIN, THEME_SATURATION_MAX),
  );
  document.documentElement.style.setProperty("--theme-hue", String(nextHue));
  document.documentElement.style.setProperty(
    "--theme-saturation",
    `${nextSaturation}%`,
  );
  return { hue: nextHue, saturation: nextSaturation };
}

export function initAppearance() {
  applyAccentColor(loadAccentColor());
  applyThemeTint(loadThemeHue(), loadThemeSaturation());
  applyThemeDarkLightness(loadThemeDarkLightness());
  applyThemePreference(loadThemePreference());
  watchSystemColorScheme();
  applySidebarOpacity(loadSidebarOpacity());
  applySidebarBlur(loadSidebarBlur());
  applyBodyGlass(loadBodyGlass());
  applyUiBlur(loadUiBlur());
  applyChatBackground(loadChatBackgroundPath());
  applyChatBackgroundEmptyOpacity(loadChatBackgroundEmptyOpacity());
  applyChatBackgroundSessionOpacity(loadChatBackgroundSessionOpacity());
  applyChatBackgroundBlur(loadChatBackgroundBlur());
  applyChatBackgroundScope(loadChatBackgroundScope());
  void applyUiScale(loadUiScale());
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(SCHEME_KEY);
    return isThemePreference(raw) ? raw : THEME_PREFERENCE_DEFAULT;
  } catch {
    return THEME_PREFERENCE_DEFAULT;
  }
}

export function saveThemePreference(value: ThemePreference) {
  try {
    localStorage.setItem(SCHEME_KEY, value);
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return;
  }
  notifyAppearanceChanged();
}

function systemQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  return window.matchMedia("(prefers-color-scheme: light)");
}

function systemColorScheme(): ColorScheme {
  return systemQuery()?.matches ? "light" : "dark";
}

export function resolveColorScheme(value: ThemePreference): ColorScheme {
  return value === "system" ? systemColorScheme() : value;
}

export function isLightScheme(): boolean {
  return document.documentElement.classList.contains("theme-light");
}

export function applyThemePreference(value: ThemePreference): ColorScheme {
  const next = resolveColorScheme(value);
  document.documentElement.classList.toggle("theme-light", next === "light");
  window.dispatchEvent(
    new CustomEvent<ColorScheme>(SCHEME_CHANGE_EVENT, { detail: next }),
  );
  const backgroundPath = loadChatBackgroundPath();
  if (
    backgroundPath &&
    document.documentElement.classList.contains("has-chat-background")
  ) {
    renderChatBackground(backgroundPath);
  }
  return next;
}

/** Kept for the launch sequence: no native glass exists on Linux. */
export function activateWindowAppearance() {}

/** Keeps the "system" preference in sync when the OS flips appearance. */
export function watchSystemColorScheme() {
  const query = systemQuery();
  if (!query) return;
  query.addEventListener("change", () => {
    const preference = loadThemePreference();
    if (preference === "system") applyThemePreference(preference);
  });
}

export function loadSidebarOpacity(): number {
  return clamp(
    readNumber(OPACITY_KEY) ?? SIDEBAR_OPACITY_DEFAULT,
    SIDEBAR_OPACITY_MIN,
    SIDEBAR_OPACITY_MAX,
  );
}

export function saveSidebarOpacity(value: number) {
  if (
    writeNumber(
      OPACITY_KEY,
      clamp(value, SIDEBAR_OPACITY_MIN, SIDEBAR_OPACITY_MAX),
    )
  ) {
    notifyAppearanceChanged();
  }
}

export function applySidebarOpacity(value: number) {
  const next = clamp(value, SIDEBAR_OPACITY_MIN, SIDEBAR_OPACITY_MAX);
  document.documentElement.style.setProperty("--sidebar-opacity", String(next));
  return next;
}

export function loadSidebarBlur(): number {
  return Math.round(
    clamp(
      readNumber(BLUR_KEY) ?? SIDEBAR_BLUR_DEFAULT,
      SIDEBAR_BLUR_MIN,
      SIDEBAR_BLUR_MAX,
    ),
  );
}

export function saveSidebarBlur(value: number) {
  if (
    writeNumber(
      BLUR_KEY,
      Math.round(clamp(value, SIDEBAR_BLUR_MIN, SIDEBAR_BLUR_MAX)),
    )
  ) {
    notifyAppearanceChanged();
  }
}

export function applySidebarBlur(value: number) {
  const next = Math.round(clamp(value, SIDEBAR_BLUR_MIN, SIDEBAR_BLUR_MAX));
  document.documentElement.style.setProperty("--sidebar-blur", `${next}px`);
  return next;
}

export function previewSidebarBlur(value: number): number {
  return applySidebarBlur(value);
}

/** No native blur preview is in flight on Linux; kept for the slider API. */
export function cancelSidebarBlurPreview() {}

export function loadBodyGlass(): boolean {
  return readFlag(BODY_KEY) ?? BODY_GLASS_DEFAULT;
}

export function saveBodyGlass(value: boolean) {
  if (writeFlag(BODY_KEY, value)) {
    notifyAppearanceChanged();
  }
}

export function applyBodyGlass(value: boolean) {
  document.documentElement.classList.toggle("glass-body", value);
  return value;
}

/**
 * In-app CSS blur (backdrop-filter on popovers, toasts, pickers, dialogs).
 * Independent from the native window blur (Blur radius) and from the master
 * hardware switch: turning it off swaps every .glass-blur node to an opaque
 * fill, which is the fastest path on software compositing (WebKitGTK).
 */
export function loadUiBlur(): boolean {
  return readFlag(UI_BLUR_KEY) ?? UI_BLUR_DEFAULT;
}

export function saveUiBlur(value: boolean) {
  if (writeFlag(UI_BLUR_KEY, value)) {
    notifyAppearanceChanged();
  }
}

export function applyUiBlur(value: boolean) {
  document.documentElement.classList.toggle(UI_BLUR_OFF_CLASS, !value);
  return value;
}

export function loadChatBackgroundPath(): string | null {
  try {
    return localStorage.getItem(CHAT_BACKGROUND_PATH_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function saveChatBackgroundPath(value: string | null) {
  try {
    if (value) localStorage.setItem(CHAT_BACKGROUND_PATH_KEY, value);
    else localStorage.removeItem(CHAT_BACKGROUND_PATH_KEY);
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return;
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_BACKGROUND_PATH_CHANGE_EVENT));
  notifyAppearanceChanged();
}

export function subscribeChatBackgroundPath(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHAT_BACKGROUND_PATH_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(
      CHAT_BACKGROUND_PATH_CHANGE_EVENT,
      onStoreChange,
    );
}

export function applyChatBackground(path: string | null) {
  const root = document.documentElement;
  root.classList.toggle("has-chat-background", !!path);
  if (!path) {
    clearPreparedNewThreadBackground();
    return null;
  }
  chatBackgroundRevision += 1;
  renderChatBackground(path);
  return path;
}

export function chatBackgroundSrc(path: string | null): string | null {
  return path ? `${convertFileSrc(path)}?v=${chatBackgroundRevision}` : null;
}

function isNewThreadBackgroundEffect(
  value: unknown,
): value is NewThreadBackgroundEffect {
  return (NEW_THREAD_BACKGROUND_EFFECTS as readonly unknown[]).includes(value);
}

export function loadNewThreadBackgroundEffect(): NewThreadBackgroundEffect {
  try {
    const raw = localStorage.getItem(NEW_THREAD_BACKGROUND_EFFECT_KEY);
    return isNewThreadBackgroundEffect(raw)
      ? raw
      : NEW_THREAD_BACKGROUND_EFFECT_DEFAULT;
  } catch {
    return NEW_THREAD_BACKGROUND_EFFECT_DEFAULT;
  }
}

export function saveNewThreadBackgroundEffect(
  effect: NewThreadBackgroundEffect,
) {
  try {
    localStorage.setItem(NEW_THREAD_BACKGROUND_EFFECT_KEY, effect);
  } catch {
    // private mode / quota
    return;
  }
  notifyAppearanceChanged();
}

function renderChatBackground(
  path: string,
  effect = loadNewThreadBackgroundEffect(),
) {
  const src = chatBackgroundSrc(path);
  if (!src) return;
  void applyPreparedNewThreadBackground(
    `${path}?v=${chatBackgroundRevision}`,
    src,
    effect,
    isLightScheme(),
  );
}

export function applyNewThreadBackgroundEffect(
  effect: NewThreadBackgroundEffect,
) {
  const path = loadChatBackgroundPath();
  if (path) renderChatBackground(path, effect);
  return effect;
}

export function setNewThreadBackgroundEffect(
  effect: NewThreadBackgroundEffect,
) {
  saveNewThreadBackgroundEffect(effect);
  applyNewThreadBackgroundEffect(effect);
  window.dispatchEvent(new Event(CHAT_BACKGROUND_PATH_CHANGE_EVENT));
}

export function loadChatBackgroundOpacity(): number {
  return loadChatBackgroundEmptyOpacity();
}

export function saveChatBackgroundOpacity(value: number) {
  const next = clamp(
    value,
    CHAT_BACKGROUND_OPACITY_MIN,
    CHAT_BACKGROUND_OPACITY_MAX,
  );
  saveChatBackgroundEmptyOpacity(next);
  saveChatBackgroundSessionOpacity(next);
  writeNumber(CHAT_BACKGROUND_OPACITY_KEY, next);
}

export function applyChatBackgroundOpacity(value: number) {
  const next = applyChatBackgroundEmptyOpacity(value);
  applyChatBackgroundSessionOpacity(next);
  return next;
}

function loadChatBackgroundOpacityValue(key: string): number {
  const next = clamp(
    readNumber(key) ??
      readNumber(CHAT_BACKGROUND_OPACITY_KEY) ??
      CHAT_BACKGROUND_OPACITY_DEFAULT,
    CHAT_BACKGROUND_OPACITY_MIN,
    CHAT_BACKGROUND_OPACITY_MAX,
  );
  return next;
}

function saveChatBackgroundOpacityValue(
  key: string,
  value: number,
): boolean {
  return writeNumber(
    key,
    clamp(value, CHAT_BACKGROUND_OPACITY_MIN, CHAT_BACKGROUND_OPACITY_MAX),
  );
}

function applyChatBackgroundOpacityValue(variable: string, value: number) {
  const next = clamp(
    value,
    CHAT_BACKGROUND_OPACITY_MIN,
    CHAT_BACKGROUND_OPACITY_MAX,
  );
  document.documentElement.style.setProperty(variable, String(next));
  return next;
}

export function loadChatBackgroundEmptyOpacity(): number {
  return loadChatBackgroundOpacityValue(CHAT_BACKGROUND_EMPTY_OPACITY_KEY);
}

export function saveChatBackgroundEmptyOpacity(value: number) {
  if (saveChatBackgroundOpacityValue(CHAT_BACKGROUND_EMPTY_OPACITY_KEY, value)) {
    notifyAppearanceChanged();
  }
}

export function applyChatBackgroundEmptyOpacity(value: number) {
  return applyChatBackgroundOpacityValue(
    "--chat-background-empty-opacity",
    value,
  );
}

export function loadChatBackgroundSessionOpacity(): number {
  return loadChatBackgroundOpacityValue(CHAT_BACKGROUND_SESSION_OPACITY_KEY);
}

export function saveChatBackgroundSessionOpacity(value: number) {
  if (
    saveChatBackgroundOpacityValue(CHAT_BACKGROUND_SESSION_OPACITY_KEY, value)
  ) {
    notifyAppearanceChanged();
  }
}

export function applyChatBackgroundSessionOpacity(value: number) {
  return applyChatBackgroundOpacityValue(
    "--chat-background-session-opacity",
    value,
  );
}

function clampChatBackgroundBlur(value: number): number {
  return clamp(
    Number.isFinite(value) ? Math.round(value) : CHAT_BACKGROUND_BLUR_DEFAULT,
    CHAT_BACKGROUND_BLUR_MIN,
    CHAT_BACKGROUND_BLUR_MAX,
  );
}

export function loadChatBackgroundBlur(): number {
  return clampChatBackgroundBlur(
    readNumber(CHAT_BACKGROUND_BLUR_KEY) ?? CHAT_BACKGROUND_BLUR_DEFAULT,
  );
}

export function saveChatBackgroundBlur(value: number) {
  const next = clampChatBackgroundBlur(value);
  if (!writeNumber(CHAT_BACKGROUND_BLUR_KEY, next)) {
    // private mode / quota: keep the persisted state, don't broadcast it
    return next;
  }
  applyChatBackgroundBlur(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHAT_BACKGROUND_BLUR_CHANGE_EVENT));
  }
  notifyAppearanceChanged();
  return next;
}

export function applyChatBackgroundBlur(value: number) {
  const next = clampChatBackgroundBlur(value);
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--chat-background-blur",
      `${next}px`,
    );
  }
  return next;
}

export function subscribeChatBackgroundBlur(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHAT_BACKGROUND_BLUR_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(CHAT_BACKGROUND_BLUR_CHANGE_EVENT, onStoreChange);
}

function isChatBackgroundScope(value: unknown): value is ChatBackgroundScope {
  return value === "empty" || value === "all";
}

export function loadChatBackgroundScope(): ChatBackgroundScope {
  try {
    const raw = localStorage.getItem(CHAT_BACKGROUND_SCOPE_KEY);
    return isChatBackgroundScope(raw) ? raw : CHAT_BACKGROUND_SCOPE_DEFAULT;
  } catch {
    return CHAT_BACKGROUND_SCOPE_DEFAULT;
  }
}

export function saveChatBackgroundScope(value: ChatBackgroundScope) {
  try {
    localStorage.setItem(CHAT_BACKGROUND_SCOPE_KEY, value);
  } catch {
    // private mode / quota: keep the persisted state, don't broadcast it
    return;
  }
  notifyAppearanceChanged();
}

export function applyChatBackgroundScope(value: ChatBackgroundScope) {
  document.documentElement.classList.toggle(
    "chat-background-empty-only",
    value === "empty",
  );
  return value;
}

function isSidebarTabId(value: unknown): value is SidebarTabId {
  return (
    value === "files" ||
    value === "sessions" ||
    value === "changes" ||
    value === "inbox"
  );
}

export function loadProjectRailOpen(): boolean {
  return readFlag(PROJECT_RAIL_OPEN_KEY) ?? true;
}

export function saveProjectRailOpen(value: boolean) {
  writeFlag(PROJECT_RAIL_OPEN_KEY, value);
}

export function loadSidebarTabOrder(): SidebarTabId[] {
  try {
    const raw = localStorage.getItem(SIDEBAR_TAB_ORDER_KEY);
    if (!raw) return [...DEFAULT_SIDEBAR_TAB_ORDER];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SIDEBAR_TAB_ORDER];
    const next = parsed.filter(isSidebarTabId);
    for (const id of DEFAULT_SIDEBAR_TAB_ORDER) {
      if (!next.includes(id)) next.push(id);
    }
    return next.length === DEFAULT_SIDEBAR_TAB_ORDER.length
      ? next
      : [...DEFAULT_SIDEBAR_TAB_ORDER];
  } catch {
    return [...DEFAULT_SIDEBAR_TAB_ORDER];
  }
}

export function saveSidebarTabOrder(order: SidebarTabId[]) {
  try {
    localStorage.setItem(SIDEBAR_TAB_ORDER_KEY, JSON.stringify(order));
  } catch {
    // private mode / quota
  }
}

export function loadProjectRailWidth(): number {
  return Math.round(
    clamp(
      readNumber(PROJECT_RAIL_WIDTH_KEY) ?? PROJECT_RAIL_WIDTH_DEFAULT,
      PROJECT_RAIL_WIDTH_MIN,
      PROJECT_RAIL_WIDTH_MAX,
    ),
  );
}

export function saveProjectRailWidth(value: number) {
  writeNumber(
    PROJECT_RAIL_WIDTH_KEY,
    Math.round(clamp(value, PROJECT_RAIL_WIDTH_MIN, PROJECT_RAIL_WIDTH_MAX)),
  );
}

function isTranscriptLayout(value: unknown): value is TranscriptLayout {
  return value === "full" || value === "chat";
}

export function loadTranscriptLayout(): TranscriptLayout {
  try {
    const raw = localStorage.getItem(TRANSCRIPT_LAYOUT_KEY);
    return isTranscriptLayout(raw) ? raw : TRANSCRIPT_LAYOUT_DEFAULT;
  } catch {
    return TRANSCRIPT_LAYOUT_DEFAULT;
  }
}

export function saveTranscriptLayout(value: TranscriptLayout) {
  const next = isTranscriptLayout(value) ? value : TRANSCRIPT_LAYOUT_DEFAULT;
  try {
    localStorage.setItem(TRANSCRIPT_LAYOUT_KEY, next);
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TranscriptLayout>(TRANSCRIPT_LAYOUT_CHANGE_EVENT, {
      detail: next,
    }),
  );
}

function isChangesView(value: unknown): value is ChangesView {
  return value === "list" || value === "tree";
}

export function loadChangesView(): ChangesView {
  try {
    const raw = localStorage.getItem(CHANGES_VIEW_KEY);
    return isChangesView(raw) ? raw : CHANGES_VIEW_DEFAULT;
  } catch {
    return CHANGES_VIEW_DEFAULT;
  }
}

export function saveChangesView(value: ChangesView) {
  try {
    localStorage.setItem(CHANGES_VIEW_KEY, value);
  } catch {
    // private mode / quota
  }
}

export function loadTranscriptAnchor(): boolean {
  return readFlag(TRANSCRIPT_ANCHOR_KEY) ?? TRANSCRIPT_ANCHOR_DEFAULT;
}

export function saveTranscriptAnchor(value: boolean) {
  writeFlag(TRANSCRIPT_ANCHOR_KEY, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(TRANSCRIPT_ANCHOR_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function loadTasksPill(): boolean {
  return readFlag(TASKS_PILL_KEY) ?? TASKS_PILL_DEFAULT;
}

export function saveTasksPill(value: boolean) {
  writeFlag(TASKS_PILL_KEY, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(TASKS_PILL_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

function isTasksLoadingStyle(value: unknown): value is TasksLoadingStyle {
  return value === "classic" || value === "square";
}

export function loadTasksLoadingStyle(): TasksLoadingStyle {
  try {
    const raw = localStorage.getItem(TASKS_LOADING_STYLE_KEY);
    return isTasksLoadingStyle(raw) ? raw : TASKS_LOADING_STYLE_DEFAULT;
  } catch {
    return TASKS_LOADING_STYLE_DEFAULT;
  }
}

export function saveTasksLoadingStyle(value: TasksLoadingStyle) {
  const next = isTasksLoadingStyle(value) ? value : TASKS_LOADING_STYLE_DEFAULT;
  try {
    localStorage.setItem(TASKS_LOADING_STYLE_KEY, next);
  } catch {
    // private mode / quota
    return;
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TasksLoadingStyle>(TASKS_LOADING_STYLE_CHANGE_EVENT, {
      detail: next,
    }),
  );
}

export function loadExperimentalAnimations(): boolean {
  return readFlag(EXPERIMENTAL_ANIMATIONS_KEY) ?? EXPERIMENTAL_ANIMATIONS_DEFAULT;
}

export function saveExperimentalAnimations(value: boolean) {
  writeFlag(EXPERIMENTAL_ANIMATIONS_KEY, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT, {
      detail: value,
    }),
  );
}
