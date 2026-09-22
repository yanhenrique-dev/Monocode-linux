// @vitest-environment happy-dom
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearInboxCache,
  GITHUB_CHANGE_EVENT,
  invalidateGithubItemCaches,
  listInboxItems,
  peekGithubWorkItemThread,
  type GithubWorkItem,
} from "./githubTasks";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function workItem(overrides: Partial<GithubWorkItem> & { number: number }): GithubWorkItem {
  return {
    kind: "issue",
    title: "Item",
    url: "https://github.com/acme/web/issues/1",
    state: "open",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
    labels: [],
    assignees: [],
    repo: "acme/web",
    ...overrides,
  } as GithubWorkItem;
}

const projects = [{ path: "/tmp/web" }];
const openQuery = {
  assignedToMe: false,
  state: "open" as const,
  search: "",
};
const allQuery = { ...openQuery, state: "all" as const };

function mockBackend() {
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    switch (command) {
      case "git_github_repositories":
        return ["acme/web"] as never;
      case "git_github_work_items": {
        const { kind, updatedSince } = args as {
          kind: string;
          updatedSince?: string;
        };
        if (updatedSince) {
          return (
            kind === "pr"
              ? [
                  workItem({
                    number: 9,
                    kind: "pr",
                    url: "https://github.com/acme/web/pull/9",
                    updatedAt: "2026-09-12T00:00:00Z",
                  }),
                ]
              : []
          ) as never;
        }
        return (
          kind === "issue"
            ? [workItem({ number: 1 })]
            : [workItem({ number: 2, kind: "pr", url: "https://github.com/acme/web/pull/2" })]
        ) as never;
      }
      case "linear_status":
        return { connected: false } as never;
      case "gitlab_connected":
      case "gitlab_status":
        return { connected: false } as never;
      default:
        throw new Error(`unexpected invoke: ${command}`);
    }
  });
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  clearInboxCache();
  localStorage.clear();
});

