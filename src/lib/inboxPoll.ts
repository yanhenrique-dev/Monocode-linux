import {
  githubWorkItem,
  type GithubWorkItem,
} from "./githubTasks";
import type { LinkedWorkItemTarget } from "./linkedSessionUpdates";

/**
 * Polling engine for the inbox badge (timers, backoff, fallback lookups).
 *
 * Extracted from `useInboxUnseen`: pure helpers + named timing constants.
 * The hook keeps subscription wiring and selectors; this module owns the
 * retry math so it can be unit-tested without React.
 */

/** Steady-state badge poll cadence. */
export const INBOX_POLL_MS = 30_000;

/** Minimum age before a missing linked item is refetched directly. */
export const INBOX_FALLBACK_REFRESH_MS = 60_000;

/** Parallel direct lookups for items the list poll missed. */
export const INBOX_MAX_CONCURRENT_LOOKUPS = 3;

/** Offline/rate-limit backoff ceiling for background polls. */
export const INBOX_MAX_POLL_BACKOFF_MS = 5 * 60_000;

/** Rate-limit backoff after a 429-flavored list error. */
export const INBOX_RATE_LIMIT_BACKOFF_MS = 60_000;

export function isInboxRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    (lower.includes("quota") && lower.includes("exceed"))
  );
}

/** Merge fresh snapshots, keeping referential stability when unchanged. */
export function mergeInboxSnapshots(
  current: ReadonlyMap<string, GithubWorkItem>,
  snapshots: readonly (readonly [string, GithubWorkItem])[],
): ReadonlyMap<string, GithubWorkItem> {
  let next: Map<string, GithubWorkItem> | undefined;
  for (const [key, item] of snapshots) {
    if (current.get(key)?.updatedAt === item.updatedAt) continue;
    next ??= new Map(current);
    next.set(key, item);
  }
  return next ?? current;
}

/** Next backoff delay after `failures` consecutive errors. */
export function inboxBackoffMs(failures: number): number {
  return Math.min(
    INBOX_POLL_MS * 2 ** failures,
    INBOX_MAX_POLL_BACKOFF_MS,
  );
}

/** Direct lookups for linked items the shared list poll did not return. */
export async function fetchInboxFallbackUpdates(
  cwd: string,
  targets: readonly LinkedWorkItemTarget[],
): Promise<Array<readonly [string, GithubWorkItem]>> {
  const results: Array<readonly [string, GithubWorkItem]> = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      if (!target) return;
      try {
        const item = await githubWorkItem(
          cwd,
          target.item.repo,
          target.item.kind,
          target.item.number,
          { force: true },
        );
        if (Number.isFinite(Date.parse(item.updatedAt))) {
          results.push([target.key, item]);
        }
      } catch {
        // The next shared Inbox poll retries missing items.
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(INBOX_MAX_CONCURRENT_LOOKUPS, targets.length) },
      worker,
    ),
  );
  return results;
}
