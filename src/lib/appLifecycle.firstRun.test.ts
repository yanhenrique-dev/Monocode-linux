import { beforeEach, describe, expect, it, vi } from "vitest";

const bootMocks = vi.hoisted(() => ({
  lastProjectPath: vi.fn<() => string | null>(),
  loadWindowTransfer: vi.fn<() => Promise<unknown>>(),
  loadWorkspaceSnapshot: vi.fn<() => Promise<unknown>>(),
  listInFlightSessions: vi.fn<() => Promise<unknown[]>>(),
  listSessionsByProject: vi.fn<() => Promise<unknown[]>>(),
  getSession: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
}));

vi.mock("./harness", () => ({
  bindHarnessSession: vi.fn(),
  forgetHarnessSession: vi.fn(),
  isLiveHarness: vi.fn(),
  killAllChildren: vi.fn(),
}));

vi.mock("./windowTransferBootstrap", () => ({
  loadWindowTransfer: bootMocks.loadWindowTransfer,
}));

vi.mock("./recents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./recents")>()),
  lastProjectPath: bootMocks.lastProjectPath,
}));

vi.mock("./sessionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sessionStore")>()),
  loadWorkspaceSnapshot: bootMocks.loadWorkspaceSnapshot,
  listInFlightSessions: bootMocks.listInFlightSessions,
  listSessionsByProject: bootMocks.listSessionsByProject,
  getSession: bootMocks.getSession,
}));

describe("first-run boot signal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    bootMocks.lastProjectPath.mockReturnValue(null);
    bootMocks.loadWindowTransfer.mockResolvedValue(null);
    bootMocks.loadWorkspaceSnapshot.mockResolvedValue(null);
    bootMocks.listInFlightSessions.mockResolvedValue([]);
    bootMocks.listSessionsByProject.mockResolvedValue([]);
    bootMocks.getSession.mockResolvedValue(null);
  });

  it("marks a clean normal boot as first run", async () => {
    const { loadBootWorkspace } = await import("./appLifecycle");
    const boot = await loadBootWorkspace();

    expect(boot.isFirstRun).toBe(true);
  });

  it("does not mark a window transfer as first run", async () => {
    bootMocks.loadWindowTransfer.mockResolvedValue({
      projectCwd: "/project",
      sessions: [],
      tabs: [],
      activeTabId: "",
      dirtyFileIds: [],
    });
    const { loadBootWorkspace } = await import("./appLifecycle");
    const boot = await loadBootWorkspace();

    expect(boot.isFirstRun).toBe(false);
  });

  it("does not mark pending in-flight references as first run", async () => {
    bootMocks.listInFlightSessions.mockResolvedValue([
      { sessionId: "session-1", cwd: "/project" },
    ]);
    const { loadBootWorkspace } = await import("./appLifecycle");
    const boot = await loadBootWorkspace();

    expect(boot.isFirstRun).toBe(false);
  });

  it("does not mark a recent project boot as first run", async () => {
    bootMocks.lastProjectPath.mockReturnValue("/project");
    const { loadBootWorkspace } = await import("./appLifecycle");
    const boot = await loadBootWorkspace();

    expect(boot.isFirstRun).toBe(false);
  });
});
