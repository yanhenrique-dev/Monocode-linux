// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import type { HarnessId } from "./session";
import {
  defaultModelId,
  defaultSessionChoice,
  saveLastModelChoice,
} from "./models";

beforeEach(() => {
  localStorage.clear();
});

const ALL: readonly HarnessId[] = [
  "claude",
  "codex",
  "cursor",
  "grok",
  "opencode",
  "pi",
  "omp",
  "fx",
  "hermes",
  "mcode",
  "antigravity",
];

describe("defaultSessionChoice availability filter", () => {
  it("drops a stale cursor choice when it is not installed", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    expect(defaultSessionChoice(["claude"])).toEqual({
      harness: "claude",
      model: defaultModelId("claude"),
    });
  });

  it("picks the first available harness with no saved choice", () => {
    // Catalog order: claude, codex, cursor, ... — codex wins.
    expect(defaultSessionChoice(["codex", "cursor"]).harness).toBe("codex");
  });

  it("keeps an installed last harness", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    expect(defaultSessionChoice(ALL).harness).toBe("cursor");
  });

  it("keeps the last choice while availability is unknown", () => {
    saveLastModelChoice("cursor", "cursor:composer-2.5");
    expect(defaultSessionChoice().harness).toBe("cursor");
  });

  it("falls back to claude when nothing is installed", () => {
    expect(defaultSessionChoice([]).harness).toBe("claude");
  });
});
