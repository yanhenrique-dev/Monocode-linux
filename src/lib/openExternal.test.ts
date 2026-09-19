import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXTERNAL_URL_REFUSAL,
  isExternalUrlAllowed,
  openExternalBestEffort,
  openExternalUrl,
} from "./openExternal";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
  vi.restoreAllMocks();
});

describe("isExternalUrlAllowed", () => {
  it.each([
    "http://example.com/docs",
    "https://github.com/acme/web/issues/157",
    "HTTPS://example.com/x",
  ])("allows %s", (url) => {
    expect(isExternalUrlAllowed(url)).toBe(true);
  });

  it.each([
    "file:///etc/passwd",
    "mailto:someone@example.com",
    "tel:+123",
    "javascript:alert(1)",
    "data:text/plain,hi",
    "ftp://example.com/x",
    "",
    "https://",
    "http://",
    "https://?query-only",
    "https://exa mple.com",
    "https://example.com/a\\b",
    "  https://example.com",
        "https://example.com/\u0007",
  ])("rejects %s", (url) => {
    expect(isExternalUrlAllowed(url)).toBe(false);
  });
});

describe("openExternalUrl", () => {
  it("invokes the command for allowed URLs", async () => {
    invoke.mockResolvedValue(undefined);
    await openExternalUrl("https://example.com/docs");
    expect(invoke).toHaveBeenCalledWith("open_external_url", {
      url: "https://example.com/docs",
    });
  });

  it("rejects without IPC for refused URLs", async () => {
    await expect(openExternalUrl("file:///etc/passwd")).rejects.toThrow(
      EXTERNAL_URL_REFUSAL,
    );
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("openExternalBestEffort", () => {
  it("never rejects and warns on failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    invoke.mockRejectedValue(new Error("nope"));
    expect(() => openExternalBestEffort("https://example.com")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith(
      "[openExternal] browser did not open:",
      expect.any(Error),
    );
  });

  it("stays silent on success", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    invoke.mockResolvedValue(undefined);
    openExternalBestEffort("https://example.com");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).not.toHaveBeenCalled();
  });
});
