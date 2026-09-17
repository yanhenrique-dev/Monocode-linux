import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HARDWARE_ACCELERATION_DEFAULT,
  HARDWARE_REDUCED_CLASS,
  initHardwareAcceleration,
  loadEffectiveTerminalGpu,
  loadHardwareAcceleration,
  saveHardwareAcceleration,
  subscribeHardwareAcceleration,
} from "./hardwareAcceleration";
import { saveTerminalGpu } from "./settings";

const HARDWARE_ACCELERATION_KEY = "monocode.hardwareAcceleration";
const TERMINAL_GPU_KEY = "monocode.terminalGpu";

function mockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

function mockWindow() {
  const scope = globalThis as unknown as { window?: EventTarget };
  scope.window = new EventTarget();
}

function unmockWindow() {
  const scope = globalThis as unknown as { window?: EventTarget };
  delete scope.window;
}

function mockDocument() {
  const classes = new Set<string>();
  const classList = {
    toggle: (name: string, force?: boolean) => {
      const next = force ?? !classes.has(name);
      if (next) classes.add(name);
      else classes.delete(name);
      return next;
    },
    contains: (name: string) => classes.has(name),
    remove: (name: string) => {
      classes.delete(name);
    },
  };
  Object.defineProperty(globalThis, "document", {
    value: { documentElement: { classList } },
    configurable: true,
  });
}

function unmockDocument() {
  const scope = globalThis as unknown as { document?: unknown };
  delete scope.document;
}

describe("hardware acceleration master switch", () => {
  beforeEach(() => {
    mockLocalStorage();
    mockWindow();
    mockDocument();
  });
  afterEach(() => {
    localStorage.removeItem(HARDWARE_ACCELERATION_KEY);
    localStorage.removeItem(TERMINAL_GPU_KEY);
    unmockWindow();
    unmockDocument();
  });

  it("defaults to on", () => {
    expect(HARDWARE_ACCELERATION_DEFAULT).toBe(true);
    expect(loadHardwareAcceleration()).toBe(true);
  });

  it("persists an off switch", () => {
    saveHardwareAcceleration(false);
    expect(localStorage.getItem(HARDWARE_ACCELERATION_KEY)).toBe("0");
    expect(loadHardwareAcceleration()).toBe(false);
    saveHardwareAcceleration(true);
    expect(loadHardwareAcceleration()).toBe(true);
  });

  it("toggles the reduced class on <html>", () => {
    saveHardwareAcceleration(false);
    expect(
      document.documentElement.classList.contains(HARDWARE_REDUCED_CLASS),
    ).toBe(true);
    saveHardwareAcceleration(true);
    expect(
      document.documentElement.classList.contains(HARDWARE_REDUCED_CLASS),
    ).toBe(false);
  });

  it("notifies subscribers with the saved value", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeHardwareAcceleration((enabled) =>
      seen.push(enabled),
    );
    saveHardwareAcceleration(false);
    saveHardwareAcceleration(true);
    unsubscribe();
    saveHardwareAcceleration(false);
    expect(seen).toEqual([false, true]);
  });

  it("gates the terminal sub-switch", () => {
    saveTerminalGpu(true);
    saveHardwareAcceleration(true);
    expect(loadEffectiveTerminalGpu()).toBe(true);
    saveHardwareAcceleration(false);
    expect(loadEffectiveTerminalGpu()).toBe(false);
    saveTerminalGpu(false);
    saveHardwareAcceleration(true);
    expect(loadEffectiveTerminalGpu()).toBe(false);
  });

  it("init paints the stored value", () => {
    localStorage.setItem(HARDWARE_ACCELERATION_KEY, "0");
    const stop = initHardwareAcceleration();
    expect(
      document.documentElement.classList.contains(HARDWARE_REDUCED_CLASS),
    ).toBe(true);
    stop();
  });
});
