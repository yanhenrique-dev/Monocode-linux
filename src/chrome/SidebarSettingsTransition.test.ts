// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSessionTitle } from "../lib/session";
import { Sidebar } from "./Sidebar";

vi.mock("../hooks/useProjectDiffStats", () => ({
  useProjectDiffStats: () => null,
}));
vi.mock("../hooks/useGitFileStatuses", () => ({
  useGitFileStatuses: () => ({ files: new Map(), dirs: new Map() }),
}));
vi.mock("./SidebarUpdate", () => ({ SidebarUpdateFooter: () => null }));
vi.mock("./FileTree", () => ({ FileTree: () => null }));

let container: HTMLDivElement;
let root: Root;
let props: ComponentProps<typeof Sidebar>;

function structure() {
  return {
    asides: container.querySelectorAll("aside").length,
    rails: container.querySelectorAll('nav[aria-label="Projects"]').length,
    settingsNav: (container.textContent ?? "").includes("Back") ? 1 : 0,
    cards: container.querySelectorAll("[data-session-card]").length,
    animOut: container.querySelectorAll(".sidebar-anim-out").length,
    animIn: container.querySelectorAll(".sidebar-anim-in").length,
  };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const stored = new Map<string, string>([
    ["monocode.experimentalAnimations", "1"],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      stored.set(key, value);
    },
    removeItem: (key: string) => stored.delete(key),
    clear: () => stored.clear(),
  });
  vi.useFakeTimers();
  props = {
    cwd: "/workspace/project",
    open: true,
    sessions: [
      {
        id: "session-1",
        cwd: "/workspace/project",
        harness: "codex",
        model: "",
        runtimeMode: "supervised",
        title: formatSessionTitle("codex", "Original conversation"),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    busySessionIds: new Set(),
    approvalSessionIds: new Set(),
    activeSessionId: "session-1",
    status: "idle",
    pending: false,
    tab: "sessions",
    filesSearchOpen: false,
    onSelectSession: vi.fn(),
    onOpenFile: vi.fn(),
    onTabChange: vi.fn(),
    onFilesSearchOpenChange: vi.fn(),
    onSelectProject: vi.fn(),
    onOpenProject: vi.fn(),
    projectRailOpen: false,
    settingsOpen: false,
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    onSelectSettingsSection: vi.fn(),
  } as unknown as ComponentProps<typeof Sidebar>;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("settings transition", () => {
  it("unmounts the session sidebar after its outro, then animates it back", () => {
    act(() => {
      root.render(createElement(Sidebar, props));
    });
    expect(structure()).toMatchObject({ asides: 1, cards: 1, rails: 0 });

    act(() => {
      root.render(createElement(Sidebar, { ...props, settingsOpen: true }));
    });
    // Outro holds the fading panel briefly; settle must leave only the rail.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(structure()).toMatchObject({
      asides: 0,
      rails: 1,
      settingsNav: 1,
      cards: 0,
    });

    act(() => {
      root.render(createElement(Sidebar, { ...props, settingsOpen: false }));
    });
    // Returning plays the enter animation instead of appearing dry.
    expect(structure()).toMatchObject({
      asides: 1,
      cards: 1,
      rails: 0,
      animIn: 1,
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(structure()).toMatchObject({ asides: 1, cards: 1, rails: 0 });
  });
});
