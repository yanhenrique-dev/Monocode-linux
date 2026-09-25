// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskListPreview } from "./TaskListPreview";

describe("TaskListPreview loading style", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    localStorage.removeItem("monocode.tasksLoadingStyle");
    vi.unstubAllGlobals();
  });

  function renderPreview() {
    const mount = document.createElement("div");
    container.append(mount);
    const root = createRoot(mount);
    act(() =>
      root.render(
        createElement(TaskListPreview, {
          items: [{ text: "Doing", status: "in_progress" }],
        }),
      ),
    );
    return root;
  }

  it("uses the square trace while working by default", () => {
    const root = renderPreview();
    try {
      expect(
        container.querySelector('[data-loading-indicator="trace"]'),
      ).not.toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });

  it("uses the classic spinner when the classic style is picked", () => {
    localStorage.setItem("monocode.tasksLoadingStyle", "classic");
    const root = renderPreview();
    try {
      expect(
        container.querySelector('[data-loading-indicator="trace"]'),
      ).toBeNull();
      expect(
        container.querySelector('[aria-label="In progress"]'),
      ).not.toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });
});
