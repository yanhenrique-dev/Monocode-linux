import { describe, expect, it } from "vitest";
import type { FilePaneTab, WorkspaceTab } from "../lib/layout";
import { hasDirtyFileUnderPath } from "./useProjects";

function file(id: string, path: string): FilePaneTab {
  return { id, path, cwd: "/repo" };
}

function tab(files: FilePaneTab[]): WorkspaceTab {
  return {
    kind: "session",
    id: "tab-1",
    layout: { type: "leaf", id: "session-1" },
    focusedId: "session-1",
    editorPanes: [
      { id: "pane-1", files, activeFileId: files[0]?.id ?? "" },
    ],
    terminalPanes: [],
  };
}

describe("hasDirtyFileUnderPath", () => {
  it("matches an open dirty file and its parent directory", () => {
    const workspace = tab([file("file-1", "/repo/src/app.ts")]);

    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-1"]), "/repo/src/app.ts"),
    ).toBe(true);
    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-1"]), "/repo/src"),
    ).toBe(true);
  });

  it("ignores clean files and sibling path prefixes", () => {
    const workspace = tab([file("file-1", "/repo/src/app.ts")]);

    expect(hasDirtyFileUnderPath([workspace], new Set(), "/repo/src")).toBe(false);
    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-1"]), "/repo/src-2"),
    ).toBe(false);
  });

  it("matches dirty files open in terminal panes", () => {
    const workspace = tab([file("file-1", "/repo/src/app.ts")]);
    workspace.terminalPanes = [
      { id: "term-1", files: [file("file-2", "/repo/src/term.ts")], activeFileId: "file-2" },
    ];

    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-2"]), "/repo/src"),
    ).toBe(true);
    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-2"]), "/repo/other"),
    ).toBe(false);
  });

  it("tolerates tabs without terminal panes", () => {
    const workspace = tab([file("file-1", "/repo/src/app.ts")]);
    delete (workspace as Partial<WorkspaceTab>).terminalPanes;

    expect(
      hasDirtyFileUnderPath([workspace], new Set(["file-1"]), "/repo/src"),
    ).toBe(true);
  });
});
