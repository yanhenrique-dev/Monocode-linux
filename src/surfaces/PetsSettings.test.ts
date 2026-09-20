// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PetsSettings } from "./PetsSettings";

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(createElement(PetsSettings)));
}

function cardFor(name: string): HTMLElement | null {
  const cards = Array.from(
    container.querySelectorAll<HTMLElement>("div"),
  ).filter((node) => node.textContent === `${name}Hide`);
  return cards[0] ?? null;
}

function buttonIn(card: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(
    card.querySelectorAll<HTMLButtonElement>("button"),
  ).find((item) => item.textContent === label);
  expect(button, label).toBeDefined();
  return button!;
}

function setName(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Pet name"]',
  )!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(label: string) {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((item) => item.textContent === label);
  expect(button, label).toBeDefined();
  act(() => button!.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  // These tests assert the English UI: pin the locale so a pt-BR OS does
  // not translate the surface under test.
  localStorage.setItem("monocode.locale", "en");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("PetsSettings", () => {
  it("lists the built-in roster", () => {
    render();
    expect(cardFor("ghost")).not.toBeNull();
    expect(cardFor("cat")).not.toBeNull();
  });

  it("hides a built-in and restores it", () => {
    render();
    act(() => buttonIn(cardFor("ghost")!, "Hide").click());
    expect(cardFor("ghost")).toBeNull();
    expect(container.textContent).toContain("Hidden (1)");
    click("Restore all");
    expect(cardFor("ghost")).not.toBeNull();
  });

  it("adds a custom pet and deletes it with confirm", () => {
    render();
    setName("blob");
    click("Save pet");
    expect(container.textContent).toContain("Saved — pick it from any project menu.");
    const card = Array.from(
      container.querySelectorAll<HTMLElement>("div"),
    ).find((node) => node.textContent === "blobDelete");
    expect(card).toBeDefined();
    act(() => buttonIn(card!, "Delete").click());
    expect(buttonIn(card!, "Confirm?")).toBeDefined();
    act(() => buttonIn(card!, "Confirm?").click());
    expect(localStorage.getItem("monocode.pets.custom")).toBe("[]");
  });

  it("rejects duplicate names", () => {
    render();
    setName("ghost");
    click("Save pet");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
