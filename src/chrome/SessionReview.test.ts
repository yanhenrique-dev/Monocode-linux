// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckpointFile } from "../lib/checkpoint";
import { sessionCheckpointStatus } from "../lib/checkpoint";
import { SessionReview } from "./SessionReview";

vi.mock("../lib/checkpoint", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../lib/checkpoint")>();
  const own: CheckpointFile = {
    path: "/repo/own.ts",
    relative: "own.ts",
    status: "modified",
    additions: 2,
    deletions: 1,
    exact: true,
    undoable: true,
    foreignClaimants: [],
  };
  const shared: CheckpointFile = {
    path: "/repo/shared.ts",
    relative: "shared.ts",
    status: "modified",
    additions: 5,
    deletions: 0,
    exact: true,
    undoable: false,
    foreignClaimants: ["session-two-id"],
  };
  return {
    ...original,
    sessionCheckpointStatus: vi.fn(async () => ({ files: [shared, own] })),
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SessionReview ownership grouping", () => {
  it("sorts session-owned files first and labels foreign claims", async () => {
    await act(async () => {
      root.render(
        createElement(SessionReview, {
          sessionId: "s1",
          cwd: "/repo",
          onOpenDiff: () => {},
        }),
      );
    });

    const rows = [...container.querySelectorAll("ul li button")].map(
      (button) => button.textContent ?? "",
    );
    expect(rows).toHaveLength(2);
    // Own file first even though the backend returned it second.
    expect(rows[0]).toContain("own.ts");
    expect(rows[1]).toContain("shared.ts");
    // Shared row names the claimant session (truncated to 8 chars).
    expect(rows[1]).toContain("session-");
    expect(
      container.textContent ?? "",
    ).toContain("Shared with another session");
  });

  it("keeps the animated frame mounted and folds it with data-open", async () => {
    vi.mocked(sessionCheckpointStatus).mockResolvedValueOnce({ files: [] });
    await act(async () => {
      root.render(
        createElement(SessionReview, {
          sessionId: "s1",
          cwd: "/repo",
          animationsEnabled: true,
          onOpenDiff: () => {},
        }),
      );
    });
    const frame = container.querySelector("[data-review-fold]")!;
    expect(frame.getAttribute("data-open")).toBe("false");
    expect(frame.hasAttribute("inert")).toBe(true);
    // The fold keeps the last card mounted for the exit transition; with
    // no files it renders no rows.
    expect(container.querySelectorAll("ul li button")).toHaveLength(0);
  });

  it("opens the animated frame without inert when files land", async () => {
    await act(async () => {
      root.render(
        createElement(SessionReview, {
          sessionId: "s1",
          cwd: "/repo",
          animationsEnabled: true,
          onOpenDiff: () => {},
        }),
      );
    });
    const frame = container.querySelector("[data-review-fold]")!;
    expect(frame.getAttribute("data-open")).toBe("true");
    expect(frame.hasAttribute("inert")).toBe(false);
    expect(
      container.querySelector("[data-session-review]"),
    ).not.toBeNull();
  });
});
