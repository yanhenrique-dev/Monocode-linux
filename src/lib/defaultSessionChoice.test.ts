// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessId } from "./session";

const available = vi.hoisted(() => ({ ids: new Set<HarnessId>(), probed: false }));

vi.mock("./harness/availability", () => ({
  hasProbedHarnessAvailability: () => available.probed,
  isHarnessAvailable: (id: HarnessId) => available.ids.has(id),
}));

import { defaultModelId, defaultSessionChoice, saveLastModelChoice } from "./models";

beforeEach(() => {
  localStorage.clear();
  available.ids.clear();
  available.probed = false;
});

describe("defaultSessionChoice availability filter", () => {
  it("drops a stale cursor choice once probed missing", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    available.probed = true;
    available.ids.add("claude");
    expect(defaultSessionChoice()).toEqual({
      harness: "claude",
      model: defaultModelId("claude"),
    });
  });

  it("picks the first available harness with no saved choice", () => {
    available.probed = true;
    available.ids.add("codex");
    available.ids.add("cursor");
    // Catalog order: claude, codex, cursor, ... — codex wins.
    expect(defaultSessionChoice().harness).toBe("codex");
  });

  it("keeps an installed last harness", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    available.probed = true;
    available.ids.add("cursor");
    available.ids.add("claude");
    expect(defaultSessionChoice().harness).toBe("cursor");
  });

  it("keeps the last choice while the probe has not run yet", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    expect(defaultSessionChoice().harness).toBe("cursor");
  });

  it("falls back to claude when nothing is installed", () => {
    available.probed = true;
    expect(defaultSessionChoice().harness).toBe("claude");
  });
});
