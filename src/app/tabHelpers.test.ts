import { describe, expect, it } from "vitest";
import {
  leaf,
  leafIds,
  splitPane,
  type FilePaneTab,
  type WorkspaceTab,
} from "../lib/layout";
import { dropOpenFiles, rebaseOpenFiles } from "./tabHelpers";

function file(id: string, path: string, terminal = false): FilePaneTab {
  return { id, path, cwd: "/repo", ...(terminal ? { terminal: true } : {}) };
}

function workspace(editorFile: FilePaneTab, terminalFile: FilePaneTab): WorkspaceTab {
  const editorPane = {
    id: "editor-pane",
    files: [editorFile],
    activeFileId: editorFile.id,
  };
  const terminalPane = {
    id: "terminal-pane",
    files: [terminalFile],
    activeFileId: terminalFile.id,
  };
  const withEditor = splitPane(leaf("session"), "session", "right", editorPane.id);
  return {
    kind: "session",
    id: "tab",
    layout: splitPane(withEditor, editorPane.id, "right", terminalPane.id),
    focusedId: terminalPane.id,
    editorPanes: [editorPane],
    terminalPanes: [terminalPane],
  };
}

describe("workspace file path updates", () => {
  it("rebases filesystem files in editor and terminal panes", () => {
    const editorFile = file("editor-file", "/repo/src/editor.ts");
    const terminalFile = file("terminal-file", "/repo/src/restored.ts");
    const moved = rebaseOpenFiles(
      workspace(editorFile, terminalFile),
      "/repo/src",
      "/repo/renamed",
    );

    expect(moved.editorPanes[0]?.files[0]?.path).toBe(
      "/repo/renamed/editor.ts",
    );
    expect(moved.terminalPanes[0]?.files[0]?.path).toBe(
      "/repo/renamed/restored.ts",
    );
  });

  it("removes matching filesystem files from both pane collections", () => {
    const editorFile = file("editor-file", "/repo/src/editor.ts");
    const terminalFile = file("terminal-file", "/repo/src/restored.ts");
    const dropped = dropOpenFiles(
      workspace(editorFile, terminalFile),
      (path) => path.startsWith("/repo/src/"),
    );

    expect(dropped.editorPanes).toEqual([]);
    expect(dropped.terminalPanes).toEqual([]);
    expect(leafIds(dropped.layout)).toEqual(["session"]);
  });

  it("keeps terminal files when dropping filesystem paths", () => {
    const editorFile = file("editor-file", "/repo/src/editor.ts");
    const terminalFile = file("terminal-file", "/repo/src/terminal", true);
    const dropped = dropOpenFiles(
      workspace(editorFile, terminalFile),
      (path) => path === "/repo/src/terminal",
    );

    expect(dropped.editorPanes[0]?.files).toEqual([editorFile]);
    expect(dropped.terminalPanes[0]?.files).toEqual([terminalFile]);
  });
});
