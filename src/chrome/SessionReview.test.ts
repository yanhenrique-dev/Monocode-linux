// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckpointFile } from "../lib/checkpoint";
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
    adopted: false,
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
    adopted: false,
    undoable: false,
    foreignClaimants: ["session-two-id"],
  };
  const adopted: CheckpointFile = {
    path: "/repo/shell.ts",
    relative: "shell.ts",
    status: "modified",
    additions: 1,
    deletions: 1,
    exact: false,
    adopted: true,
    undoable: false,
    foreignClaimants: [],
  };
  const diverged: CheckpointFile = {
    path: "/repo/fmt.ts",
    relative: "fmt.ts",
    status: "modified",
    additions: 4,
    deletions: 2,
    exact: false,
    adopted: false,
    undoable: false,
    foreignClaimants: [],
  };
  return {
    ...original,
    sessionCheckpointStatus: vi.fn(async () => ({
      files: [shared, own, adopted, diverged],
    })),
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
    expect(rows).toHaveLength(3);
    // Own file first even though the backend returned it second; the
    // shared row stays behind "Show 1 more file".
    expect(rows[0]).toContain("own.ts");
    expect(rows[1]).toContain("shell.ts");
    expect(rows[2]).toContain("fmt.ts");
    expect(
      container.textContent ?? "",
    ).toContain("Show 1 more file");
  });

  it("labels adopted and diverged files with their own reason", async () => {
    await act(async () => {
      root.render(
        createElement(SessionReview, {
          sessionId: "s1",
          cwd: "/repo",
          onOpenDiff: () => {},
        }),
      );
    });

    // Only the first 3 rows show; the inexact rows sort with own files.
    const text = container.textContent ?? "";
    expect(text).toContain("Shell changes");
    expect(text).toContain("Changed outside session");
    expect(text).not.toContain("Mixed changes");
  });

  it("sorts shared files last under their own heading", async () => {
    await act(async () => {
      root.render(
        createElement(SessionReview, {
          sessionId: "s1",
          cwd: "/repo",
          onOpenDiff: () => {},
        }),
      );
    });
    const more = [...container.querySelectorAll("button")].find((button) =>
      (button.textContent ?? "").startsWith("Show 1 more"),
    );
    expect(more).toBeDefined();
    await act(async () => {
      more!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    const rows = [...container.querySelectorAll("ul li button")].map(
      (button) => button.textContent ?? "",
    );
    expect(rows).toHaveLength(4);
    expect(rows[3]).toContain("shared.ts");
    // Shared row names the claimant session (truncated to 8 chars).
    expect(rows[3]).toContain("session-");
    expect(
      container.textContent ?? "",
    ).toContain("Shared with another session");
  });
});
