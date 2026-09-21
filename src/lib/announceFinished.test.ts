import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const playCueMock = vi.hoisted(() => vi.fn(() => true));
vi.mock("./sounds", () => ({
  loadSoundsEnabled: () => true,
  playCue: (...args: unknown[]) => playCueMock(...args),
}));

vi.mock("./notificationPreferences", () => ({
  allowsProjectNotification: () => true,
}));

vi.mock("./notificationProjects", () => ({
  knownNotificationProject: (path: string) => ({
    id: `local:${path}`,
    name: "proj",
    detail: path,
    kind: "local",
    paths: [path],
  }),
}));

import {
  announceSessionFinished,
  notifySession,
  saveNotificationsEnabled,
  setWindowFocused,
} from "./notifications";
import { newSession } from "./session";

describe("finish announcement sound fallback", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    invokeMock.mockReset();
    playCueMock.mockClear();
    saveNotificationsEnabled(true);
    setWindowFocused(false);
  });

  function finishedSession() {
    const session = newSession("codex", "/repo");
    session.blocks = [
      { id: "u1", role: "user", text: "hello" },
      { id: "a1", role: "assistant", text: "Done." },
    ];
    return session;
  }

  it("plays the in-app cue when the OS reports no sound", async () => {
    invokeMock.mockResolvedValue({ osSound: false });
    await announceSessionFinished(finishedSession(), false);
    expect(invokeMock).toHaveBeenCalledWith(
      "show_notification",
      expect.objectContaining({ sound: true }),
    );
    expect(playCueMock).toHaveBeenCalledWith(
      "turnFinished",
      expect.objectContaining({ category: "agentFinished" }),
    );
  });

  it("skips the in-app cue when the OS played its sound", async () => {
    invokeMock.mockResolvedValue({ osSound: true });
    await announceSessionFinished(finishedSession(), false);
    expect(playCueMock).not.toHaveBeenCalled();
  });

  it("plays the in-app cue when the dispatch is rejected", async () => {
    invokeMock.mockRejectedValue(new Error("daemon unavailable"));
    await announceSessionFinished(finishedSession(), false);
    expect(playCueMock).toHaveBeenCalledWith(
      "turnFinished",
      expect.objectContaining({ category: "agentFinished" }),
    );
  });

  it("reports banner delivery without the cue for input requests", async () => {
    invokeMock.mockResolvedValue({ osSound: false });
    const session = finishedSession();
    await expect(
      notifySession(session, { kind: "approval", requestId: 1 }, false),
    ).resolves.toBe(true);
    expect(playCueMock).not.toHaveBeenCalled();
    invokeMock.mockRejectedValue(new Error("daemon unavailable"));
    await expect(
      notifySession(session, { kind: "approval", requestId: 1 }, false),
    ).resolves.toBe(false);
  });
});
