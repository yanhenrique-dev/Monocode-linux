// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessId } from "./session";

const { isHarnessAvailable } = vi.hoisted(() => ({
  isHarnessAvailable: vi.fn<(id: HarnessId) => boolean>(),
}));
vi.mock("./harness/availability", () => ({
  isHarnessAvailable,
  availableHarnessIds: () =>
    (
      ["claude", "codex", "cursor", "grok", "opencode", "pi", "omp", "fx", "hermes", "mcode", "antigravity"] as HarnessId[]
    ).filter((id) => isHarnessAvailable(id)),
}));

import { preferredModelId, resolveModel, saveLastModelChoice } from "./models";
import { newAvailableDefaultSession, newSessionForSeed } from "./session";

describe("availability-aware session defaults (porte #208)", () => {
  beforeEach(() => {
    localStorage.clear();
    isHarnessAvailable.mockReset();
  });

  it("starts on the first installed provider", () => {
    isHarnessAvailable.mockImplementation((id) => id === "codex");
    const session = newAvailableDefaultSession("/repo");
    expect(session.harness).toBe("codex");
    expect(session.model).toBe(
      resolveModel("codex", preferredModelId("codex")).id,
    );
  });

  it("keeps an installed saved default", () => {
    saveLastModelChoice("opencode", "opencode:glm-5");
    isHarnessAvailable.mockImplementation((id) => id === "opencode");
    const session = newAvailableDefaultSession("/repo");
    expect(session.harness).toBe("opencode");
    expect(session.model).toBe(
      resolveModel("opencode", preferredModelId("opencode")).id,
    );
  });

  it("reseeds an unavailable provider onto the installed default", () => {
    isHarnessAvailable.mockImplementation((id) => id === "codex");
    const session = newSessionForSeed(
      { harness: "cursor", model: "cursor:composer-2.5" },
      "/repo",
    );
    expect(session.harness).toBe("codex");
    expect(session.cwd).toBe("/repo");
  });

  it("keeps a seed whose provider is installed", () => {
    isHarnessAvailable.mockReturnValue(true);
    const session = newSessionForSeed(
      { harness: "cursor", model: "cursor:composer-2.5" },
      "/repo",
    );
    expect(session.harness).toBe("cursor");
    expect(session.model).toBe("cursor:composer-2.5");
  });
});
