import { invoke } from "@tauri-apps/api/core";

/**
 * Opens an http(s) link in the host browser.
 *
 * Goes through the `open_external_url` command instead of the opener
 * plugin: on Linux the plugin spawns the host `xdg-open`, which delegates
 * to host helpers (e.g. `kde-open`) that crash under our bundled
 * `LD_LIBRARY_PATH`. The command scrubs it before dispatch.
 */
export function openExternalUrl(url: string): Promise<void> {
  return invoke("open_external_url", { url });
}
