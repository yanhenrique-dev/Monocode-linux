// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAYER } from "../../lib/layers";
import { ToastList, ToastProvider, ToastViewport } from "./toast";
import { useToastManager } from "./toast";

function Host() {
  const manager = useToastManager();
  return createElement(
    "button",
    {
      type: "button",
      onClick: () =>
        manager.add({
          title: "Saved",
          description: "Preferences updated",
        }),
    },
    "Fire",
  );
}

describe("Toast", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("shows a managed toast in the LAYER.toast viewport", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      act(() => {
        root.render(
          createElement(
            ToastProvider,
            null,
            createElement(
              ToastViewport,
              null,
              createElement(ToastList, null),
            ),
            createElement(Host, null),
          ),
        );
      });
      const fire = container.querySelector("button")!;
      act(() => fire.click());
      await act(async () => {});
      await act(async () => new Promise((r) => setTimeout(r, 0)));
      const toast = document.querySelector('[role="dialog"]');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toContain("Saved");
      expect(toast?.textContent).toContain("Preferences updated");
      const viewportEl = document.body.querySelector(
        '[style*="z-index"]',
      ) as HTMLElement | null;
      expect(viewportEl?.style.zIndex).toBe(String(LAYER.toast));
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