describe("per-query list cache", () => {
  it("keeps filter variants without refetching", async () => {
    mockBackend();
    const open = await listInboxItems(projects, openQuery);
    expect(open.items).toHaveLength(2);
    const callsAfterOpen = vi.mocked(invoke).mock.calls.length;

    const all = await listInboxItems(projects, allQuery);
    expect(all.items).toHaveLength(2);
    expect(vi.mocked(invoke).mock.calls.length).toBeGreaterThan(callsAfterOpen);

    // Both snapshots stay cached: no further backend calls.
    await listInboxItems(projects, openQuery);
    await listInboxItems(projects, allQuery);
    expect(vi.mocked(invoke).mock.calls.length).toBeGreaterThan(callsAfterOpen);
    const before = vi.mocked(invoke).mock.calls.length;
    await listInboxItems(projects, openQuery);
    await listInboxItems(projects, allQuery);
    expect(vi.mocked(invoke).mock.calls.length).toBe(before);
  });

  it("merges incremental deltas into the snapshot", async () => {
    mockBackend();
    const full = await listInboxItems(projects, openQuery);
    expect(full.items.map((item) => item.number).sort()).toEqual([1, 2]);

    const merged = await listInboxItems(projects, openQuery, {
      since: "2026-09-11T00:00:00Z",
    });
    expect(merged.items.map((item) => item.number).sort()).toEqual([1, 2, 9]);
  });

  it("evicts everything missing from an empty delta", async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      switch (command) {
        case "git_github_repositories":
          return ["acme/web"] as never;
        case "git_github_work_items": {
          const { kind, updatedSince } = args as {
            kind: string;
            updatedSince?: string;
          };
          if (updatedSince) return [] as never;
          return (
            kind === "issue"
              ? [
                  workItem({
                    number: 1,
                    updatedAt: "2026-09-12T00:00:00Z",
                  }),
                ]
              : [
                  workItem({
                    number: 2,
                    kind: "pr",
                    url: "https://github.com/acme/web/pull/2",
                    updatedAt: "2026-09-12T00:00:00Z",
                  }),
                ]
          ) as never;
        }
        case "linear_status":
          return { connected: false } as never;
        case "gitlab_connected":
        case "gitlab_status":
          return { connected: false } as never;
        default:
          throw new Error(`unexpected invoke: ${command}`);
      }
    });
    const full = await listInboxItems(projects, openQuery);
    expect(full.items.map((item) => item.number).sort()).toEqual([1, 2]);

    const merged = await listInboxItems(projects, openQuery, {
      since: "2026-09-11T00:00:00Z",
    });
    expect(merged.items).toEqual([]);
  });

  it("retries checks after a transient failure instead of caching UNKNOWN", async () => {
    const { githubPrChecks } = await import("./githubTasks");
    let calls = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "git_github_pr_checks") {
        calls += 1;
        if (calls === 1) throw new Error("offline");
        return { state: "SUCCESS", checks: [] } as never;
      }
      throw new Error(`unexpected invoke: ${command}`);
    });
    const first = await githubPrChecks("/tmp/web", "acme/retry", 77);
    expect(first).toEqual({ state: "UNKNOWN", checks: [] });
    const second = await githubPrChecks("/tmp/web", "acme/retry", 77);
    expect(second).toEqual({ state: "SUCCESS", checks: [] });
    expect(calls).toBe(2);
  });

  it("evicts window-fresh items missing from the delta, keeps idle ones", async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      switch (command) {
        case "git_github_repositories":
          return ["acme/web"] as never;
        case "git_github_work_items": {
          const { kind, updatedSince } = args as {
            kind: string;
            updatedSince?: string;
          };
          if (updatedSince) {
            return (
              kind === "pr"
                ? [
                    workItem({
                      number: 9,
                      kind: "pr",
                      url: "https://github.com/acme/web/pull/9",
                      updatedAt: "2026-09-12T00:00:00Z",
                    }),
                    workItem({
                      number: 2,
                      kind: "pr",
                      title: "PR2 updated",
                      url: "https://github.com/acme/web/pull/2",
                      updatedAt: "2026-09-12T01:00:00Z",
                    }),
                  ]
                : []
            ) as never;
          }
          return (
            kind === "issue"
              ? [workItem({ number: 1 })]
              : [
                  workItem({
                    number: 2,
                    kind: "pr",
                    url: "https://github.com/acme/web/pull/2",
                  }),
                  // Fresh within the since window but absent from the delta:
                  // closed on github.com, must leave the snapshot.
                  workItem({
                    number: 5,
                    kind: "pr",
                    url: "https://github.com/acme/web/pull/5",
                    updatedAt: "2026-09-12T00:00:00Z",
                  }),
                ]
          ) as never;
        }
        case "linear_status":
          return { connected: false } as never;
        case "gitlab_connected":
        case "gitlab_status":
          return { connected: false } as never;
        default:
          throw new Error(`unexpected invoke: ${command}`);
      }
    });
    const full = await listInboxItems(projects, openQuery);
    expect(full.items.map((item) => item.number).sort()).toEqual([1, 2, 5]);

    const merged = await listInboxItems(projects, openQuery, {
      since: "2026-09-11T00:00:00Z",
    });
    expect(merged.items.map((item) => item.number).sort()).toEqual([1, 2, 9]);
    expect(
      merged.items.find((item) => item.number === 2)?.title,
    ).toBe("PR2 updated");
  });
});

describe("invalidateGithubItemCaches", () => {
  it("clears list snapshots so the next read refetches", async () => {
    mockBackend();
    await listInboxItems(projects, openQuery);
    const before = vi.mocked(invoke).mock.calls.length;
    invalidateGithubItemCaches("acme/web", "issue", 1);
    await listInboxItems(projects, openQuery);
    expect(vi.mocked(invoke).mock.calls.length).toBeGreaterThan(before);
  });

  it("notifies listeners through GITHUB_CHANGE_EVENT", async () => {
    mockBackend();
    const seen: string[] = [];
    const onChange = () => seen.push("changed");
    window.addEventListener(GITHUB_CHANGE_EVENT, onChange);
    try {
      const { notifyGithubChanged } = await import("./githubTasks");
      notifyGithubChanged();
      expect(seen).toEqual(["changed"]);
    } finally {
      window.removeEventListener(GITHUB_CHANGE_EVENT, onChange);
    }
  });

  it("drops cached thread reads", () => {
    expect(peekGithubWorkItemThread("acme/web", "issue", 7)).toBeNull();
    invalidateGithubItemCaches("acme/web", "issue", 7);
    expect(peekGithubWorkItemThread("acme/web", "issue", 7)).toBeNull();
  });
});
