// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Shimmer } from "./Shimmer";

let container: HTMLDivElement;
let root: Root;

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  stubMatchMedia(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.removeItem("monocode.experimentalAnimations");
  vi.unstubAllGlobals();
});

describe("Shimmer", () => {
  it("renders static text with animations off", () => {
    localStorage.setItem("monocode.experimentalAnimations", "0");
    act(() => root.render(createElement(Shimmer, { children: "Thinking" })));

    const el = container.querySelector("span");
    expect(el?.textContent).toBe("Thinking");
    expect(el?.className).not.toContain("shimmer-text");
  });

  it("renders static text under reduced motion", () => {
    localStorage.setItem("monocode.experimentalAnimations", "1");
    stubMatchMedia(true);
    act(() => root.render(createElement(Shimmer, { children: "Working" })));

    const el = container.querySelector("span");
    expect(el?.textContent).toBe("Working");
    expect(el?.className).not.toContain("shimmer-text");
  });

  it("shimmers with animations on and no reduced motion", () => {
    localStorage.setItem("monocode.experimentalAnimations", "1");
    stubMatchMedia(false);
    act(() => root.render(createElement(Shimmer, { children: "Live" })));

    expect(container.querySelector(".shimmer-text")?.textContent).toBe("Live");
  });
});
