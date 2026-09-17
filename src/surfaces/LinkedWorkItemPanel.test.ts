// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearInboxCache, type GithubWorkItem } from "../lib/githubTasks";
import type { LinkedWorkItem } from "../lib/session";
import {
  isInboxEntryUnseen,
  seedInboxSeenIfNeeded,
} from "../lib/inboxSeen";
import { linkedSessionSeenAt } from "../lib/linkedSessionSeen";
import { LinkedWorkItemPanel } from "./InboxView";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const target: LinkedWorkItem = {
  kind: "issue",
  repo: "acme/web",
  number: 157,
  url: "https://github.com/acme/web/issues/157",
};

const item: GithubWorkItem = {
  ...target,
  title: "Keep the linked panel warm",
  state: "open",
  updatedAt: "2026-09-16T08:00:00Z",
  labels: [],
  assignees: [],
  draft: false,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearInboxCache();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "git_github_work_item") return item;
    if (command === "git_github_work_item_details") {
      return { body: "Issue body", author: "octocat" };
    }
    if (command === "git_github_work_item_thread") {
      return {
        comments: [],
        commits: [],
        truncated: false,
        reviewDecision: "",
        baseRefName: "",
        headRefName: "",
      };
    }
    throw new Error(`Unexpected command: ${command}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearInboxCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(visible: boolean) {
  root.render(
    createElement(LinkedWorkItemPanel, {
      target,
      cwd: "/tmp/web",
      recents: [],
      visible,
      onClose: () => {},
    }),
  );
}

describe("LinkedWorkItemPanel tab persistence", () => {
  it("keeps fetched data mounted while hidden and reuses it when shown again", async () => {
    await act(async () => render(true));
    await act(async () => {});

    expect(container.textContent).toContain("Keep the linked panel warm");
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenCalledWith("git_github_work_item_details", {
      cwd: "/tmp/web",
      repo: "acme/web",
      kind: "issue",
      number: 157,
    });
    expect(invoke).toHaveBeenCalledWith("git_github_work_item_thread", {
      cwd: "/tmp/web",
      repo: "acme/web",
      kind: "issue",
      number: 157,
    });

    await act(async () => render(false));
    expect(container.querySelector("aside")?.classList).toContain("hidden");
    expect(container.querySelector("aside")?.getAttribute("aria-hidden")).toBe(
      "true",
    );

    await act(async () => render(true));
    await act(async () => {});

    expect(container.querySelector("aside")?.classList).toContain("flex");
    expect(container.textContent).toContain("Keep the linked panel warm");
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});

describe("LinkedWorkItemPanel read state", () => {
  const key = "github:acme/web:issue:157";
  const updatedAt = "2026-09-16T08:00:00Z";

  beforeEach(() => {
    localStorage.clear();
  });

  function renderWithSession(visible: boolean) {
    root.render(
      createElement(LinkedWorkItemPanel, {
        target,
        cwd: "/tmp/web",
        recents: [],
        visible,
        sessionId: "session-1",
        onClose: () => {},
      }),
    );
  }

  it("marks the item and the owning session seen once the panel shows it", async () => {
    seedInboxSeenIfNeeded([
      { key, updatedAt: "2026-09-16T07:00:00Z" },
    ]);
    expect(isInboxEntryUnseen({ key, updatedAt })).toBe(true);

    await act(async () => renderWithSession(true));
    await act(async () => {});

    expect(isInboxEntryUnseen({ key, updatedAt })).toBe(false);
    expect(linkedSessionSeenAt("session-1")).toBe(Date.parse(updatedAt));
  });

  it("leaves read state alone while hidden", async () => {
    seedInboxSeenIfNeeded([
      { key, updatedAt: "2026-09-16T07:00:00Z" },
    ]);
    await act(async () => renderWithSession(false));
    await act(async () => {});

    expect(isInboxEntryUnseen({ key, updatedAt })).toBe(true);
  });
});
