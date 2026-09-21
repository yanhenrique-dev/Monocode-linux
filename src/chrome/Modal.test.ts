// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal, ModalPanel } from "./Modal";

describe("ModalPanel", () => {
  it("names the dialog and close action", () => {
    const markup = renderToStaticMarkup(
      createElement(ModalPanel, {
        title: "Example",
        description: "A reusable shell",
        onClose: vi.fn(),
        children: "Body",
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("modal-panel");
    expect(markup).toContain("Example");
    expect(markup).toContain("A reusable shell");
    expect(markup).toContain("Body");
    expect(markup).toContain('aria-label="Close"');
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

  it("closes immediately with animations off", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
    const markup = renderToStaticMarkup(
      createElement(ModalPanel, {
        title: "Authentication required",
        description: "Sign in to continue.",
        minimalHeader: true,
        onClose: vi.fn(),
        children: "Provider login",
      }),
    );

    expect(markup).toContain('class="sr-only"');
    expect(markup).toContain("Authentication required");
    expect(markup).toContain("Provider login");
  });
});
