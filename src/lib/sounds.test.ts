import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const play = vi.fn();
const setEnabled = vi.fn();
const setVolume = vi.fn();

vi.mock("cuelume", () => ({
  play: (...args: unknown[]) => play(...args),
  setEnabled: (...args: unknown[]) => setEnabled(...args),
  setVolume: (...args: unknown[]) => setVolume(...args),
}));

import {
  announceUpdateAvailable,
  CUSTOMIZABLE_CUES,
  loadSoundPrefs,
  loadSoundsEnabled,
  playCue,
  previewCue,
  resetSoundCues,
  resetSoundPref,
  saveSoundPrefs,
  saveSoundsEnabled,
  soundPref,
  SOUNDS_DEFAULT,
  SOUNDS_VOLUME,
} from "./sounds";
import { updateNotificationPreferences } from "./notificationPreferences";
import { playSoundFile } from "./soundFiles";

vi.mock("./soundFiles", () => ({
  playSoundFile: (...args: unknown[]) => playSoundFileMock(...args),
  setSoundFileVolume: vi.fn(),
}));

const playSoundFileMock = vi.fn();

const KEY = "monocode.sounds";
const PREFS_KEY = "monocode.soundPrefs";

function mockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("sounds", () => {
  beforeEach(() => {
    mockLocalStorage();
    play.mockClear();
    setEnabled.mockClear();
    setVolume.mockClear();
    resetSoundCues();
  });

  afterEach(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREFS_KEY);
    resetSoundCues();
    playSoundFileMock.mockReset();
  });

  it("defaults to on", () => {
    expect(SOUNDS_DEFAULT).toBe(true);
    expect(loadSoundsEnabled()).toBe(true);
  });

  it("persists an off switch", () => {
    saveSoundsEnabled(false);
    expect(localStorage.getItem(KEY)).toBe("0");
    expect(loadSoundsEnabled()).toBe(false);
    expect(setEnabled).toHaveBeenCalledWith(false);
    saveSoundsEnabled(true);
    expect(loadSoundsEnabled()).toBe(true);
    expect(setEnabled).toHaveBeenLastCalledWith(true);
  });

  it("plays the mapped cue when enabled", () => {
    playCue("turnFinished", { projectId: "work", category: "agentFinished" });
    expect(setVolume).toHaveBeenCalledWith(SOUNDS_VOLUME);
    expect(play).toHaveBeenCalledWith("success");
    playCue("inboxUnseen", { projectId: "work", category: "issues" });
    expect(play).toHaveBeenCalledWith("bloom");
    playCue("linkedActivity", { projectId: "work", category: "pullRequests" });
    expect(play).toHaveBeenCalledWith("chime");
    playCue("updateAvailable");
    expect(play).toHaveBeenCalledWith("arrival");
    playCue("switch");
    expect(play).toHaveBeenCalledWith("toggle");
    playCue("copy");
    expect(play).toHaveBeenCalledWith("scan");
  });

  it("is silent when muted", () => {
    saveSoundsEnabled(false);
    play.mockClear();
    playCue("turnFinished", { projectId: "work", category: "agentFinished" });
    expect(play).not.toHaveBeenCalled();
  });

  it("previews on explicit demand even while muted", () => {
    saveSoundsEnabled(false);
    play.mockClear();
    previewCue("turnFinished");
    expect(play).toHaveBeenCalledWith("success");
  });

  it("plays a custom file instead of the preset when one is set", () => {
    saveSoundPrefs({ turnFinished: "/home/user/ding.ogg" });
    playCue("turnFinished", { projectId: "work", category: "agentFinished" });
    expect(playSoundFileMock).toHaveBeenCalledWith("/home/user/ding.ogg");
    expect(play).not.toHaveBeenCalled();
    // Non-customizable cues always use their preset.
    playCue("copy");
    expect(play).toHaveBeenCalledWith("scan");
    expect(playSoundFileMock).toHaveBeenCalledTimes(1);
  });

  it("stores, reads and resets per-cue prefs", () => {
    expect(soundPref("turnFinished")).toBe("preset");
    saveSoundPrefs({ turnFinished: "/a.ogg", inboxUnseen: "preset" });
    expect(loadSoundPrefs()).toEqual({ turnFinished: "/a.ogg" });
    expect(soundPref("turnFinished")).toBe("/a.ogg");
    expect(soundPref("inboxUnseen")).toBe("preset");
    expect(localStorage.getItem(PREFS_KEY)).not.toContain("inboxUnseen");
    resetSoundPref("turnFinished");
    expect(loadSoundPrefs()).toEqual({});
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
  });

  it("ignores malformed prefs and non-customizable cues", () => {
    localStorage.setItem(PREFS_KEY, "not json");
    expect(loadSoundPrefs()).toEqual({});
    localStorage.setItem(PREFS_KEY, JSON.stringify({ copy: "/x.ogg" }));
    expect(loadSoundPrefs()).toEqual({});
    expect(CUSTOMIZABLE_CUES).not.toContain("copy");
  });

  it("still respects project policy when a custom file is set", () => {
    saveSoundPrefs({ turnFinished: "/home/user/ding.ogg" });
    updateNotificationPreferences(["private"], { mutedUntil: null });
    playCue("turnFinished", { projectId: "private", category: "agentFinished" });
    expect(playSoundFileMock).not.toHaveBeenCalled();
  });

  it("suppresses project cues without silencing allowed projects or app-wide cues", () => {
    updateNotificationPreferences(["private"], { mutedUntil: null });
    playCue("turnFinished", {
      projectId: "private",
      category: "agentFinished",
    });
    expect(play).not.toHaveBeenCalled();
    playCue("inboxUnseen", { projectId: "work", category: "pullRequests" });
    playCue("updateAvailable");
    expect(play.mock.calls).toEqual([["bloom"], ["arrival"]]);
  });

  it("does not catch up on project activity from before global sounds were re-enabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    try {
      saveSoundsEnabled(false);
      vi.setSystemTime(2000);
      saveSoundsEnabled(true);
      playCue("inboxUnseen", {
        projectId: "work",
        category: "issues",
        occurredAt: 1500,
      });
      expect(play).not.toHaveBeenCalled();
      playCue("inboxUnseen", {
        projectId: "work",
        category: "issues",
        occurredAt: 2050,
      });
      expect(play).toHaveBeenCalledExactlyOnceWith("bloom");
    } finally {
      vi.useRealTimers();
    }
  });

  it("dings once per update version", () => {
    announceUpdateAvailable("0.2.0");
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("arrival");
    announceUpdateAvailable("0.2.0");
    expect(play).toHaveBeenCalledTimes(1);
    announceUpdateAvailable("0.2.1");
    expect(play).toHaveBeenCalledTimes(2);
  });
});
