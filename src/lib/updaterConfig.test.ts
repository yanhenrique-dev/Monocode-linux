import { afterEach, describe, expect, it, vi } from "vitest";

const { getVersion, check, message, ask, relaunch } = vi.hoisted(() => ({
  getVersion: vi.fn(),
  check: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({ getVersion }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask, message }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch }));
vi.mock("./sounds", () => ({ announceUpdateAvailable: vi.fn() }));

import { runUpdateFlow } from "./updater";

describe("updater", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("keeps automatic checks quiet when updater endpoints are missing", async () => {
    getVersion.mockResolvedValue("0.1.23");
    check.mockRejectedValue(new Error("Updater does not have any endpoints set"));

    await expect(runUpdateFlow(false)).resolves.toEqual({
      phase: "idle",
      currentVersion: "0.1.23",
    });
    expect(message).not.toHaveBeenCalled();
  });

  it("points manual checks without updater endpoints to GitHub releases", async () => {
    getVersion.mockResolvedValue("0.1.23");
    check.mockRejectedValue(new Error("Updater does not have any endpoints set"));

    await expect(runUpdateFlow(true)).resolves.toEqual({
      phase: "idle",
      currentVersion: "0.1.23",
    });
    expect(message).toHaveBeenCalledWith(
      expect.stringContaining("https://github.com/yanhenrique-dev/Monocode-linux/releases/latest"),
      { title: "MonoCode" },
    );
  });

  it("still reports real updater failures", async () => {
    getVersion.mockResolvedValue("0.1.23");
    check.mockRejectedValue(new Error("network failed"));

    await expect(
      runUpdateFlow(true, undefined, { retryDelaysMs: [0, 0] }),
    ).resolves.toMatchObject({
      phase: "error",
      error: "network failed",
    });
    expect(message).toHaveBeenCalledOnce();
  });

  it("retries transient check failures before reporting", async () => {
    getVersion.mockResolvedValue("0.1.23");
    check
      .mockRejectedValueOnce(new Error("network failed"))
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce(null);

    await expect(
      runUpdateFlow(false, undefined, { retryDelaysMs: [0, 0] }),
    ).resolves.toEqual({
      phase: "current",
      currentVersion: "0.1.23",
    });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("does not retry missing-endpoint errors", async () => {
    getVersion.mockResolvedValue("0.1.23");
    check.mockRejectedValue(new Error("Updater does not have any endpoints set"));

    await runUpdateFlow(false, undefined, { retryDelaysMs: [0, 0] });
    expect(check).toHaveBeenCalledOnce();
  });

  it("maps disk-full errors to the free-space hint", async () => {
    getVersion.mockResolvedValue("0.2.31");
    check.mockRejectedValue(new Error("No space left on device (os error 28)"));

    await expect(
      runUpdateFlow(true, undefined, { retryDelaysMs: [0, 0] }),
    ).resolves.toMatchObject({
      phase: "error",
      error: expect.stringMatching(/disk space|espaço em disco/),
    });
  });

  it("prefers the disk-full hint when ENOSPC mentions the staging path", async () => {
    getVersion.mockResolvedValue("0.2.31");
    check.mockRejectedValue(
      new Error(
        'No space left on device (os error 28) at path "/usr/local/bin/tauri_current_appli25gA"',
      ),
    );

    await expect(runUpdateFlow(true)).resolves.toMatchObject({
      phase: "error",
      error: expect.stringMatching(/disk space|espaço em disco/),
    });
    expect(check).toHaveBeenCalledOnce();
  });

  it("does not retry disk-full errors", async () => {
    getVersion.mockResolvedValue("0.2.31");
    check.mockRejectedValue(new Error("No space left on device (os error 28)"));

    await runUpdateFlow(false);
    expect(check).toHaveBeenCalledOnce();
  });

  it("does not retry missing-platform manifest errors", async () => {
    getVersion.mockResolvedValue("0.2.31");
    check.mockRejectedValue(
      new Error(
        "the platform `linux-x86_64` was not found in the response `platforms` object",
      ),
    );

    await runUpdateFlow(false);
    expect(check).toHaveBeenCalledOnce();
  });

  it("maps system-path permission errors to the reinstall hint", async () => {
    getVersion.mockResolvedValue("0.2.17");
    check.mockRejectedValue(
      new Error(
        'Permissão negada (os error 13) at path "/usr/local/bin/tauri_current_appli25gA"',
      ),
    );

    await expect(runUpdateFlow(true)).resolves.toMatchObject({
      phase: "error",
      error: expect.stringContaining("~/.local/bin"),
    });
    expect(message).toHaveBeenCalledWith(
      expect.not.stringContaining("tauri_current_appli25gA"),
      { title: "MonoCode" },
    );
  });
});
