// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";
import { rememberNotificationProjects } from "../lib/notificationProjects";
import type { SessionSummary } from "../lib/sessionStore";
import {
  SETTINGS_INDEX,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "../lib/settings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
  convertFileSrc: (path: string) => path,
}));
vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(async () => "0.1.67"),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: async () => false,
    onResized: async () => () => {},
  }),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => false),
  message: vi.fn(async () => undefined),
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
let onSelectSection: ReturnType<typeof vi.fn>;

async function render(
  section: SettingsSectionId,
  options: Partial<ComponentProps<typeof SettingsView>> = {},
) {
  await act(async () =>
    root.render(
      createElement(SettingsView, {
        section,
        cwd: "/repo",
        sessions: [],
        onClose: vi.fn(),
        onSelectSection,
        onOpenSession: vi.fn(),
        onArchiveSession: vi.fn(),
        onDeleteSession: vi.fn(),
        onOpenWhatsNew: vi.fn(),
        ...options,
      }),
    ),
  );
}

function renderedSettingIds(): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-setting-id]"),
    (node) => node.dataset.settingId!,
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onSelectSection = vi.fn();
  // These tests assert the English UI: pin the locale so a pt-BR OS does
  // not translate the surface under test.
  localStorage.setItem("monocode.locale", "en");
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("settings search reveal", () => {
  it("moves focus to the revealed row and announces it", async () => {
    await render("general", { anchor: "update" });
    const target = container.querySelector<HTMLElement>(
      '[data-setting-id="update"]',
    )!;
    expect(document.activeElement).toBe(target);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain("Version");
  });
});

