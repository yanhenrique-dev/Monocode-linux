// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  __resetSettingsStore,
  getSettings,
  lastWritePersisted,
  updateGeneral,
  hydrateSettings,
  SETTINGS_CHANGE_EVENT,
  subscribeSettings,
  updateAppearance,
} from "./store";
import { readBootMirror } from "./bootMirror";
import { DEFAULT_SETTINGS } from "./schema";

beforeEach(() => {
  localStorage.clear();
  __resetSettingsStore();
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
});

afterEach(() => {
  __resetSettingsStore();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("snapshot stability", () => {
  // This is the whole contract with useSyncExternalStore, which compares
  // snapshots with Object.is. Returning a fresh object per read means
  // "changed" forever. An earlier version of this design did exactly that
  // twice, and the symptom is a view that renders until React gives up.
  it("returns the same reference until something is written", () => {
    const first = getSettings();
    expect(getSettings()).toBe(first);
    expect(getSettings()).toBe(first);
  });

  it("replaces the reference on write rather than mutating", () => {
    const before = getSettings();
    const after = updateAppearance({ themeHue: 100 });
    expect(after).not.toBe(before);
    expect(before.appearance.themeHue).toBe(
      DEFAULT_SETTINGS.appearance.themeHue,
    );
    expect(getSettings().appearance.themeHue).toBe(100);
  });

  it("does not hand out the shared default object", () => {
    // A caller mutating what it got back would corrupt every later reader.
    const settings = getSettings();
    expect(settings).not.toBe(DEFAULT_SETTINGS);
  });
});

describe("broadcast", () => {
  it("notifies subscribers on every write", () => {
    const seen = vi.fn();
    const release = subscribeSettings(seen);
    updateAppearance({ themeHue: 1 });
    updateAppearance({ themeHue: 2 });
    expect(seen).toHaveBeenCalledTimes(2);
    release();
    updateAppearance({ themeHue: 3 });
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("uses one event for the whole store", () => {
    expect(SETTINGS_CHANGE_EVENT).toBe("monocode:settings-change");
  });
});

describe("boot mirror", () => {
  it("is written synchronously on every appearance change", () => {
    updateAppearance({ themeHue: 123, uiScale: 1.5 });
    // Read straight from storage: a deferred write would let a relaunch boot
    // with the previous theme, which is the flash the mirror exists to stop.
    expect(localStorage.getItem("monocode.themeHue")).toBe("123");
    expect(localStorage.getItem("monocode.uiScale")).toBe("1.5");
  });

  it("reports a failed mirror write instead of claiming success", async () => {
    vi.useFakeTimers();
    // Spy the instance, not Storage.prototype: happy-dom defines setItem on
    // the object, so a prototype spy would silently never fire.
    const storage = globalThis.localStorage;
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const seen = vi.fn();
    const release = subscribeSettings(seen);
    updateAppearance({ themeHue: 55 });

    // The value is in memory, but nothing durable holds it, so the caller must
    // be able to tell: a subscriber that saw this would be told about a theme
    // that will not survive a relaunch.
    expect(lastWritePersisted()).toBe(false);
    expect(seen).not.toHaveBeenCalled();

    // A native write would be a promise that the next launch keeps a value the
    // mirror just refused, which is worse than not persisting at all.
    await vi.advanceTimersByTimeAsync(500);
    expect(invoke).not.toHaveBeenCalled();
    release();
    vi.restoreAllMocks();
  });

  it("does not touch keys the mirror does not own", () => {
    updateAppearance({ themeHue: 10 });
    expect(localStorage.getItem("monocode.transcriptLayout")).toBe(null);
  });
});

describe("native writes", () => {
  it("coalesces a burst into one write", async () => {
    vi.useFakeTimers();
    updateAppearance({ themeHue: 1 });
    updateAppearance({ themeHue: 2 });
    updateAppearance({ themeHue: 3 });
    expect(invoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("settings_save", expect.anything());
  });

  it("keeps the mirror right even when the native write fails", async () => {
    vi.useFakeTimers();
    invoke.mockRejectedValue(new Error("no such command"));
    updateAppearance({ themeHue: 77 });
    expect(localStorage.getItem("monocode.themeHue")).toBe("77");
    expect(getSettings().appearance.themeHue).toBe(77);
    await vi.runAllTimersAsync();
  });

  it("sends the fields the Rust struct actually has", async () => {
    // `diagnostics.debugScopes` used to be asserted here, and the payload
    // carried whatever the store happened to hold -- which was never the app's
    // real debug setting, because nothing writes a scopes array. The app's
    // switch is the single `monocode.debug` flag. The field is unclaimed until
    // something owns it; claimedFields.test.ts guards that.
    vi.useFakeTimers();
    updateGeneral({ locale: "pt-BR" });
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();
    const [, payload] = invoke.mock.calls[0] as [string, { settings: unknown }];
    expect(payload.settings).toMatchObject({
      schema: 1,
      prefs: { general: { locale: "pt-BR" } },
      view: { settingsSection: "general" },
      runtime: { lastUpdateCheck: 0 },
    });
  });
});

describe("wire contract with the Rust side", () => {
  // The file stores sidebarOpacity as a whole percent in a u8, while the app
  // uses a 0..1 alpha ratio for --sidebar-opacity. These two were written
  // independently and drifted: the TS side was sending 0.85 into a u8 field,
  // which serde cannot deserialize, so every save failed and every load fell
  // back to defaults with nothing to show for it. A unit mismatch across a
  // language boundary fails silently, so it gets pinned here.
  const wire = () => {
    vi.useFakeTimers();
    updateAppearance({ sidebarOpacity: 0.85 });
    vi.advanceTimersByTime(200);
    return invoke.mock.calls[0]?.[1] as
      | { settings: { prefs: { appearance: { sidebarOpacity: number } } } }
      | undefined;
  };

  it("sends a whole percent, which is what u8 can hold", () => {
    const sent = wire()?.settings.prefs.appearance.sidebarOpacity;
    expect(sent).toBe(85);
    expect(Number.isInteger(sent)).toBe(true);
  });

  it("keeps the app's own default in the app's own units", () => {
    expect(DEFAULT_SETTINGS.appearance.sidebarOpacity).toBe(0.85);
  });

  it("round-trips a percent back into a ratio", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: { appearance: { sidebarOpacity: 40 } },
      view: {},
      runtime: {},
    });
    localStorage.clear();
    const settings = await hydrateSettings();
    expect(settings.appearance.sidebarOpacity).toBeCloseTo(0.4, 5);
  });

  it("rejects a percent that cannot be a percent", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: { appearance: { sidebarOpacity: -1 } },
      view: {},
      runtime: {},
    });
    const settings = await hydrateSettings();
    expect(settings.appearance.sidebarOpacity).toBe(
      DEFAULT_SETTINGS.appearance.sidebarOpacity,
    );
  });
});

