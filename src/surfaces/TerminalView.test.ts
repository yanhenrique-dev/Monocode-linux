// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    options: Record<string, unknown>;
    cols = 80;
    rows = 24;
    element: null = null;
    buffer = {
      active: { type: "normal" },
      onBufferChange: () => ({ dispose() {} }),
    };
    parser = { registerOscHandler: () => ({ dispose() {} }) };
    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
    }
    open() {}
    focus() {}
    write() {}
    writeln() {}
    resize(cols: number, rows: number) {
      this.cols = cols;
      this.rows = rows;
    }
    onData() {
      return { dispose() {} };
    }
    onRender() {
      return { dispose() {} };
    }
    attachCustomKeyEventHandler() {}
    attachCustomWheelEventHandler() {}
    dispose() {}
  },
}));

import { TerminalView } from "./TerminalView";

function calls(command: string) {
  return invoke.mock.calls.filter(([name]) => name === command);
}

describe("TerminalView pty lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    invoke.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("leaves exactly one live pty after the StrictMode remount cycle", async () => {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(TerminalView, {
            id: "t1",
            cwd: "/tmp",
            active: true,
          }),
        ),
      );
    });
    // StrictMode mounts, cleans up, and mounts again: two spawns, one kill.
    const spawns = calls("pty_spawn");
    const kills = calls("pty_kill");
    expect(spawns).toHaveLength(2);
    expect(kills).toHaveLength(1);
    expect(spawns[0]?.[1]).toMatchObject({
      generation: expect.any(String),
    });
    expect(spawns[1]?.[1]).toMatchObject({
      generation: expect.any(String),
    });
    expect(spawns[0]?.[1].generation).not.toBe(spawns[1]?.[1].generation);
    expect(kills[0]?.[1]).toMatchObject({
      id: "t1",
      generation: spawns[0]?.[1].generation,
    });
  });

  it("kills the pty on unmount", async () => {
    await act(async () => {
      root.render(
        createElement(TerminalView, { id: "t2", cwd: "/tmp", active: true }),
      );
    });
    expect(calls("pty_spawn")).toHaveLength(1);
    await act(async () => {
      root.unmount();
    });
    expect(calls("pty_kill")).toHaveLength(1);
  });
});
