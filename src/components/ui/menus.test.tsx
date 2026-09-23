// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPositioner,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPositioner,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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

describe("DropdownMenu", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("opens from the trigger and picks an item", async () => {
    const onPick = vi.fn();
    const { root, container } = setup(
      createElement(
        DropdownMenu,
        null,
        createElement(DropdownMenuTrigger, null, "Open"),
        createElement(
          DropdownMenuPortal,
          null,
          createElement(
            DropdownMenuPositioner,
            null,
            createElement(
              DropdownMenuItem,
              { onClick: onPick },
              "Rename",
            ),
            createElement(DropdownMenuSeparator, null),
            createElement(DropdownMenuItem, null, "Delete"),
          ),
        ),
      ),
    );
    try {
      expect(document.querySelector('[role="menu"]')).toBeNull();
      const trigger = container.querySelector("button")!;
      act(() => trigger.click());
      await act(async () => {});
      const menu = document.querySelector('[role="menu"]');
      expect(menu).not.toBeNull();
      expect(menu?.textContent).toContain("Rename");
      const item = [...menu!.querySelectorAll('[role="menuitem"]')].find(
        (el) => el.textContent === "Rename",
      ) as HTMLElement;
      act(() => item.click());
      expect(onPick).toHaveBeenCalledTimes(1);
      // Base UI plays the exit transition before unmounting (no CSS in
      // happy-dom, so it rests in the closed state instead of detaching).
      const popup = document.querySelector('[role="menu"]');
      expect(
        popup === null || popup.hasAttribute("data-closed"),
      ).toBe(true);
    } finally {
      teardown(root, container);
    }
  });
});

describe("ContextMenu", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders items with the menu frame", async () => {
    const { root, container } = setup(
      createElement(
        ContextMenu,
        null,
        createElement(
          ContextMenuTrigger,
          null,
          createElement("span", null, "Area"),
        ),
        createElement(
          ContextMenuPortal,
          null,
          createElement(
            ContextMenuPositioner,
            null,
            createElement(ContextMenuItem, null, "Copy"),
            createElement(ContextMenuSeparator, null),
          ),
        ),
      ),
    );
    try {
      const trigger = container.querySelector("span")!;
      act(() => {
        trigger.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }),
        );
      });
      await act(async () => {});
      const menu = document.querySelector('[role="menu"]');
      expect(menu).not.toBeNull();
      expect(menu?.textContent).toContain("Copy");
    } finally {
      teardown(root, container);
    }
  });
});
