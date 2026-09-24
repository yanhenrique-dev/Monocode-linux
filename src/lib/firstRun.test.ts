import { describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  readAppVersion: vi.fn<() => Promise<string>>(),
  probeHarnessAvailability:
    vi.fn<(options?: { force?: boolean }) => Promise<void>>(),
  isHarnessAvailable: vi.fn<(id: string) => boolean>(),
  harnessUnavailableHint: vi.fn<(id: string) => string>(),
  harnessInstallHint: vi.fn<(id: string) => string | null>(),
  githubStatus: vi.fn<
    () => Promise<{
      connected: boolean;
      installed: boolean;
      authenticated: boolean;
      rateLimited?: boolean;
      retryAfterSecs?: number;
    }>
  >(),
  isFlatpakSandbox: vi.fn<() => Promise<boolean>>(),
  probeNotificationPermission:
    vi.fn<() => Promise<"prompt" | "granted" | "denied" | "unsupported">>(),
  audioPlaybackState: vi.fn<() => "running" | "suspended" | "unavailable">(),
}));

vi.mock("./updater", () => ({
  readAppVersion: probes.readAppVersion,
  isFlatpakSandbox: probes.isFlatpakSandbox,
}));

vi.mock("./harness/availability", () => ({
  probeHarnessAvailability: probes.probeHarnessAvailability,
  isHarnessAvailable: probes.isHarnessAvailable,
  harnessUnavailableHint: probes.harnessUnavailableHint,
  harnessInstallHint: probes.harnessInstallHint,
}));

vi.mock("./githubTasks", () => ({
  githubStatus: probes.githubStatus,
}));

vi.mock("./notifications", () => ({
  probeNotificationPermission: probes.probeNotificationPermission,
}));

vi.mock("./soundFiles", () => ({
  audioPlaybackState: probes.audioPlaybackState,
}));

import {
  FIRST_RUN_KEY,
  loadFirstRunDone,
  probeFirstRunReport,
  saveFirstRunDone,
  shouldBlockAppAction,
  type FirstRunStore,
} from "./firstRun";

function memoryStore(): FirstRunStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function resetProbes() {
  vi.clearAllMocks();
  probes.readAppVersion.mockResolvedValue("0.2.31");
  probes.probeHarnessAvailability.mockResolvedValue();
  probes.isHarnessAvailable.mockReturnValue(true);
  probes.harnessUnavailableHint.mockImplementation((id) => `missing ${id}`);
  probes.harnessInstallHint.mockImplementation((id) =>
    id === "claude" ? "install claude" : null,
  );
  probes.githubStatus.mockResolvedValue({
    connected: true,
    installed: true,
    authenticated: true,
  });
  probes.isFlatpakSandbox.mockResolvedValue(false);
  probes.probeNotificationPermission.mockResolvedValue("granted");
  probes.audioPlaybackState.mockReturnValue("running");
}

describe("first-run flag", () => {
  it("persists completion and reads it once", () => {
    const store = memoryStore();
    expect(loadFirstRunDone(store)).toBe(false);
    saveFirstRunDone(store);
    expect(store.getItem(FIRST_RUN_KEY)).toBe("1");
    expect(loadFirstRunDone(store)).toBe(true);
  });

  it.each(["", "false", "0", "broken", "true"])(
    "treats %j as incomplete",
    (value) => {
      const store = memoryStore();
      store.setItem(FIRST_RUN_KEY, value);
      expect(loadFirstRunDone(store)).toBe(false);
    },
  );

  it("contains storage errors", () => {
    const store: FirstRunStore = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };
    expect(loadFirstRunDone(store)).toBe(false);
    expect(() => saveFirstRunDone(store)).not.toThrow();
  });
});

describe("first-run app actions", () => {
  it("blocks app actions only while setup is open", () => {
    expect(shouldBlockAppAction(true)).toBe(true);
    expect(shouldBlockAppAction(false)).toBe(false);
  });
});

describe("first-run report", () => {
  it("probes version, CLIs, GitHub, sandbox, notifications, and audio", async () => {
    resetProbes();
    const report = await probeFirstRunReport();

    expect(probes.probeHarnessAvailability).toHaveBeenCalledWith({
      force: true,
    });
    expect(report.system).toEqual({
      version: "0.2.31",
      flatpak: false,
      notifications: "granted",
      audio: "running",
    });
    expect(report.clis).toHaveLength(11);
    expect(report.clis.every((cli) => cli.available)).toBe(true);
    expect(report.clis.find((cli) => cli.id === "claude")?.install).toBe(
      "install claude",
    );
    expect(report.github).toEqual({
      connected: true,
      installed: true,
      authenticated: true,
    });
  });

  it("reports every CLI as unavailable without failing", async () => {
    resetProbes();
    probes.isHarnessAvailable.mockReturnValue(false);
    const report = await probeFirstRunReport();

    expect(report.clis.every((cli) => !cli.available)).toBe(true);
    expect(report.clis.every((cli) => cli.hint.startsWith("missing "))).toBe(
      true,
    );
  });

  it("propagates GitHub probe errors for retry", async () => {
    resetProbes();
    probes.githubStatus.mockRejectedValue(new Error("IPC unavailable"));

    await expect(probeFirstRunReport()).rejects.toThrow("IPC unavailable");
  });

  it("handles a null GitHub response from browser preview", async () => {
    resetProbes();
    probes.githubStatus.mockResolvedValue(null as never);
    const report = await probeFirstRunReport();

    expect(report.github).toEqual({
      connected: false,
      installed: false,
      authenticated: false,
    });
  });

  it("preserves Flatpak and GitHub rate-limit state", async () => {
    resetProbes();
    probes.isFlatpakSandbox.mockResolvedValue(true);
    probes.githubStatus.mockResolvedValue({
      connected: true,
      installed: true,
      authenticated: true,
      rateLimited: true,
      retryAfterSecs: 42,
    });
    const report = await probeFirstRunReport();

    expect(report.system.flatpak).toBe(true);
    expect(report.github.rateLimited).toBe(true);
    expect(report.github.retryAfterSecs).toBe(42);
  });
});