describe("settings pages", () => {
  it("reopens, scrolls to, focuses and highlights the same project on a repeated notification settings request", async () => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    rememberNotificationProjects([
      {
        id: "repository:github.com/work/app",
        name: "work/app",
        detail: "github.com",
        kind: "repository",
        paths: ["/repo"],
      },
    ]);
    const shortcut = {
      anchor: "project-notifications" as const,
      notificationProjectPath: "/repo",
      notificationSettingsRequest: 1,
    };
    await render("notifications", shortcut);
    const project = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Notification categories for work/app"]',
    )!;
    const card = project.closest("fieldset")!;
    const section = container.querySelector(
      '[data-setting-id="project-notifications"]',
    )!;
    const highlight = () => section.querySelector(".border-accent\\/60");
    expect(highlight()).not.toBeNull();
    expect(project.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(card);

    await act(async () => vi.advanceTimersByTimeAsync(1800));
    expect(highlight()).toBeNull();
    await act(async () => project.click());
    expect(project.getAttribute("aria-expanded")).toBe("false");
    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search settings"]',
    )!;
    search.focus();
    expect(document.activeElement).toBe(search);
    scroll.mockClear();

    await render("notifications", { ...shortcut, notificationSettingsRequest: 2 });

    expect.soft(project.getAttribute("aria-expanded")).toBe("true");
    expect.soft(scroll).toHaveBeenCalledWith({ block: "nearest" });
    expect.soft(scroll.mock.contexts).toContain(card);
    expect.soft(document.activeElement === card).toBe(true);
    expect.soft(highlight()).not.toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(1800));
    expect(highlight()).toBeNull();
    expect(project.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(card);
  });

  it("clears the project shortcut highlight after 1.8 seconds while keeping its project open and focused", async () => {
    vi.useFakeTimers();
    rememberNotificationProjects([
      {
        id: "repository:github.com/work/app",
        name: "work/app",
        detail: "github.com",
        kind: "repository",
        paths: ["/repo"],
      },
    ]);
    await render("notifications", {
      anchor: "project-notifications",
      notificationProjectPath: "/repo",
    });
    const section = container.querySelector(
      '[data-setting-id="project-notifications"]',
    )!;
    const project = section.querySelector(
      'button[aria-label="Notification categories for work/app"]',
    )!;
    expect(section.querySelector(".border-accent\\/60")).not.toBeNull();
    expect(project.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(project.closest("fieldset"));

    await act(async () => vi.advanceTimersByTimeAsync(1800));

    expect(section.querySelector(".border-accent\\/60")).toBeNull();
    expect(project.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(project.closest("fieldset"));
  });

  it("gives every section a rail group", () => {
    const groups = new Set(SETTINGS_SECTIONS.map((section) => section.group));
    expect([...groups]).toEqual(["app", "agents", "workspace"]);
  });

  it("indexes each setting once", () => {
    const ids = SETTINGS_INDEX.map((entry) => entry.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  // The search index is hand-maintained; this is what keeps it honest.
  it.each(
    [...new Set(SETTINGS_INDEX.map((entry) => entry.section))].map(
      (section) => ({ section }),
    ),
  )(
    "renders every indexed setting on the $section page",
    async ({ section }) => {
      await render(section);
      const expected = SETTINGS_INDEX.filter(
        (entry) => entry.section === section,
      ).map((entry) => entry.id);
      expect(renderedSettingIds().sort()).toEqual(expected.sort());
    },
  );

  it("only tags rows that search can find", async () => {
    for (const section of SETTINGS_SECTIONS.map((item) => item.id)) {
      if (section === "skills") continue;
      await render(section);
      for (const id of renderedSettingIds()) {
        expect(
          SETTINGS_INDEX.some((entry) => entry.id === id),
          `${section}: ${id}`,
        ).toBe(true);
      }
    }
  });
});

describe("archived conversations", () => {
  function archivedSession(id: string, title: string): SessionSummary {
    return {
      id,
      cwd: "/repo",
      harness: "codex",
      model: "codex:gpt-5.4",
      runtimeMode: "supervised",
      title,
      createdAt: 1,
      updatedAt: 2,
      archived: true,
    };
  }

  function rowDeleteButton(title: string): HTMLButtonElement {
    const open = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === title)!;
    const row = open.parentElement!;
    return [...row.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Delete",
    )!;
  }

  function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"]');
  }

  function dialogButton(label: string): HTMLButtonElement {
    return [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === label,
    )!;
  }

  // Delete destroys a transcript for good and sits beside Unarchive, so a
  // stray click must not be the last word.
  it("asks before deleting one", async () => {
    const onDeleteSession = vi.fn();
    await render("archive", {
      sessions: [archivedSession("s1", "Fix login")],
      onDeleteSession,
    });

    await act(async () => rowDeleteButton("Fix login").click());
    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain("Delete “Fix login”?");
    await act(async () => {});
    expect(document.activeElement).toBe(dialogButton("Cancel"));

    await act(async () => dialogButton("Delete").click());
    expect(onDeleteSession).toHaveBeenCalledWith("s1");
    expect(dialog()).toBeNull();
  });

  it("leaves the conversation alone when the prompt is dismissed", async () => {
    const onDeleteSession = vi.fn();
    await render("archive", {
      sessions: [archivedSession("s1", "Fix login")],
      onDeleteSession,
    });

    await act(async () => rowDeleteButton("Fix login").click());
    await act(async () => dialogButton("Cancel").click());
    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("names only the conversation whose Delete was clicked", async () => {
    const onDeleteSession = vi.fn();
    await render("archive", {
      sessions: [
        archivedSession("s1", "Fix login"),
        archivedSession("s2", "Ship release"),
      ],
      onDeleteSession,
    });

    await act(async () => rowDeleteButton("Ship release").click());
    expect(dialog()?.textContent).toContain("Ship release");
    expect(dialog()?.textContent).not.toContain("Fix login");
    await act(async () => dialogButton("Delete").click());
    expect(onDeleteSession).toHaveBeenCalledWith("s2");
  });
});

describe("settings search", () => {
  async function type(value: string) {
    const input = container.querySelector<HTMLInputElement>(
      '[aria-label="Search settings"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input;
  }

  function options(): HTMLButtonElement[] {
    return Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    );
  }

  it("finds a setting that lives on another page", async () => {
    await render("general");
    await type("pacman");
    expect(options().map((item) => item.textContent)).toEqual([
      "Empty session gamesChat",
    ]);

    await act(async () => options()[0]!.click());
    expect(onSelectSection).toHaveBeenCalledWith("chat");
  });

  it("finds and reveals project notifications separately from global notifications", async () => {
    await render("general");
    await type("project notifications");
    expect(options().map((item) => item.textContent)).toEqual([
      "Project notificationsNotifications",
    ]);

    await act(async () => options()[0]!.click());
    expect(onSelectSection).toHaveBeenCalledWith("notifications");
    await render("notifications");
    const section = container.querySelector(
      '[data-setting-id="project-notifications"]',
    );
    expect(
      section?.querySelector('[aria-label="Project notifications"]'),
    ).not.toBeNull();
    expect(section?.querySelector(".border-accent\\/60")).not.toBeNull();
  });

  // A page whose name starts with the query beats a setting that merely
  // mentions it; anything weaker loses to the settings themselves.
  it("ranks a page against the settings that mention it", async () => {
    await render("general");
    await type("archive");
    expect(
      options().map((item) => item.querySelector("span")!.textContent),
    ).toEqual(["Archive", "Show archived in the sidebar"]);

    await type("notification");
    expect(
      options().map((item) => item.querySelector("span")!.textContent),
    ).toEqual([
      "Notifications",
      "Notifications",
      "Project notifications",
      "Claude Code hooks",
    ]);
  });

  it("closes the results without touching the page when cleared", async () => {
    await render("general");
    const input = await type("sounds");
    expect(options().length).toBeGreaterThan(0);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Clear settings search"]',
        )!
        .click();
    });
    expect(options()).toHaveLength(0);
    expect(input.value).toBe("");
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it("reveals a setting on the current page", async () => {
    await render("general");
    await type("notes");
    await act(async () => options()[0]!.click());
    expect(onSelectSection).not.toHaveBeenCalled();
    const row = container.querySelector('[data-setting-id="notes"]')!;
    expect(row.className).toContain("bg-accent/10");
  });

  it("navigates to another page for a moved setting", async () => {
    await render("general");
    await type("sounds");
    await act(async () => options()[0]!.click());
    expect(onSelectSection).toHaveBeenCalledWith("notifications");
  });
});

describe("interface blur master guard", () => {
  function blurToggle() {
    return container.querySelector<HTMLButtonElement>(
      '[data-setting-id="interface-blur"] button[role="switch"]',
    )!;
  }

  it("enables the toggle while hardware acceleration is on", async () => {
    localStorage.setItem("monocode.hardwareAcceleration", "1");
    await render("appearance");
    expect(blurToggle().disabled).toBe(false);
  });

  it("disables the toggle with a hint while hardware acceleration is off", async () => {
    localStorage.setItem("monocode.hardwareAcceleration", "0");
    await render("appearance");
    expect(blurToggle().disabled).toBe(true);
    expect(container.textContent).toContain(
      "Disabled while Hardware acceleration is off",
    );
  });
});

describe("UpdateRow busy feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function clickCheckForUpdates() {
    await render("general");
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((node) => node.textContent === "Check for updates")!;
    await act(async () => {
      button.click();
    });
    return button;
  }

  it("holds the spinner visible for instant checks", async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    const { message } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(check).mockResolvedValue(null);
    await clickCheckForUpdates();

    // The check already resolved, but the hold keeps the spinner painted.
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(container.querySelector(".animate-spin")).toBeNull();
    // Settings renders the result inline: no native dialog for this surface.
    expect(message).not.toHaveBeenCalled();
    expect(container.textContent).toContain("You're on the latest version.");
  });
});
