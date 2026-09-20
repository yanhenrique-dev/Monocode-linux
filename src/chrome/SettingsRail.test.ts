// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsNav } from "./SettingsRail";

let container: HTMLDivElement;
let root: Root;

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
});

describe("SettingsNav icons", () => {
  it("renders icons at the row color without a transparency cut", async () => {
    await act(async () =>
      root.render(
        createElement(SettingsNav, {
          section: "general",
          onSelect: () => {},
          onClose: () => {},
        }),
      ),
    );
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.classList.contains("opacity-70")).toBe(false);
    }
  });
});
