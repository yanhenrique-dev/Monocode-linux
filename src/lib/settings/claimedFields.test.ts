// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { loadLocale, saveLocale } from "../locale";
import { __resetSettingsStore, hydrateSettings, updateAppearance } from "./store";

/**
 * `toWire` claims a set of fields. A claimed field is a promise that the file
 * carries the truth about it -- and the store serialises the whole object, so a
 * claimed field nobody teaches the store is a field that gets overwritten with
 * its default by the next unrelated settings change.
 *
 * This file covers the claimed fields whose owner is localStorage. The two
 * that have no owner on this branch are asserted absent, with the reason,
 * because claiming a value that nothing maintains is worse than not claiming it
 * at all: the file would assert something false about the user.
 */
const savedPayload = (): Record<string, unknown> | null => {
  const saves = invoke.mock.calls.filter(([cmd]) => cmd === "settings_save");
  const payload = saves.at(-1)?.[1] as
    | { settings: Record<string, unknown> }
    | undefined;
  return payload?.settings ?? null;
};

const prefs = (): Record<string, unknown> =>
  (savedPayload()?.prefs ?? {}) as Record<string, unknown>;

const writeNative = async () => {
  updateAppearance({ themeHue: 240 });
  await vi.waitFor(() => expect(savedPayload()).not.toBeNull());
  return savedPayload();
};

beforeEach(() => {
  localStorage.clear();
  __resetSettingsStore();
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
});

describe("locale reaches the native file", () => {
  it("persists a language the user picked", async () => {
    await hydrateSettings();
    expect(loadLocale()).toBe("en");

    saveLocale("pt-BR");
    expect(loadLocale()).toBe("pt-BR");

    const general = (await writeNative())?.prefs as
      | { general: { locale: string } }
      | undefined;
    expect(general?.general.locale).toBe("pt-BR");
  });

  it("stays valid when the file offers a language that does not exist", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: { general: { locale: "kl-GL" } },
      view: {},
      runtime: {},
    });
    localStorage.setItem("monocode.locale", "pt-BR");
    await hydrateSettings();
    // Whatever the store ends up sending has to be a language the app can
    // actually render, or the next launch disagrees with this one.
    const general = (await writeNative())?.prefs as
      | { general: { locale: string } }
      | undefined;
    expect(["en", "pt-BR"]).toContain(general?.general.locale);
  });
});

describe("fields with no owner on this branch are not claimed", () => {
  it("does not send debugScopes, because nothing writes it", async () => {
    // The app's real switch is the single `monocode.debug` flag in logger.ts.
    // The store's `debugScopes` array has no writer at all, so every save was
    // asserting "debug off" even for a user who turned it on.
    await hydrateSettings();
    // Save first: asserting on an empty payload would pass for the wrong
    // reason, since "has no property" is also what no save at all looks like.
    await writeNative();
    expect(savedPayload()).not.toBeNull();
    expect(prefs()).not.toHaveProperty("diagnostics");
  });

  it("does not send nextSteps, because the shape does not exist yet", async () => {
    // On this branch the app has { enabled, count }. The store models
    // { enabled, suggest, actions: { three booleans } }, which arrives with the
    // Experimental settings section. Sending the store's version wrote a
    // nextSteps configuration the user never chose.
    await hydrateSettings();
    await writeNative();
    expect(savedPayload()).not.toBeNull();
    expect(prefs()).not.toHaveProperty("chat");
  });

  it("keeps claiming what it does own", async () => {
    await hydrateSettings();
    await writeNative();
    expect(prefs()).toHaveProperty("general");
    expect(prefs()).toHaveProperty("appearance");
  });
});
