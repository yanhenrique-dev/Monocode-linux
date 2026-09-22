// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/githubTasks", async (original) => ({
  ...(await original<typeof import("../lib/githubTasks")>()),
  githubPrChecks: vi.fn(),
  githubPrMergeInfo: vi.fn(),
}));

import {
  githubPrChecks,
  githubPrMergeInfo,
  type GithubPrCheck,
} from "../lib/githubTasks";
import { GithubPrChecks } from "./InboxPrChecks";

function check(overrides: Partial<GithubPrCheck> & { name: string }): GithubPrCheck {
  return {
    status: "COMPLETED",
    conclusion: "SUCCESS",
    url: "",
    startedAt: "",
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function renderChecks(revision = 0) {
  act(() =>
    root.render(
      createElement(GithubPrChecks, {
        projectPath: "/tmp/web",
        repo: "acme/web",
        number: 130,
        revision,
      }),
    ),
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(githubPrChecks).mockReset();
  vi.mocked(githubPrMergeInfo).mockReset();
  vi.mocked(githubPrMergeInfo).mockResolvedValue({});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("GithubPrChecks", () => {
  it("groups running and successful checks like github.com", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "PENDING",
      checks: [
        check({ name: "CodeRabbit", startedAt: "2026-09-22T09:00:00Z" }),
        check({
          name: "CI / check (pull_request)",
          status: "IN_PROGRESS",
          conclusion: undefined,
          startedAt: "2026-09-22T10:00:00Z",
        }),
      ],
    });
    renderChecks();
    await flush();

    expect(container.textContent).toContain("In progress checks");
    expect(container.textContent).toContain("CI / check (pull_request)");
    expect(container.textContent).toContain("Successful checks");
    expect(container.textContent).toContain("CodeRabbit");
    expect(
      container.querySelector('[aria-label="Loading"]'),
    ).not.toBeNull();
  });

  it("shows failed checks and the merge conflicts note", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "FAILURE",
      checks: [
        check({
          name: "legacy-lint",
          status: "COMPLETED",
          conclusion: "FAILURE",
        }),
      ],
    });
    vi.mocked(githubPrMergeInfo).mockResolvedValue({ mergeable: "CONFLICTING" });
    renderChecks();
    await flush();

    expect(container.textContent).toContain("Failed checks");
    expect(container.textContent).toContain("legacy-lint");
    expect(container.textContent).toContain(
      "This pull request has merge conflicts",
    );
  });

  it("shows the no-conflicts note for a clean merge state", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "SUCCESS",
      checks: [check({ name: "CodeRabbit" })],
    });
    vi.mocked(githubPrMergeInfo).mockResolvedValue({
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
    });
    renderChecks();
    await flush();

    expect(container.textContent).toContain("No conflicts with base branch");
  });

  it("prioritizes blocked over no-conflicts", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "PENDING",
      checks: [],
    });
    vi.mocked(githubPrMergeInfo).mockResolvedValue({
      mergeable: "MERGEABLE",
      mergeStateStatus: "BLOCKED",
    });
    renderChecks();
    await flush();

    expect(container.textContent).toContain("Merging is blocked");
    expect(container.textContent).not.toContain("No conflicts");
  });

  it("forces a reload when revision changes", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "UNKNOWN",
      checks: [],
    });
    renderChecks();
    await flush();
    expect(vi.mocked(githubPrChecks)).toHaveBeenCalledWith(
      "/tmp/web",
      "acme/web",
      130,
      undefined,
    );

    renderChecks(1);
    await flush();
    expect(vi.mocked(githubPrChecks)).toHaveBeenCalledWith(
      "/tmp/web",
      "acme/web",
      130,
      { force: true },
    );
    expect(vi.mocked(githubPrMergeInfo)).toHaveBeenCalledWith(
      "/tmp/web",
      "acme/web",
      130,
      { force: true },
    );
  });

  it("reports an empty state when nothing is known", async () => {
    vi.mocked(githubPrChecks).mockResolvedValue({
      state: "UNKNOWN",
      checks: [],
    });
    renderChecks();
    await flush();

    expect(container.textContent).toContain("No checks reported");
  });
});
