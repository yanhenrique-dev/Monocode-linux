// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders wired content without native title", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          createElement(Tooltip, {
            // Hover/focus driving is verified in the WebKitGTK smoke pass;
            // happy-dom cannot reproduce Base's pointer modality.
            content: "Close Tab",
            defaultOpen: true,
            children: createElement(
              "button",
              { "aria-label": "Close Tab" },
              "×",
            ),
          }),
        );
      });
      for (let i = 0; i < 5; i++)
        await act(async () => new Promise((r) => setTimeout(r, 10)));
      const trigger = container.querySelector("button")!;
      // Base's popup carries no role; locate by portal content.
      const portal = document.querySelector("[data-base-ui-portal]");
      expect(portal?.textContent).toContain("Close Tab");
      expect(trigger.getAttribute("aria-label")).toBe("Close Tab");
      expect(trigger.hasAttribute("title")).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
