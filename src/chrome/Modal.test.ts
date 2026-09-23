// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("ModalPanel", () => {
  function renderModal(props: Record<string, unknown>) {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const rooted: Root = createRoot(container);
    act(() => {
      rooted.render(
        createElement(Modal, {
          title: "Example",
          onClose: vi.fn(),
          children: "Body",
          ...props,
        }),
      );
    });
    return { container, rooted };
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("names the dialog and close action", () => {
    const { rooted, container } = renderModal({
      description: "A reusable shell",
    });
    try {
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      expect(dialog?.textContent).toContain("Example");
      expect(dialog?.textContent).toContain("A reusable shell");
      expect(dialog?.textContent).toContain("Body");
      expect(
        dialog?.querySelector('button[aria-label="Close"]'),
      ).not.toBeNull();
    } finally {
      act(() => rooted.unmount());
      container.remove();
    }
  });

  it("plays the panel outro before closing with animations on", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.setItem("monocode.experimentalAnimations", "1");
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      const onClose = vi.fn();
      await act(async () => {
        root.render(
          createElement(Modal, {
            title: "Example",
            onClose,
            children: "Body",
          }),
        );
      });

      const closeButton = document.body.querySelector(
        'button[aria-label="Close"]',
      ) as HTMLButtonElement;
      await act(async () => closeButton.click());

      const closing = document.body.querySelector(".modal-panel-closing");
      expect(closing).not.toBeNull();
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        closing!.dispatchEvent(
          new AnimationEvent("animationend", { bubbles: true }),
        );
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      container.remove();
      document.body.innerHTML = "";
      localStorage.removeItem("monocode.experimentalAnimations");
      vi.unstubAllGlobals();
    }
  });

  it("closes immediately with animations off", async () => {    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.setItem("monocode.experimentalAnimations", "0");
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      const onClose = vi.fn();
      await act(async () => {
        root.render(
          createElement(Modal, {
            title: "Example",
            onClose,
            children: "Body",
          }),
        );
      });

      const closeButton = document.body.querySelector(
        'button[aria-label="Close"]',
      ) as HTMLButtonElement;
      await act(async () => closeButton.click());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(
        document.body.querySelector(".modal-panel-closing"),
      ).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
      document.body.innerHTML = "";
      localStorage.removeItem("monocode.experimentalAnimations");
      vi.unstubAllGlobals();
    }
  });

  it("can preserve an accessible title with a minimal visual header", () => {
    const { rooted, container } = renderModal({
      title: "Authentication required",
      description: "Sign in to continue.",
      minimalHeader: true,
      children: "Provider login",
    });
    try {
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain("Authentication required");
      expect(dialog?.textContent).toContain("Provider login");
      expect(
        dialog?.querySelector("header .sr-only"),
      ).not.toBeNull();
    } finally {
      act(() => rooted.unmount());
      container.remove();
    }
  });

  it("traps Tab inside the dialog", () => {
    const { rooted, container } = renderModal({});
    try {
      const dialog = document.body.querySelector(
        '[role="dialog"]',
      ) as HTMLElement;
      const buttons = Array.from(
        dialog.querySelectorAll("button:not([disabled])"),
      ) as HTMLButtonElement[];
      expect(buttons.length).toBeGreaterThan(0);
      const last = buttons[buttons.length - 1];
      act(() => last.focus());
      act(() => {
        last.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
      });
      expect(dialog.contains(document.activeElement)).toBe(true);
    } finally {
      act(() => rooted.unmount());
      container.remove();
    }
  });

  it("closes on Escape with animations off", async () => {    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.setItem("monocode.experimentalAnimations", "0");
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      const onClose = vi.fn();
      await act(async () => {
        root.render(
          createElement(Modal, {
            title: "Example",
            onClose,
            children: "Body",
          }),
        );
      });

      await act(async () => {
        document.body
          .querySelector('[role="dialog"]')!
          .dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      container.remove();
      document.body.innerHTML = "";
      localStorage.removeItem("monocode.experimentalAnimations");
      vi.unstubAllGlobals();
    }
  });

  it("restores focus to the opener on unmount", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    act(() => trigger.focus());
    const { rooted, container } = renderModal({});
    try {
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      // Explicit initial focus lands on the dialog close button.
      expect(dialog?.contains(document.activeElement)).toBe(true);
    } finally {
      await act(async () => rooted.unmount());
      container.remove();
    }
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
