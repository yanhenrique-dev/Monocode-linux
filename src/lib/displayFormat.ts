/**
 * Shared display formatters.
 *
 * `src/lib/format.ts` is the Prettier wrapper — unrelated. This module is
 * the single import path for human-facing text: tokens, bytes, elapsed
 * time, compact relative time, short dates. It re-exports the canonical
 * implementations so new code imports from here; the original modules keep
 * working and are the source of truth until call sites migrate.
 */
export { formatTokens } from "./contextUsage";
export { formatFileSize } from "./filePreview";
export { formatLiveElapsed } from "./liveAgents";
export { formatRelativeTime } from "./githubTasks";

import { getIntlLocale } from "./locale";

/**
 * Compact relative time for chrome ("now", "5m", "2h 3m", "3d").
 * Moved from `Sidebar.tsx:formatRelative` unchanged.
 */
export function formatCompactRelative(value: number, now: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const seconds = Math.max(0, Math.round((now - value) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  try {
    return new Intl.DateTimeFormat(getIntlLocale(), {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

/**
 * Short date for settings/history ("Mar 4", "Mar 4, 2025" out of year).
 * Moved from `SettingsView.tsx:formatDate` unchanged.
 */
export function formatShortDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  try {
    const date = new Date(value);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(getIntlLocale(), {
      ...(sameYear ? {} : { year: "numeric" as const }),
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}
