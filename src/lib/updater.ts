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
  /**
   * Backoff between `downloadAndInstall()` retries. Defaults to
   * [1000, 2000, 5000]. Download is idempotent (staged next to binary),
   * so retry is safe. Permanent errors (EACCES, ENOSPC) never retry.
   */
  downloadRetryDelaysMs?: number[];
  /**
   * Timeout per `check()` attempt. Defaults to 15s. Prevents hung UI
   * when GitHub redirects stall.
   */
  checkTimeoutMs?: number;
};

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "error";

export type UpdateChannel = "stable" | "beta";

export type UpdaterSnapshot = {
  phase: UpdaterPhase;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  error?: string;
  /** Bytes downloaded so far (when downloading). */
  downloadedBytes?: number;
  /** Total bytes when server reports contentLength. */
  totalBytes?: number;
  /** Measured throughput bytes/s (smoothed). */
  speedBps?: number;
  /** Estimated seconds remaining. */
  etaSeconds?: number;
  /** Which check attempt produced this snapshot (1-based). */
  attempt?: number;
};

let pendingUpdate: Update | null = null;

let flatpakCache: boolean | null = null;

/** Single-flight for concurrent check() calls across windows/components. */
let checkInFlight: Promise<Update | null> | null = null;

/** Best-effort cancel flag: plugin download has no abort, but we can skip relaunch. */
let cancelRequested = false;

export function cancelPendingUpdate(): void {
  cancelRequested = true;
}

function resetCancel(): void {
  cancelRequested = false;
}

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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUpdaterNotConfiguredError(error: unknown): boolean {
  return /updater does not have any endpoints set/i.test(errorText(error));
}

/**
 * Tauri stages the current executable next to itself (`tauri_current_*`).
 * System-wide installs (/usr/local/bin, /usr/bin) owned by root fail here
 * with EACCES (os error 13) even during `check()`.
 */
export function isSystemInstallPermissionError(error: unknown): boolean {
  return /os error 13|permission denied|permiss[aã]o negada|insufficient permissions|tauri_current_/i.test(
    errorText(error),
  );
}

export function isNoSpaceError(error: unknown): boolean {
  return /no space left|enospc|os error 28|disk (full|quota)|sem espa[cç]o|espacio insuficiente/i.test(
    errorText(error),
  );
}

function isTargetsNotFoundError(error: unknown): boolean {
  return /targets?notfound|(?:targets?|platforms?).*(?:not|was|were) found/i.test(
    errorText(error),
  );
}

function isTransientCheckError(error: unknown): boolean {
  return /timeout|timed out|network|fetch failed|failed to fetch|connection|econn|etimedout|socket|429|5\d\d|service unavailable|gateway|offline|ERR_/i.test(
    errorText(error),
  );
}

function isPermanentUpdaterCheckError(error: unknown): boolean {
  return (
    isUpdaterNotConfiguredError(error) ||
    isNoSpaceError(error) ||
    isTargetsNotFoundError(error) ||
    isSystemInstallPermissionError(error)
  );
}

export function friendlyUpdateError(error: unknown, locale: Locale): string {
  if (isNoSpaceError(error)) {
    return t(locale, "updater.no_space_hint");
  }
  if (isSystemInstallPermissionError(error)) {
    return t(locale, "updater.permission_hint");
  }
  return errorText(error);
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000];
const DEFAULT_DOWNLOAD_RETRY_DELAYS_MS = [1000, 2000, 5000];
const DEFAULT_CHECK_TIMEOUT_MS = 15_000;

/** Background poll interval: 6h + jitter. */
export const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_LAST_CHECK_KEY = "monocode.update.lastCheck";
const UPDATE_MANIFEST_CACHE_KEY = "monocode.update.lastManifest";
const UPDATE_CHANNEL_KEY = "monocode.update.channel";

