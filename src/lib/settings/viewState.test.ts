// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  loadProjectRailOpen,
  loadSidebarTabOrder,
  saveProjectRailOpen,
  saveSidebarTabOrder,
} from "../appearance";
import { loadSettingsSection, saveSettingsSection } from "../settings";
import { __resetSettingsStore, hydrateSettings, updateAppearance } from "./store";

/**
 * The Rust `View` struct declares three fields, and `toWire` already sends all
 * three. What it sends, though, is the store's copy -- and for these keys
 * nothing tells the store anything. They are not boot keys, so they are not in
 * the mirror, so `saveProjectRailOpen` writes only to localStorage while the
 * store keeps its default.
 *
 * The result is silent and delayed. Toggling the rail, or navigating to
 * another Settings section, is not persisted natively. The loss lands later,
 * on the next unrelated settings change, because saving serialises the whole
 * object: a theme tweak or an opacity drag writes the store's stale view state
 * over the correct one. The user then finds their rail closed again after a
 * restart they did not connect to the setting they changed.
 *
 * Reading is broken the same way in the other direction. A non-boot key lives
 * only in the store once hydrated, but `loadSettingsSection` still reads
 * localStorage, so a value that came back from the file never reaches the
 * caller. Migrating a key therefore means moving both ends, not just the
 * write.
 */
/** The payload of the last settings_save, ignoring the settings_load. */
const nativeView = (): Record<string, unknown> => {
  const saves = invoke.mock.calls.filter(([cmd]) => cmd === "settings_save");
  const payload = saves.at(-1)?.[1] as
    | { settings: { view: Record<string, unknown> } }
    | undefined;
  return payload?.settings.view ?? {};
};

const writeNative = async () => {
  updateAppearance({ themeHue: Math.floor(Math.random() * 200) + 10 });
  await vi.waitFor(() =>
    expect(
      invoke.mock.calls.filter(([cmd]) => cmd === "settings_save").length,
    ).toBeGreaterThan(0),
  );
  return nativeView();
};

beforeEach(() => {
  localStorage.clear();
  __resetSettingsStore();
  invoke.mockReset();
  invoke.mockResolvedValue(undefined);
});

describe("view state survives the store", () => {
  it("persists a rail toggle that the store would otherwise revert", async () => {
    await hydrateSettings();
    expect(loadProjectRailOpen()).toBe(true);

    saveProjectRailOpen(false);
    expect(loadProjectRailOpen()).toBe(false);

    // An unrelated change serialises the whole object. Without the store
    // knowing about the toggle, this writes the stale `true` back and the rail
    // reopens on the next launch.
    expect(await writeNative()).toMatchObject({ projectRailOpen: false });
  });

  it("keeps localStorage as the owner when the file disagrees", async () => {
    // The file is a write-through cache, not a source. localStorage is what the
    // user last chose, so it wins even though the file says otherwise.
    invoke.mockResolvedValue({
      schema: 1,
      prefs: {},
      view: { projectRailOpen: true },
      runtime: {},
    });
    localStorage.setItem("monocode.projectRailOpen", "0");
    await hydrateSettings();

    expect(loadProjectRailOpen()).toBe(false);
    expect(await writeNative()).toMatchObject({ projectRailOpen: false });
  });

  it("persists the Settings section the user navigated to", async () => {
    await hydrateSettings();
    saveSettingsSection("keybindings");
    expect(loadSettingsSection()).toBe("keybindings");
    expect(await writeNative()).toMatchObject({
      settingsSection: "keybindings",
    });
  });

  it("keeps the Settings section owned by localStorage too", async () => {
    invoke.mockResolvedValue({
      schema: 1,
      prefs: {},
      view: { settingsSection: "general" },
      runtime: {},
    });
    localStorage.setItem("monocode.settingsSection", "performance");
    await hydrateSettings();

    expect(loadSettingsSection()).toBe("performance");
    expect(await writeNative()).toMatchObject({
      settingsSection: "performance",
    });
  });

  it("sends the real tab order instead of a hardcoded empty list", async () => {
    await hydrateSettings();
    saveSidebarTabOrder(["sessions", "files", "changes", "inbox"]);
    expect(await writeNative()).toMatchObject({
      sidebarTabOrder: ["sessions", "files", "changes", "inbox"],
    });
    expect(loadSidebarTabOrder()[0]).toBe("sessions");
  });
});
