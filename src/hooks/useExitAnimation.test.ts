// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitAnimation } from "./useExitAnimation";

function Probe({
  api,
  enabled,
  durationMs,
  onExit,
}: {
  api: { current: ReturnType<typeof useExitAnimation> | null };
  enabled?: boolean;
  durationMs?: number;
  onExit: () => void;
}) {
  const hook = useExitAnimation({ enabled, durationMs, onExit });
  useEffect(() => {
    api.current = hook;
  });
  return createElement("div", {
    "data-closing": hook.closing ? "true" : "false",
    onAnimationEnd: hook.handleAnimationEnd,
  });
}

describe("useExitAnimation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderProbe(
    api: { current: ReturnType<typeof useExitAnimation> | null },
    props: { enabled?: boolean; durationMs?: number; onExit: () => void },
  ) {
    await act(async () => {
      root.render(createElement(Probe, { api, ...props }));
    });
  }

  it("closes immediately when disabled", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: false, onExit });
    act(() => api.current!.requestClose());
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(container.querySelector("div")?.dataset.closing).toBe("false");
  });

  it("sets closing first and exits on animationend", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, durationMs: 200, onExit });
    act(() => api.current!.requestClose());
    expect(onExit).not.toHaveBeenCalled();
    expect(container.querySelector("div")?.dataset.closing).toBe("true");

    const surface = container.querySelector("div")!;
    act(() => {
      surface.dispatchEvent(new AnimationEvent("animationend", { bubbles: true }));
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ignores animationend bubbling from nested children", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, durationMs: 200, onExit });
    act(() => api.current!.requestClose());

    const surface = container.querySelector("div")!;
    const child = document.createElement("span");
    surface.append(child);
    const event = new AnimationEvent("animationend", { bubbles: true });
    act(() => {
      child.dispatchEvent(event);
    });
    expect(onExit).not.toHaveBeenCalled();
  });

  it("falls back to a timeout when animationend never fires", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, durationMs: 200, onExit });
    act(() => api.current!.requestClose());
    expect(onExit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("matches the 150ms CSS exit token by default", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, onExit });
    act(() => api.current!.requestClose());
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(onExit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("exits exactly once on re-entrant closes", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, durationMs: 200, onExit });
    act(() => {
      api.current!.requestClose();
      api.current!.requestClose();
    });
    const surface = container.querySelector("div")!;
    act(() => {
      surface.dispatchEvent(new AnimationEvent("animationend", { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("cancelClose re-arms a later close", async () => {
    const onExit = vi.fn();
    const api: { current: ReturnType<typeof useExitAnimation> | null } = {
      current: null,
    };
    await renderProbe(api, { enabled: true, durationMs: 200, onExit });
    act(() => api.current!.requestClose());
    act(() => api.current!.cancelClose());
    expect(container.querySelector("div")?.dataset.closing).toBe("false");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onExit).not.toHaveBeenCalled();
    act(() => api.current!.requestClose());
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
