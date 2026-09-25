import React, { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import { ErrorBoundary } from "./chrome/ErrorBoundary";
import { activateWindowAppearance, initAppearance } from "./lib/appearance";
import { initHardwareAcceleration } from "./lib/hardwareAcceleration";
import { initLocale, LocaleProvider } from "./lib/locale";
import { initSounds } from "./lib/sounds";
import {
  abortQuit,
  askQuitConfirmation,
  commitQuit,
  loadBootWorkspace,
  reportQuitPoll,
} from "./lib/appLifecycle";
import { consumeInstalledUpdate } from "./lib/updateNotice";
import { SPLASH_REMOVE_MS, splashFadeDelay } from "./lib/uiTimings";
import "./index.css";

// Stamped here rather than in the inline script in index.html: those live in
// <head> and run before #boot-splash exists in the DOM, so they cannot stamp
// it. This module is a deferred module script, so the body is already parsed.
// The splash is the first child of <body>, which puts this at most a frame
// after its first paint -- counting from here can only undercount, and
// undercounting is the safe direction: it never makes the splash flash.
const splashShownAt = performance.now();

initAppearance();
initHardwareAcceleration();
initLocale();
initSounds();

function dismissBootSplash() {
  const splash = document.getElementById("boot-splash");
  if (!splash || splash.dataset.dismissed === "1") return;
  splash.dataset.dismissed = "1";
  const delay = splashFadeDelay(splashShownAt, performance.now());
  const fade = () => {
    activateWindowAppearance();
    splash.classList.add("boot-splash-out");
    window.setTimeout(() => splash.remove(), SPLASH_REMOVE_MS);
  };
  // useLayoutEffect runs before paint. Two frames later the app is on
  // screen, so the fade reveals UI instead of the desktop blur.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // A fast boot would otherwise flash the logo for a couple of frames and
      // read as a glitch. Holding it here reads as intentional; a boot that
      // already outlasted the minimum pays nothing.
      if (delay === 0) fade();
      else window.setTimeout(fade, delay);
    });
  });
}

function BootGate({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    dismissBootSplash();
  }, []);
  return children;
}

void listen<number>("quit_poll", (event) => {
  void reportQuitPoll(event.payload);
});
// Scoped to this window on purpose: a global `listen` is registered as `Any`,
// which Tauri matches for every event regardless of the emitter's target, so
// one dialog would become one per window.
void getCurrentWebviewWindow().listen<{ id: number; inFlight: number }>(
  "quit_confirm",
  (event) => {
    void askQuitConfirmation(event.payload.id, event.payload.inFlight);
  },
);
void listen<number>("quit_commit", (event) => {
  void commitQuit(event.payload);
});
void listen("quit_aborted", () => {
  abortQuit();
});

void loadBootWorkspace().then(
  ({ windowTransfer, resumed, isFirstRun, history, historyCwd }) => {
    const installedUpdate = windowTransfer ? null : consumeInstalledUpdate();
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <BootGate>
          <ErrorBoundary label="MonoCode">
            <LocaleProvider>
              <App
                windowTransfer={windowTransfer}
                resumed={resumed}
                isFirstRun={isFirstRun}
                installedUpdate={installedUpdate}
                history={history}
                historyCwd={historyCwd}
              />
            </LocaleProvider>
          </ErrorBoundary>
        </BootGate>
      </React.StrictMode>,
    );
  },
);
