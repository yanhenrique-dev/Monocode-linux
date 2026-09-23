// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  function renderDialog(onCancel: () => void, onConfirm: () => void) {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        createElement(ConfirmDialog, {
          title: "Remove background?",
          description: "This cannot be undone.",
          confirmLabel: "Remove",
          danger: true,
          onCancel,
          onConfirm,
        }),
      );
    });
    return { container, root };
  }

  it("uses alertdialog semantics with Cancel focused", async () => {
    const { root, container } = renderDialog(vi.fn(), vi.fn());
    try {
      await act(async () => new Promise((r) => setTimeout(r, 0)));
      const dialog = document.querySelector('[role="alertdialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.textContent).toContain("Remove background?");
      const cancel = [...dialog!.querySelectorAll("button")].find(
        (b) => b.textContent === "Cancel",
      )!;
      // rAF focus hop lands on Cancel, not the destructive action.
      await act(
        async () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      expect(document.activeElement).toBe(cancel);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("cancels on Escape and confirms on click", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { root, container } = renderDialog(onCancel, onConfirm);
    try {
      await act(async () => {});
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      const confirm = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Remove",
      )!;
      act(() => confirm.click());
      expect(onConfirm).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
