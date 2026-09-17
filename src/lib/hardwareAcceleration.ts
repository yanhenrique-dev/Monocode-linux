import { loadTerminalGpu } from "./settings";

const HARDWARE_ACCELERATION_KEY = "monocode.hardwareAcceleration";

export const HARDWARE_ACCELERATION_DEFAULT = true;

/** Fired on `window` when the master hardware-acceleration switch flips. */
export const HARDWARE_ACCELERATION_CHANGE_EVENT =
  "monocode:hardware-acceleration-change";

/** Class applied to <html> while the master switch is off. */
export const HARDWARE_REDUCED_CLASS = "hw-reduced";

export function loadHardwareAcceleration(): boolean {
  try {
    const raw = localStorage.getItem(HARDWARE_ACCELERATION_KEY);
    if (raw == null) return HARDWARE_ACCELERATION_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return HARDWARE_ACCELERATION_DEFAULT;
  }
}

/**
 * Terminal GPU rendering is gated twice: the master switch owns every
 * compositor fast path (WebGL, blur, off-viewport skipping) and the
 * terminal keeps its own sub-switch underneath it.
 */
export function loadEffectiveTerminalGpu(): boolean {
  return loadHardwareAcceleration() && loadTerminalGpu();
}

function syncHardwareAccelerationClass(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    HARDWARE_REDUCED_CLASS,
    !enabled,
  );
}

export function saveHardwareAcceleration(value: boolean) {
  try {
    localStorage.setItem(HARDWARE_ACCELERATION_KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  syncHardwareAccelerationClass(value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(HARDWARE_ACCELERATION_CHANGE_EVENT, {
      detail: value,
    }),
  );
}

export function subscribeHardwareAcceleration(
  onStoreChange: (enabled: boolean) => void,
) {
  if (typeof window === "undefined") return () => {};
  const onEvent = (event: Event) => {
    onStoreChange((event as CustomEvent<boolean>).detail);
  };
  window.addEventListener(HARDWARE_ACCELERATION_CHANGE_EVENT, onEvent);
  return () =>
    window.removeEventListener(HARDWARE_ACCELERATION_CHANGE_EVENT, onEvent);
}

/** Paint the stored value before first render, then keep it in sync. */
export function initHardwareAcceleration() {
  syncHardwareAccelerationClass(loadHardwareAcceleration());
  return subscribeHardwareAcceleration(syncHardwareAccelerationClass);
}
