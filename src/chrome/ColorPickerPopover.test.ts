// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPickerPopover } from "./ColorPickerPopover";

describe("ColorPickerPopover drag cleanup", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("removes every active drag listener on unmount mid-drag", async () => {
    const added: Array<{ type: string; fn: EventListener }> = [];
    const removed: EventListener[] = [];
    const rawAdd = window.addEventListener.bind(window);
    const rawRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(
      ((type: string, fn: EventListener, opts?: object) => {
        added.push({ type, fn });
        return rawAdd(type, fn as EventListener, opts);
      }) as typeof window.addEventListener,
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(
      ((type: string, fn: EventListener, opts?: object) => {
        removed.push(fn);
        return rawRemove(type, fn as EventListener, opts);
      }) as typeof window.removeEventListener,
    );
    await act(async () => {
      root.render(
        createElement(ColorPickerPopover, {
          value: "#ff0000",
          onChange: () => {},
        }),
      );
    });
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(2);
    const firePointerDown = (el: Element, pointerId: number) => {
      (el as HTMLElement).setPointerCapture = () => {};
      (el as HTMLElement).getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
      el.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId,
          clientX: 10,
          clientY: 10,
        }),
      );
    };
    act(() => {
      firePointerDown(sliders[0]!, 1);
      firePointerDown(sliders[1]!, 2);
    });
    const moves = added.filter((entry) => entry.type === "pointermove");
    expect(moves.length).toBe(2);
    await act(async () => root.unmount());
    for (const entry of moves) {
      expect(removed).toContain(entry.fn);
    }
  });

  it("restores persisted values on pointer cancel instead of committing", async () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    await act(async () => {
      root.render(
        createElement(ColorPickerPopover, {
          value: "#ff0000",
          onChange: () => {},
          onPreview,
          onCommit,
          onCancel,
        }),
      );
    });
    const hue = container.querySelector('[aria-label="Hue"]')!;
    (hue as HTMLElement).setPointerCapture = () => {};
    (hue as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 360, height: 12 }) as DOMRect;
    act(() => {
      hue.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          clientX: 10,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointercancel", { bubbles: true }),
      );
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    // The thumb rewinds to the persisted color instead of sticking at the
    // abandoned drag position (red is hue 0; the drag moved it to 10).
    expect(hue.getAttribute("aria-valuenow")).toBe("0");
  });

  it("does not cancel on unmount after a committed drag", async () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    await act(async () => {
      root.render(
        createElement(ColorPickerPopover, {
          value: "#ff0000",
          onChange: () => {},
          onCommit,
          onCancel,
        }),
      );
    });
    const hue = container.querySelector('[aria-label="Hue"]')!;
    (hue as HTMLElement).setPointerCapture = () => {};
    (hue as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 360, height: 12 }) as DOMRect;
    act(() => {
      hue.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          clientX: 10,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    // The committed drag detached its cleanup: no stale cancel reverts it.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("restores persisted values when dismissed with a preview pending", async () => {
    const onCancel = vi.fn();
    await act(async () => {
      root.render(
        createElement(ColorPickerPopover, {
          value: "#ff0000",
          onChange: () => {},
          onCancel,
        }),
      );
    });
    const hue = container.querySelector('[aria-label="Hue"]')!;
    (hue as HTMLElement).setPointerCapture = () => {};
    (hue as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 360, height: 12 }) as DOMRect;
    act(() => {
      hue.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          clientX: 10,
        }),
      );
    });
    await act(async () => root.unmount());
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