export type CachedManifest = {
  version: string;
  pubDate?: string;
  checkedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

export function getUpdateChannel(): UpdateChannel {
  try {
    const raw = window.localStorage.getItem(UPDATE_CHANNEL_KEY);
    return raw === "beta" ? "beta" : "stable";
  } catch {
    return "stable";
  }
}

/**
 * Channel limitation: the Tauri updater plugin resolves `check()` against
 * endpoints compiled into tauri.conf.json at build time, so the runtime
 * channel preference cannot switch the manifest URL. The preference is
 * persisted for a future build-time channel overlay (tauri.beta.conf.json
 * pointing at latest-beta.json); until then every check uses latest.json.
 */

export function setUpdateChannel(channel: UpdateChannel): void {
  try {
    window.localStorage.setItem(UPDATE_CHANNEL_KEY, channel);
  } catch {
    // Storage full/blocked: channel preference is non-critical.
  }
}

export function getLastCheckAt(): number | null {
  try {
    const raw = window.localStorage.getItem(UPDATE_LAST_CHECK_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function shouldBackgroundCheck(now = Date.now()): boolean {
  const last = getLastCheckAt();
  if (last == null) return true;
  return now - last >= UPDATE_POLL_INTERVAL_MS;
}

function markCheckedNow(): void {
  try {
    window.localStorage.setItem(UPDATE_LAST_CHECK_KEY, String(Date.now()));
  } catch {
    // Non-critical.
  }
}

export function getCachedManifest(): CachedManifest | null {
  try {
    const raw = window.localStorage.getItem(UPDATE_MANIFEST_CACHE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<CachedManifest>;
    if (typeof parsed.version !== "string" || !parsed.version.trim()) return null;
    if (typeof parsed.checkedAt !== "number" || !Number.isFinite(parsed.checkedAt)) return null;
    return {
      version: parsed.version.trim(),
      pubDate: typeof parsed.pubDate === "string" ? parsed.pubDate : undefined,
      checkedAt: parsed.checkedAt,
    };
  } catch {
    return null;
  }
}

function setCachedManifest(version: string): void {
  try {
    const payload: CachedManifest = { version, checkedAt: Date.now() };
    window.localStorage.setItem(UPDATE_MANIFEST_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Non-critical.
  }
}

export async function checkWithRetry(
  delaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
  opts?: { timeoutMs?: number },
): Promise<Update | null> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS;
  let attempt = 0;
  for (;;) {
    try {
      return await withTimeout(check(), timeoutMs, "Update check");
    } catch (err) {
      if (isPermanentUpdaterCheckError(err) || attempt >= delaysMs.length) {
        throw err;
      }
      // Permanent-looking errors never retry; transient always retry.
      // Unknown errors retry while attempts remain (cheap, bounded).
      if (!isTransientCheckError(err) && attempt >= 1) {
        throw err;
      }
      const base = delaysMs[attempt] ?? 0;
      await sleep(base + Math.floor(Math.random() * 250));
      attempt += 1;
    }
  }
}

/** Shared check: concurrent callers await same promise, one network hit. */
function sharedCheck(
  delaysMs: number[] | undefined,
  timeoutMs: number | undefined,
): Promise<Update | null> {
  if (!checkInFlight) {
    checkInFlight = checkWithRetry(delaysMs, { timeoutMs }).finally(() => {
      checkInFlight = null;
    });
  }
  return checkInFlight;
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
  // Record the attempt even on failure: otherwise an offline machine keeps
  // shouldBackgroundCheck() true and every focus event fires a full retry.
  let update: Update | null;
  try {
    update = await sharedCheck(delaysMs, DEFAULT_CHECK_TIMEOUT_MS);
  } finally {
    markCheckedNow();
  }
  pendingUpdate = update;
  if (update) {
    setCachedManifest(update.version);
    announceUpdateAvailable(update.version);
  }
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
  const base: UpdaterSnapshot = { phase: "checking", currentVersion, attempt: 1 };
  onProgress?.(base);

  try {
    let update: Update | null;
    try {
      update = await sharedCheck(opts?.retryDelaysMs, opts?.checkTimeoutMs);
    } finally {
      // Attempt timestamp even on failure: bounds background retries.
      markCheckedNow();
    }
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
    resetCancel();
    setCachedManifest(update.version);
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
    const cached = getCachedManifest();
    const failed: UpdaterSnapshot = {
      phase: "error",
      currentVersion,
      // Surface last known version so offline UI can still hint.
      availableVersion: cached?.version,
      error,
    };
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
 * Retries transient download failures with backoff. Failure is reported
 * through `onProgress`; the native dialog follows the same `showDialog`
 * rule as `runUpdateFlow`.
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

  resetCancel();
  const delays = opts?.downloadRetryDelaysMs ?? DEFAULT_DOWNLOAD_RETRY_DELAYS_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (cancelRequested) {
      const idle: UpdaterSnapshot = {
        phase: "available",
        currentVersion,
        availableVersion: update.version,
      };
      onProgress?.(idle);
      return idle;
    }
    try {
      await downloadOnce(update, currentVersion, onProgress, attempt + 1);
      // downloadAndInstall already staged the binary: record the install
      // before honoring cancel, and skip only relaunch. Returning
      // "available" here would reinstall the same version on next click.
      rememberInstalledUpdate(update.version);
      pendingUpdate = null;
      if (cancelRequested) {
        return {
          phase: "current",
          currentVersion: update.version,
        };
      }
      await relaunch();
      return {
        phase: "current",
        currentVersion: update.version,
      };
    } catch (err) {
      lastError = err;
      // Never retry permanent failures: missing disk, permissions, bad target.
      if (isPermanentUpdaterCheckError(err) || attempt >= delays.length) break;
      if (!isTransientCheckError(err)) break;
      const base = delays[attempt] ?? 0;
      await sleep(base + Math.floor(Math.random() * 250));
    }
  }

  const error = friendlyUpdateError(lastError, locale);
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

async function downloadOnce(
  update: Update,
  currentVersion: string,
  onProgress: ((snapshot: UpdaterSnapshot) => void) | undefined,
  attempt: number,
): Promise<void> {
  let downloaded = 0;
  let contentLength = 0;
  let startAt = Date.now();
  let lastEmitAt = 0;
  let lastDownloaded = 0;
  let speedBps: number | undefined;

  const downloading: UpdaterSnapshot = {
    phase: "downloading",
    currentVersion,
    availableVersion: update.version,
    progress: 0,
    downloadedBytes: 0,
    attempt,
  };
  onProgress?.(downloading);

  await update.downloadAndInstall((event: DownloadEvent) => {
    const now = Date.now();
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? 0;
      downloaded = 0;
      startAt = now;
      lastEmitAt = now;
      lastDownloaded = 0;
      speedBps = undefined;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
    } else if (event.event === "Finished") {
      downloaded = contentLength > 0 ? contentLength : downloaded;
    }

    // Smooth throughput over ~500ms windows, throttle UI emits.
    const dt = (now - lastEmitAt) / 1000;
    if (dt >= 0.5 || event.event === "Finished") {
      const delta = downloaded - lastDownloaded;
      if (dt > 0 && delta >= 0) {
        const instant = delta / dt;
        speedBps = speedBps == null ? instant : speedBps * 0.7 + instant * 0.3;
      }
      lastEmitAt = now;
      lastDownloaded = downloaded;
    }

    const elapsed = Math.max((now - startAt) / 1000, 0.001);
    const avg = downloaded / elapsed;
    const effective = speedBps ?? avg;
    const progress =
      contentLength > 0
        ? Math.min(100, Math.round((downloaded / contentLength) * 100))
        : undefined;
    const etaSeconds =
      effective > 0 && contentLength > downloaded
        ? Math.ceil((contentLength - downloaded) / effective)
        : undefined;

    onProgress?.({
      phase: "downloading",
      currentVersion,
      availableVersion: update.version,
      progress,
      downloadedBytes: downloaded,
      totalBytes: contentLength > 0 ? contentLength : undefined,
      speedBps: Number.isFinite(effective) ? Math.round(effective) : undefined,
      etaSeconds,
      attempt,
    });
  });
}
