import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { announceUpdateAvailable } from "./sounds";
import { rememberInstalledUpdate } from "./updateNotice";
import { loadLocale, t, type Locale } from "./locale";

export type UpdateFlowOptions = {
  /**
   * Show the native dialog for manual checks. Defaults to false when an
   * `onProgress` listener renders the result inline (Settings), true
   * otherwise (menu / shortcut with no inline surface).
   */
  showDialog?: boolean;
  /**
   * Backoff between `check()` retries, in ms. Defaults to [1000, 2000]
   * (3 attempts total). Tests pass [0, 0].
   */
  retryDelaysMs?: number[];
};

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "error";

export type UpdaterSnapshot = {
  phase: UpdaterPhase;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  error?: string;
};

let pendingUpdate: Update | null = null;

let flatpakCache: boolean | null = null;

/// True inside the Flatpak sandbox, where the in-app updater is disabled
/// (Flathub updates the whole package; the backend doesn't even register
/// the updater plugin there). Cached after the first probe; falls back to
/// false outside Tauri (web preview, unit tests).
export async function isFlatpakSandbox(): Promise<boolean> {
  if (flatpakCache !== null) return flatpakCache;
  try {
    flatpakCache = await invoke<boolean>("flatpak_sandboxed");
  } catch {
    flatpakCache = false;
  }
  return flatpakCache;
}

function flatpakIdle(currentVersion: string): UpdaterSnapshot {
  return { phase: "idle", currentVersion };
}

function isUpdaterNotConfiguredError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /updater does not have any endpoints set/i.test(text);
}

/**
 * Tauri stages the current executable next to itself (`tauri_current_*`).
 * System-wide installs (/usr/local/bin, /usr/bin) owned by root fail here
 * with EACCES (os error 13) even during `check()`.
 */
export function isSystemInstallPermissionError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /os error 13|permission denied|permiss[aã]o negada|insufficient permissions|tauri_current_/i.test(
    text,
  );
}

export function friendlyUpdateError(error: unknown, locale: Locale): string {
  if (isSystemInstallPermissionError(error)) {
    return t(locale, "updater.permission_hint");
  }
  if (isNoSpaceError(error)) {
    return t(locale, "updater.no_space_hint");
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * The download stages next to the running binary, so a full disk aborts the
 * install mid-write with ENOSPC instead of a version mismatch later.
 */
export function isNoSpaceError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /no space left|enospc|disk (full|quota)|sem espa[cç]o|espacio insuficiente/i.test(
    text,
  );
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `check()` with exponential backoff for transient failures (offline boot,
 * flaky wifi). Config and permission errors are permanent: no retry.
 */
export async function checkWithRetry(
  delaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<Update | null> {
  let attempt = 0;
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (
        isUpdaterNotConfiguredError(err) ||
        isSystemInstallPermissionError(err) ||
        attempt >= delaysMs.length
      ) {
        throw err;
      }
      const base = delaysMs[attempt] ?? 0;
      await sleep(base + Math.floor(Math.random() * 250));
      attempt += 1;
    }
  }
}

export async function readAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "0.0.0";
  }
}

