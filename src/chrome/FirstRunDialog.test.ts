// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  probeFirstRunReport: vi.fn<() => Promise<unknown>>(),
  githubStatus: vi.fn<() => Promise<unknown>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
  openExternalBestEffort: vi.fn<(url: string) => void>(),
}));

vi.mock("../lib/firstRun", () => ({
  probeFirstRunReport: probes.probeFirstRunReport,
}));

vi.mock("../lib/githubTasks", () => ({
  githubStatus: probes.githubStatus,
}));

vi.mock("../lib/clipboard", () => ({
  copyText: probes.copyText,
}));

vi.mock("../lib/openExternal", () => ({
  openExternalBestEffort: probes.openExternalBestEffort,
}));

import { FirstRunDialog } from "./FirstRunDialog";

const report = {
  clis: [
    {
      id: "claude",
      available: true,
      hint: "",
      install: "install claude",
    },
    {
      id: "codex",
      available: false,
      hint: "Codex is not installed",
      install: "install codex",
    },
  ],
  github: {
    connected: true,
    installed: true,
    authenticated: true,
  },
  system: {
    version: "0.2.31",
    flatpak: false,
    notifications: "granted",
    audio: "running",
  },
};

let container: HTMLDivElement;
let root: Root;

function button(label: string): HTMLButtonElement {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) => (item.getAttribute("aria-label") ?? item.textContent) === label,
  );
  expect(found, label).toBeDefined();
  return found!;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  localStorage.setItem("monocode.locale", "en");
  localStorage.setItem("monocode.experimentalAnimations", "0");
  probes.probeFirstRunReport.mockResolvedValue(report);
  probes.githubStatus.mockResolvedValue(report.github);
  probes.copyText.mockResolvedValue();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("FirstRunDialog", () => {
  it("shows the current version on the first step", async () => {
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Step 1 of 4");
    expect(dialog?.textContent).toContain("0.2.31");
    expect(probes.probeFirstRunReport).toHaveBeenCalledOnce();
  });

  it("moves forward and back through steps", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose,
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Step 2 of 4",
    );
    await act(async () => button("Back").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Step 1 of 4",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("skips and saves completion through the close callback", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose,
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Skip").click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blocks Escape and backdrop dismissal", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose,
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    const dialog = document.querySelector('[role="dialog"]');
    const backdrop = document.querySelector(".modal-backdrop");
    await act(async () => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      dialog?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("retries GitHub status without closing the wizard", async () => {
    const reportWithoutAuth = {
      ...report,
      github: {
        connected: false,
        installed: true,
        authenticated: false,
      },
    };
    probes.probeFirstRunReport.mockResolvedValue(reportWithoutAuth);
    probes.githubStatus.mockResolvedValue(report.github);
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose,
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "gh auth login",
    );
    await act(async () => button("Retry").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "GitHub CLI authenticated",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not claim an agent CLI is ready when none are available", async () => {
    probes.probeFirstRunReport.mockResolvedValue({
      ...report,
      clis: report.clis.map((cli) => ({
        ...cli,
        available: false,
        hint: `${cli.id} is not installed`,
      })),
    });
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    const dialogText = document.querySelector('[role="dialog"]')?.textContent;
    expect(dialogText).toContain("No agent CLI is ready yet.");
    expect(dialogText).not.toContain("At least one agent CLI is ready.");
  });

  it("keeps setup usable when the initial GitHub probe fails", async () => {
    probes.probeFirstRunReport.mockResolvedValue({
      ...report,
      github: {
        connected: false,
        installed: false,
        authenticated: false,
        error: true,
      },
    });
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Could not check GitHub CLI.",
    );
    expect(button("Retry").disabled).toBe(false);

    await act(async () => button("Continue").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Providers",
    );
  });

  it("shows GitHub rate-limit state without blocking progress", async () => {
    probes.probeFirstRunReport.mockResolvedValue({
      ...report,
      github: {
        ...report.github,
        rateLimited: true,
        retryAfterSecs: 42,
      },
    });
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Retry in 42s",
    );
    expect(button("Continue").disabled).toBe(false);
  });

  it("copies an available install command", async () => {
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    const copyButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy Codex install command"]',
    );
    expect(copyButton).not.toBeNull();
    await act(async () => copyButton!.click());
    expect(probes.copyText).toHaveBeenCalledWith("install codex");
  });

  it("opens Inbox after completing the wizard", async () => {
    const onClose = vi.fn();
    const onOpenInbox = vi.fn();
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose,
          onOpenInbox,
          onOpenProviders: vi.fn(),
        }),
      );
    });

    await act(async () => button("Continue").click());
    await act(async () => button("Continue").click());
    await act(async () => button("Open Inbox").click());
    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenInbox).toHaveBeenCalledOnce();
  });

  it("keeps retry interactive after the initial probe fails", async () => {
    probes.probeFirstRunReport
      .mockRejectedValueOnce(new Error("probe failed"))
      .mockResolvedValue(report);

    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    const retry = button("Retry");
    expect(retry.disabled).toBe(false);
    await act(async () => retry.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "0.2.31",
    );
  });

  it("does not shimmer under reduced motion", async () => {
    localStorage.setItem("monocode.experimentalAnimations", "1");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    probes.probeFirstRunReport.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    expect(document.querySelector(".shimmer-text")).toBeNull();
  });

  it("focuses the primary action", async () => {
    await act(async () => {
      root.render(
        createElement(FirstRunDialog, {
          onClose: vi.fn(),
          onOpenInbox: vi.fn(),
          onOpenProviders: vi.fn(),
        }),
      );
    });

    expect(document.activeElement).toBe(button("Continue"));
  });
});
