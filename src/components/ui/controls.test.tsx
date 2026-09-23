// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toggle } from "../../surfaces/settings/SettingsControls";
import { Input } from "./input";
import { Slider, SliderIndicator, SliderThumb, SliderTrack } from "./slider";
import { Switch, SwitchThumb } from "./switch";

function setup(node: React.ReactElement) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { container, root };
}

function teardown(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
}

describe("Switch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("toggles checked state and keeps token styling", () => {
    const onCheckedChange = vi.fn();
    const { root, container } = setup(
      createElement(
        Switch,
        { "aria-label": "Glass", onCheckedChange } as never,
        createElement(SwitchThumb, null),
      ),
    );
    try {
      const track = container.querySelector('[role="switch"]') as HTMLElement;
      expect(track.getAttribute("aria-checked")).toBe("false");
      expect(track.hasAttribute("data-unchecked")).toBe(true);
      act(() => track.click());
      expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    } finally {
      teardown(root, container);
    }
  });

  it("Toggle keeps its label/onChange contract with the cue", () => {
    const onChange = vi.fn();
    const { root, container } = setup(
      createElement(Toggle, { label: "Blur", on: true, onChange }),
    );
    try {
      const track = container.querySelector(
        '[role="switch"][aria-label="Blur"]',
      ) as HTMLElement;
      expect(track.getAttribute("aria-checked")).toBe("true");
      act(() => track.click());
      expect(onChange).toHaveBeenCalledWith(false);
    } finally {
      teardown(root, container);
    }
  });
});

describe("Slider", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders the slider parts with value bounds", () => {
    const { root, container } = setup(
      createElement(
        Slider,
        { defaultValue: 50, min: 0, max: 100, "aria-label": "Opacity" } as never,
        createElement(SliderTrack, null, createElement(SliderIndicator, null)),
        createElement(SliderThumb, null),
      ),
    );
    try {
      // Base renders a native range input inside the thumb: the value
      // semantics stay on a real form control.
      const input = container.querySelector(
        'input[type="range"]',
      ) as HTMLInputElement;
      expect(input.value).toBe("50");
      expect(input.min).toBe("0");
      expect(input.max).toBe("100");
      expect(input.getAttribute("aria-valuenow")).toBe("50");
    } finally {
      teardown(root, container);
    }
  });
});

describe("Input", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("stays a native text input with token border", () => {
    const { root, container } = setup(
      createElement(Input, {
        "aria-label": "Search settings",
        placeholder: "Search",
      }),
    );
    try {
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("text");
      expect(input.placeholder).toBe("Search");
      act(() => input.focus());
      expect(document.activeElement).toBe(input);
    } finally {
      teardown(root, container);
    }
  });
});