export async function probeForUpdate(
  delaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<Update | null> {
  if (await isFlatpakSandbox()) return null;
  const update = await checkWithRetry(delaysMs);
  pendingUpdate = update;
  if (update) announceUpdateAvailable(update.version);
  return update;
}

/**
 * Check the release feed and optionally drive the install.
 * Progress is reported through `onProgress` for inline surfaces (Settings);
 * the native dialog only pops when `opts.showDialog` resolves true (menu /
 * shortcut have no inline surface, so they default to showing it).
 */
export async function runUpdateFlow(
  manual: boolean,
  onProgress?: (snapshot: UpdaterSnapshot) => void,
  opts?: UpdateFlowOptions,
): Promise<UpdaterSnapshot> {
  const locale = loadLocale();
  const dialogTitle = t(locale, "updater.dialog.title");
  // Inline listeners (Settings) already render the result: only pop the
  // native dialog when there is no inline surface, unless forced.
  const showDialog = opts?.showDialog ?? !onProgress;
  const currentVersion = await readAppVersion();
  if (await isFlatpakSandbox()) {
    const idle = flatpakIdle(currentVersion);
    onProgress?.(idle);
    if (manual && showDialog) {
      await message(t(locale, "updater.dialog.flatpak"), {
        title: dialogTitle,
      });
    }
    return idle;
  }
  const base: UpdaterSnapshot = { phase: "checking", currentVersion };
  onProgress?.(base);

  try {
    const update = await checkWithRetry(opts?.retryDelaysMs);
    if (!update) {
      pendingUpdate = null;
      const current: UpdaterSnapshot = { phase: "current", currentVersion };
      onProgress?.(current);
      if (manual && showDialog) {
        await message(t(locale, "updater.dialog.latest"), {
          title: dialogTitle,
        });
      }
      return current;
    }

    pendingUpdate = update;
    announceUpdateAvailable(update.version);
    const available: UpdaterSnapshot = {
      phase: "available",
      currentVersion,
      availableVersion: update.version,
    };
    onProgress?.(available);

    if (!manual || !showDialog) return available;

    const notes = update.body?.trim();
    const detail = notes ? `\n\n${notes}` : "";
    const yes = await ask(
      t(locale, "updater.dialog.available_body", {
        availableVersion: update.version,
        currentVersion,
        detail,
      }),
      { title: t(locale, "updater.dialog.available_title"), kind: "info" },
    );
    if (!yes) return available;

    return installPendingUpdate(onProgress, opts);
  } catch (err) {
    if (isUpdaterNotConfiguredError(err)) {
      pendingUpdate = null;
      const idle: UpdaterSnapshot = { phase: "idle", currentVersion };
      onProgress?.(idle);
      if (manual && showDialog) {
        await message(t(locale, "updater.dialog.not_configured"), {
          title: dialogTitle,
        });
      }
      return idle;
    }

    const error = friendlyUpdateError(err, locale);
    const failed: UpdaterSnapshot = { phase: "error", currentVersion, error };
    onProgress?.(failed);
    if (manual && showDialog) {
      await message(t(locale, "updater.dialog.check_failed", { error }), {
        title: dialogTitle,
      });
    }
    return failed;
  }
}

/**
 * Download and install a previously detected update, then relaunch.
 * Failure is reported through `onProgress`; the native dialog follows the
 * same `showDialog` rule as `runUpdateFlow`.
 */
export async function installPendingUpdate(
  onProgress?: (snapshot: UpdaterSnapshot) => void,
  opts?: UpdateFlowOptions,
): Promise<UpdaterSnapshot> {
  const locale = loadLocale();
  const showDialog = opts?.showDialog ?? !onProgress;
  const currentVersion = await readAppVersion();
  const update = pendingUpdate;
  if (!update) {
    const idle: UpdaterSnapshot = { phase: "idle", currentVersion };
    onProgress?.(idle);
    return idle;
  }

  let downloaded = 0;
  let contentLength = 0;

  const downloading: UpdaterSnapshot = {
    phase: "downloading",
    currentVersion,
    availableVersion: update.version,
    progress: 0,
  };
  onProgress?.(downloading);

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength ?? 0;
        downloaded = 0;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
      }

      const progress =
        contentLength > 0
          ? Math.min(100, Math.round((downloaded / contentLength) * 100))
          : undefined;

      onProgress?.({
        phase: "downloading",
        currentVersion,
        availableVersion: update.version,
        progress,
      });
    });

    rememberInstalledUpdate(update.version);
    pendingUpdate = null;
    await relaunch();
    return {
      phase: "current",
      currentVersion: update.version,
    };
  } catch (err) {
    const error = friendlyUpdateError(err, locale);
    const failed: UpdaterSnapshot = {
      phase: "error",
      currentVersion,
      availableVersion: update.version,
      error,
    };
    onProgress?.(failed);
    if (showDialog) {
      await message(t(locale, "updater.dialog.install_failed", { error }), {
        title: t(locale, "updater.dialog.title"),
      });
    }
    return failed;
  }
}
