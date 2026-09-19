import { invoke } from "@tauri-apps/api/core";

/**
 * Rejection reason shared with the Rust gate (`external_url.rs`): the two
 * validators must stay in sync so a URL accepted here is accepted there.
 */
export const EXTERNAL_URL_REFUSAL = "refusing to open non-http(s) URL";

// Mirrors `is_allowed_url`: Unicode whitespace (White_Space), control
// characters (Cc), and backslashes are rejected before parsing, because
// launchers trim or split on them differently than the parser does.
const UNSAFE_CHARS =
  /[\u0000-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u007f-\u009f\\]/;

/**
 * Client-side mirror of the Rust URL gate. Rejects without an IPC
 * round-trip; anything accepted here is also accepted by the command.
 */
export function isExternalUrlAllowed(url: string): boolean {
  if (UNSAFE_CHARS.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // `URL` lowercases the scheme, so uppercase HTTP(S) works. An empty
  // hostname (e.g. `https://?query-only`) has nothing to open.
  return (
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    parsed.hostname !== ""
  );
}

/**
 * Opens an http(s) link in the host browser.
 *
 * Goes through the `open_external_url` command instead of the opener
 * plugin: on Linux the plugin spawns the host `xdg-open`, which delegates
 * to host helpers (e.g. `kde-open`) that crash under our bundled
 * `LD_LIBRARY_PATH`. The command scrubs it before dispatch.
 *
 * Rejects for non-web URLs; fire-and-forget callers want
 * {@link openExternalBestEffort} instead.
 */
export function openExternalUrl(url: string): Promise<void> {
  if (!isExternalUrlAllowed(url))
    return Promise.reject(new Error(EXTERNAL_URL_REFUSAL));
  return invoke("open_external_url", { url });
}

/**
 * Fire-and-forget variant for click handlers: never rejects. Failures are
 * loud in DevTools (the only signal when the OS side fails) but never
 * surface as unhandled rejections.
 */
export function openExternalBestEffort(url: string): void {
  void openExternalUrl(url).catch((error: unknown) => {
    console.warn("[openExternal] browser did not open:", error);
  });
}
