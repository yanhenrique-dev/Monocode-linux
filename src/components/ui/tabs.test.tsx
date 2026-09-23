// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./tabs";

describe("Tabs", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("activates panels with roving tabindex", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root: Root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          createElement(
            Tabs,
            { defaultValue: "a" },
            createElement(
              TabsList,
              { "aria-label": "Views" },
              createElement(TabsTab, { value: "a" }, "Chat"),
              createElement(TabsTab, { value: "b" }, "Changes"),
            ),
            createElement(TabsPanel, { value: "a" }, "chat panel"),
            createElement(TabsPanel, { value: "b" }, "changes panel"),
          ),
        );
      });
      const tabs = [...container.querySelectorAll('[role="tab"]')];
      expect(tabs).toHaveLength(2);
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(document.body.textContent).toContain("chat panel");
      act(() => {
        (tabs[1] as HTMLElement).click();
      });
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(document.body.textContent).toContain("changes panel");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
