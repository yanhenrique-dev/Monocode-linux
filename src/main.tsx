import React, { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
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
import { hydrateSettings } from "./lib/settings/store";
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

// Settings hydrate alongside the workspace rather than before it: the inline
// script in index.html has already read the mirror to paint the first frame,
// so a slow settings file must not hold up the window. What it must beat is
// the first React render, since that is where a component would read a default
// and paint it over the correct value.
void Promise.all([loadBootWorkspace(), hydrateSettings()]).then(
  async ([{ windowTransfer, resumed, history, historyCwd }]) => {
    // Running version validates the post-install marker: without it a stale
    // marker from another version would show a wrong "updated" notice.
    let currentVersion: string | undefined;
    try {
      currentVersion = await getVersion();
    } catch {
      currentVersion = undefined;
    }
    const installedUpdate = windowTransfer
      ? null
      : consumeInstalledUpdate(undefined, currentVersion);
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <BootGate>
          <ErrorBoundary label="MonoCode">
            <LocaleProvider>
              <App
                windowTransfer={windowTransfer}
                resumed={resumed}
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