describe("hydrateSettings", () => {
  it("falls back to defaults with no native file", async () => {
    invoke.mockRejectedValue(new Error("not registered yet"));
    const settings = await hydrateSettings();
    expect(settings.appearance.themeHue).toBe(
      DEFAULT_SETTINGS.appearance.themeHue,
    );
  });

  // The load-bearing case: on an install that predates the store, settings.json
  // answers with defaults. Letting those win would reset every preference the
  // user has today, so the mirror is read afterwards and wins for the fields
  // that have not been migrated yet.
  it("lets the mirror win over a fresh native default", async () => {
    invoke.mockResolvedValue({ schema: 1, prefs: {}, view: {}, runtime: {} });
    localStorage.setItem("monocode.themeHue", "300");
    localStorage.setItem("monocode.uiScale", "1.25");
    localStorage.setItem("monocode.experimentalAnimations", "1");

    const settings = await hydrateSettings();
    expect(settings.appearance.themeHue).toBe(300);
    expect(settings.appearance.uiScale).toBe(1.25);
    expect(settings.appearance.experimentalAnimations).toBe(true);
  });

  it("takes a native value for a field that is not in the mirror", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: {
        general: { locale: "pt-BR" },
        chat: { nextSteps: { enabled: true } },
      },
      view: {},
      runtime: {},
    });
    const settings = await hydrateSettings();
    expect(settings.general.locale).toBe("pt-BR");
    expect(settings.experimental.nextSteps.enabled).toBe(true);
  });

  it("ignores a native value that is out of range", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: { appearance: { themeHue: 9999, sidebarOpacity: -5 } },
      view: {},
      runtime: {},
    });
    const settings = await hydrateSettings();
    expect(settings.appearance.themeHue).toBe(
      DEFAULT_SETTINGS.appearance.themeHue,
    );
    expect(settings.appearance.sidebarOpacity).toBe(
      DEFAULT_SETTINGS.appearance.sidebarOpacity,
    );
  });

  it("ignores an unknown locale rather than storing it", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: { general: { locale: "kl" } },
      view: {},
      runtime: {},
    });
    const settings = await hydrateSettings();
    expect(settings.general.locale).toBe("en");
  });

  it("survives garbage from the native side", async () => {
    for (const raw of [null, "nope", 42, [], { prefs: "wrong" }]) {
      invoke.mockResolvedValue(raw);
      const settings = await hydrateSettings();
      expect(settings).toBeTruthy();
      expect(typeof settings.appearance.themeHue).toBe("number");
    }
  });

  it("writes the mirror on the way out, so the next boot matches", async () => {
    invoke.mockResolvedValue({ schema: 1, prefs: {}, view: {}, runtime: {} });
    localStorage.setItem("monocode.themeHue", "42");
    await hydrateSettings();
    expect(localStorage.getItem("monocode.themeHue")).toBe("42");
    expect(readBootMirror().themeHue).toBe(42);
  });
});
