// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRoot,
} from "./combobox";

describe("Combobox", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("filters items by typed text and picks on click", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      const items = [
        { value: "codex", label: "Codex" },
        { value: "claude", label: "Claude" },
      ];
      const onValueChange = vi.fn();
      await act(async () => {
        root.render(
          createElement(
            ComboboxRoot,
            { items, onValueChange } as never,
            createElement(ComboboxInput, {
              "aria-label": "Pick a model",
            } as never),
            createElement(
              ComboboxPortal,
              null,
              createElement(
                ComboboxPositioner,
                null,
                createElement(ComboboxEmpty, null, "No matches"),
                createElement(
                  ComboboxCollection,
                  {
                    children: (item: { value: string; label: string }) =>
                      createElement(
                        ComboboxItem,
                        { key: item.value, value: item.value },
                        item.label,
                      ),
                  } as never,
                ),
              ),
            ),
          ),
        );
      });
      const input = container.querySelector("input") as HTMLInputElement;
      act(() => input.focus());
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      await act(async () => {
        setValue.call(input, "clau");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      for (let i = 0; i < 4; i++)
        await act(async () => new Promise((r) => setTimeout(r, 10)));
      const options = [...document.querySelectorAll('[role="option"]')];
      expect(options.map((o) => o.textContent)).toEqual(["Claude"]);
      act(() => {
        options[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe("claude");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
