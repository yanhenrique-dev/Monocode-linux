import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedManifest,
  getUpdateChannel,
  setUpdateChannel,
  shouldBackgroundCheck,
  UPDATE_POLL_INTERVAL_MS,
} from "./updater";

beforeEach(() => {
  window.localStorage.clear();
});

describe("update channel", () => {
  it("defaults to stable", () => {
    expect(getUpdateChannel()).toBe("stable");
  });

  it("persists beta opt-in", () => {
    setUpdateChannel("beta");
    expect(getUpdateChannel()).toBe("beta");
    setUpdateChannel("stable");
    expect(getUpdateChannel()).toBe("stable");
  });
});

describe("background check schedule", () => {
  it("checks on first run", () => {
    expect(shouldBackgroundCheck()).toBe(true);
  });

  it("skips when checked recently", () => {
    window.localStorage.setItem("monocode.update.lastCheck", String(Date.now()));
    expect(shouldBackgroundCheck()).toBe(false);
  });

  it("checks when interval elapsed", () => {
    window.localStorage.setItem(
      "monocode.update.lastCheck",
      String(Date.now() - UPDATE_POLL_INTERVAL_MS - 1000),
    );
    expect(shouldBackgroundCheck()).toBe(true);
  });
});

describe("cached manifest", () => {
  it("returns null when empty", () => {
    expect(getCachedManifest()).toBeNull();
  });

  it("rejects malformed cache", () => {
    window.localStorage.setItem("monocode.update.lastManifest", "not json");
    expect(getCachedManifest()).toBeNull();
  });
});
