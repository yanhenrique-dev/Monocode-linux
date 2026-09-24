// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Popover } from "./Popover";
import { toBaseAnchor } from "./popoverAnchor";

function renderPopover(
  root: Root,
  container: HTMLElement,
  onDismiss: (reason: string) => void,
) {
  return act(async () => {
    root.render(
      createElement(
        Popover,
        {
          anchor: { x: 100, y: 100 },
          onDismiss,
          children: "menu",
        } as never,
      ),
    );
  });
}

describe("virtual anchors", () => {
  it("preserves bare point coordinates", () => {
    const resolved = toBaseAnchor({ x: 420, y: 260 });
    if (!resolved) throw new Error("anchor was not resolved");

    const rect = resolved.getBoundingClientRect();
    expect(rect.x).toBe(420);
    expect(rect.y).toBe(260);
    expect(rect.left).toBe(420);
    expect(rect.top).toBe(260);
  });

  it("preserves rect coordinates and dimensions", () => {
    const resolved = toBaseAnchor(new DOMRect(420, 260, 80, 24));
    if (!resolved) throw new Error("anchor was not resolved");

    const rect = resolved.getBoundingClientRect();
    expect(rect.x).toBe(420);
    expect(rect.y).toBe(260);
    expect(rect.width).toBe(80);
    expect(rect.height).toBe(24);
  });

  it("keeps x and y when rect dimensions are negative", () => {
    const source = {
      x: 420,
      y: 260,
      width: -80,
      height: -24,
      left: 340,
      top: 236,
      right: 420,
      bottom: 260,
    } as DOMRect;
    const resolved = toBaseAnchor(source);
    if (!resolved) throw new Error("anchor was not resolved");

    const rect = resolved.getBoundingClientRect();
    expect(rect.x).toBe(420);
    expect(rect.y).toBe(260);
    expect(rect.width).toBe(-80);
    expect(rect.height).toBe(-24);
  });
});

describe("Popover exit animation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    localStorage.setItem("monocode.experimentalAnimations", "1");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    localStorage.removeItem("monocode.experimentalAnimations");
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays the closing class before dismissing on Escape", async () => {
    const onDismiss = vi.fn();
    await renderPopover(root, container, onDismiss);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    const closing = document.body.querySelector(".popover-closing");
    expect(closing).not.toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      closing!.dispatchEvent(
        new AnimationEvent("animationend", { bubbles: true }),
      );
    });
    expect(onDismiss).toHaveBeenCalledWith("escape");
  });

  it("dismisses immediately with animations off", async () => {
    localStorage.setItem("monocode.experimentalAnimations", "0");
    const onDismiss = vi.fn();
    await renderPopover(root, container, onDismiss);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onDismiss).toHaveBeenCalledWith("escape");
    expect(document.body.querySelector(".popover-closing")).toBeNull();
  });
});
