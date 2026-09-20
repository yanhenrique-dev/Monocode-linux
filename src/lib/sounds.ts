import { play, setEnabled, setVolume, type SoundName } from "cuelume";
import type { LinkedWorkItemUpdateCard } from "./linkedWorkItemActivity";
import type { LocaleKey } from "./locale";
import {
  allowsProjectNotification,
  type NotificationSubject,
} from "./notificationPreferences";
import { inboxNotificationProject } from "./notificationProjects";
import { playSoundFile, setSoundFileVolume } from "./soundFiles";

const KEY = "monocode.sounds";
const ENABLED_AT_KEY = "monocode.soundsEnabledAt";

export const SOUNDS_DEFAULT = true;

/** Soft enough to sit in the background while a turn runs in another app. */
export const SOUNDS_VOLUME = 0.55;

const PREFS_KEY = "monocode.soundPrefs";

export const SOUNDS_CHANGE_EVENT = "monocode:sounds-change";

/** Per-cue override: "preset" keeps the built-in cuelume recipe, a path plays that file. */
export type SoundPref = "preset" | (string & {});

export type SoundCue =
  | "turnFinished"
  | "inboxUnseen"
  | "linkedActivity"
  | "updateAvailable"
  | "switch"
  | "copy";

/** Cues Settings offers custom sounds for; the rest stay on their presets. */
export const CUSTOMIZABLE_CUES = [
  "turnFinished",
  "inboxUnseen",
  "linkedActivity",
  "updateAvailable",
] as const;

export type CustomizableCue = (typeof CUSTOMIZABLE_CUES)[number];

const CUES: Record<SoundCue, SoundName> = {
  turnFinished: "success",
  inboxUnseen: "bloom",
  linkedActivity: "chime",
  updateAvailable: "arrival",
  switch: "toggle",
  copy: "scan",
};

const CUE_LABEL_KEYS: Record<CustomizableCue, string> = {
  turnFinished: "settings.general.sounds.cue.turnFinished",
  inboxUnseen: "settings.general.sounds.cue.inboxUnseen",
  linkedActivity: "settings.general.sounds.cue.linkedActivity",
  updateAvailable: "settings.general.sounds.cue.updateAvailable",
};

/** i18n key for a customizable cue's display name. */
export function cueLabelKey(cue: CustomizableCue): LocaleKey {
  return CUE_LABEL_KEYS[cue] as LocaleKey;
}

export function loadSoundPrefs(): Partial<Record<CustomizableCue, SoundPref>> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed == null) return {};
    const prefs: Partial<Record<CustomizableCue, SoundPref>> = {};
    for (const cue of CUSTOMIZABLE_CUES) {
      const value = (parsed as Record<string, unknown>)[cue];
      if (typeof value === "string" && value) prefs[cue] = value as SoundPref;
    }
    return prefs;
  } catch {
    return {};
  }
}

export function saveSoundPrefs(
  prefs: Partial<Record<CustomizableCue, SoundPref>>,
) {
  const current = loadSoundPrefs();
  const merged = { ...current, ...prefs };
  // "preset" means fall back to the built-in sound: store absence instead.
  for (const cue of CUSTOMIZABLE_CUES) {
    if (merged[cue] === "preset" || merged[cue] == null) delete merged[cue];
  }
  try {
    if (Object.keys(merged).length === 0) {
      localStorage.removeItem(PREFS_KEY);
    } else {
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
    }
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SOUNDS_PREFS_EVENT));
}

export function resetSoundPref(cue: CustomizableCue) {
  saveSoundPrefs({ [cue]: "preset" } as Record<CustomizableCue, SoundPref>);
}

export const SOUNDS_PREFS_EVENT = "monocode:sound-prefs-change";

export function soundPref(cue: CustomizableCue): SoundPref {
  return loadSoundPrefs()[cue] ?? "preset";
}

function customPathFor(cue: SoundCue): string | null {
  if (!(CUSTOMIZABLE_CUES as readonly string[]).includes(cue)) return null;
  const pref = soundPref(cue as CustomizableCue);
  return pref === "preset" ? null : pref;
}

/**
 * Play one cue on demand (Settings preview). Unlike `playCue`, an explicit
 * user action is never gated by the master mute or per-project policy.
 */
export function previewCue(cue: CustomizableCue): void {
  applySoundEngine();
  const custom = customPathFor(cue);
  if (custom) {
    void playSoundFile(custom);
    return;
  }
  play(CUES[cue]);
}


export function loadSoundsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return SOUNDS_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return SOUNDS_DEFAULT;
  }
}

export function saveSoundsEnabled(value: boolean) {
  const resuming = value && !loadSoundsEnabled();
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
    if (resuming) localStorage.setItem(ENABLED_AT_KEY, String(Date.now()));
  } catch {
    // private mode / quota
  }
  applySoundEngine();
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(SOUNDS_CHANGE_EVENT, { detail: value }),
  );
}

function applySoundEngine() {
  setEnabled(loadSoundsEnabled());
  setVolume(SOUNDS_VOLUME);
  setSoundFileVolume(SOUNDS_VOLUME);
}

/** Apply the stored mute/volume before the first cue. */
export function initSounds() {
  applySoundEngine();
}

type ProjectSoundCue = "turnFinished" | "inboxUnseen" | "linkedActivity";

/** Project cues require their subject so new sources cannot bypass project policy. */
export function playCue(cue: Exclude<SoundCue, ProjectSoundCue>): boolean;
export function playCue(
  cue: ProjectSoundCue,
  subject: NotificationSubject,
): boolean;
export function playCue(cue: SoundCue, subject?: NotificationSubject): boolean {
  if (!loadSoundsEnabled()) return false;
  if (subject && !allowsProjectNotification(subject)) return false;
  if (subject?.occurredAt !== undefined) {
    try {
      if (subject.occurredAt < Number(localStorage.getItem(ENABLED_AT_KEY)))
        return false;
    } catch {
      /* Audio can still play when storage is unavailable. */
    }
  }
  applySoundEngine();
  const custom = customPathFor(cue);
  if (custom) {
    void playSoundFile(custom);
    return true;
  }
  play(CUES[cue]);
  return true;
}

let announcedUpdate: string | undefined;
const announcedLinkedActivities = new Set<string>();

/** Remember each session's activity across notice unmounts when switching tabs. */
export function announceLinkedActivity(
  sessionId: string,
  card: LinkedWorkItemUpdateCard | undefined,
) {
  if (!card || card.status !== "ready") return;
  const key = JSON.stringify([
    sessionId,
    card.kind,
    card.repo.toLowerCase(),
    card.number,
    card.updatedAt,
  ]);
  if (announcedLinkedActivities.has(key)) return;
  announcedLinkedActivities.add(key);
  playCue("linkedActivity", {
    projectId: inboxNotificationProject({ ...card, provider: "github" }).id,
    category: card.kind === "pr" ? "pullRequests" : "issues",
    occurredAt: card.updatedAt,
  });
}

/** One cue per available version, including a later probe of the same build. */
export function announceUpdateAvailable(version: string | null) {
  if (!version) {
    announcedUpdate = undefined;
    return;
  }
  if (announcedUpdate === version) return;
  announcedUpdate = version;
  playCue("updateAvailable");
}

/** Test helper: forget which notification cues already fired. */
export function resetSoundCues() {
  announcedUpdate = undefined;
  announcedLinkedActivities.clear();
}
