import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  inboxListCacheKey,
  inboxItemKey,
  inboxProjectsForRail,
  listInboxItems,
  type GithubWorkItem,
  type InboxItem,
  type InboxQuery,
  type InboxProvider,
} from "../lib/githubTasks";
import {
  applyInboxFilters,
  inboxFetchState,
  loadInboxFilters,
  pruneInboxFilters,
} from "../lib/inboxFilters";
import {
  inboxHasUnseenItems,
  rememberInboxItems,
  markInboxItemsSeen,
  seedInboxSeenIfNeeded,
  subscribeInboxSeen,
  type InboxSeenEntry,
} from "../lib/inboxSeen";
import {
  linkedSessionUpdates,
  linkedWorkItemTargets,
  linkedWorkItemUpdateKey,
  type LinkedSessionUpdate,
} from "../lib/linkedSessionUpdates";
import {
  markLinkedSessionUpdateSeen,
  linkedSessionSeenAt,
  subscribeLinkedSessionSeen,
} from "../lib/linkedSessionSeen";
import { loadHiddenLinearTeamIds } from "../lib/linear";
import type { RecentProject } from "../lib/recents";
import type { SessionSummary } from "../lib/sessionStore";
import { playCue } from "../lib/sounds";
import {
  InboxNotificationTracker,
  inboxNotificationSubject,
} from "../lib/inboxNotifications";
import {
  inboxNotificationProject,
  rememberNotificationProjects,
} from "../lib/notificationProjects";
import {
  allowsProjectNotificationIndicator,
  loadNotificationPreferences,
  subscribeNotificationPreferences,
  type NotificationSubject,
} from "../lib/notificationPreferences";
import {
  consumeInboxSelfActivity,
  subscribeInboxSelfActivity,
} from "../lib/inboxSelfActivity";
import {
  fetchInboxFallbackUpdates,
  inboxBackoffMs,
  INBOX_FALLBACK_REFRESH_MS,
  INBOX_POLL_MS,
  INBOX_RATE_LIMIT_BACKOFF_MS,
  isInboxRateLimitMessage,
  mergeInboxSnapshots,
} from "../lib/inboxPoll";

type ProjectSeenEntry = InboxSeenEntry & NotificationSubject;

function seenEntries(items: readonly InboxItem[]): ProjectSeenEntry[] {
  return items.map((item) => ({
    key: inboxItemKey(item),
    updatedAt: item.updatedAt,
    ...inboxNotificationSubject(item),
  }));
}

export type InboxActivity = {
  unseen: boolean;
  linkedSessionUpdateIds: ReadonlySet<string>;
  linkedSessionUpdates: ReadonlyMap<string, LinkedSessionUpdate>;
};

/**
 * One background refresh supplies both the Inbox badge and linked sessions.
 *
 * Single responsibility: subscription wiring + badge selectors. Poll timing,
 * backoff, and fallback lookups live in `../lib/inboxPoll`.
 */
export function useInboxActivity(
  recents: RecentProject[],
  cwd: string,
  sessions: readonly SessionSummary[],
): InboxActivity {
  const [unseen, setUnseen] = useState(false);
  const [workItems, setWorkItems] = useState<
    ReadonlyMap<string, GithubWorkItem>
  >(() => new Map());
  const [linkedSeenRevision, setLinkedSeenRevision] = useState(0);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const entriesRef = useRef<ProjectSeenEntry[]>([]);
  const notifications = useRef(new InboxNotificationTracker());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const fallbackFetchedAt = useRef(new Map<string, number>());
  const targetKey = linkedWorkItemTargets(sessions)
    .map((target) => target.key)
    .join("\0");

  const applyUnseen = useCallback(() => {
    const preferences = loadNotificationPreferences();
    // Category choices and mute affect badges, never the item's unread state.
    setUnseen(
      inboxHasUnseenItems(
        entriesRef.current.filter((entry) =>
          allowsProjectNotificationIndicator(entry, preferences),
        ),
      ),
    );
  }, []);

  useEffect(() => {
    const stopSeen = subscribeInboxSeen(applyUnseen);
    const stopPreferences = subscribeNotificationPreferences(() => {
      applyUnseen();
      setNotificationRevision((revision) => revision + 1);
    });
    return () => {
      stopSeen();
      stopPreferences();
    };
  }, [applyUnseen]);

  useEffect(
    () =>
      subscribeLinkedSessionSeen(() =>
        setLinkedSeenRevision((revision) => revision + 1),
      ),
    [],
  );

  useEffect(() => {
    const projects = inboxProjectsForRail(recents, cwd);
    if (projects.length === 0) {
      entriesRef.current = [];
      applyUnseen();
      return;
    }

    let cancelled = false;
    let pulling = false;
    let pullAgain = false;
    let failures = 0;
    let backoffUntil = 0;
    let lastFullFetchAt = 0;

    const pull = async (force: boolean) => {
      if (pulling) {
        pullAgain ||= force;
        return;
      }
      if (!force && Date.now() < backoffUntil) return;
      pulling = true;
      const projectPaths = projects.map((project) => project.path);
      const filters = pruneInboxFilters(loadInboxFilters(), projectPaths);
      const query: InboxQuery = {
        assignedToMe: filters.assignedToMe,
        state: inboxFetchState(filters),
        search: "",
        linearHiddenTeamIds: loadHiddenLinearTeamIds(),
      };
      try {
        // Incremental badge polls ask only what changed since the last full
        // fetch; the list layer merges the delta into the snapshot.
        const since =
          !force && lastFullFetchAt > 0
            ? new Date(lastFullFetchAt).toISOString()
            : undefined;
        const listed = await listInboxItems(projects, query, {
          force,
          since,
        });
        if (!since) lastFullFetchAt = Date.now();
        failures = 0;
        if (cancelled) return;
        const visible = applyInboxFilters(listed.items, filters, "");
        rememberNotificationProjects(
          listed.items.map(inboxNotificationProject),
        );
        const changed = notifications.current.observe(
          listed.items,
          inboxListCacheKey(projects, query),
          Object.keys(listed.errors) as InboxProvider[],
        );
        const selfAuthored = changed.filter((item) =>
          consumeInboxSelfActivity(item),
        );
        const selfAuthoredKeys = new Set(selfAuthored.map(inboxItemKey));
        const visibleKeys = new Set(visible.map(inboxItemKey));
        // The whole batch is observed even when every cue is suppressed. At most
        // one eligible project chimes; muted projects cannot consume that slot.
        for (const item of changed) {
          if (selfAuthoredKeys.has(inboxItemKey(item))) continue;
          if (!visibleKeys.has(inboxItemKey(item))) continue;
          if (playCue("inboxUnseen", inboxNotificationSubject(item))) break;
        }
        const entries = seenEntries(visible);
        entriesRef.current = entries;
        rememberInboxItems(listed.items.map((item) => ({
          key: inboxItemKey(item),
          updatedAt: item.updatedAt,
          projectPath: item.projectPath,
        })));
        seedInboxSeenIfNeeded(entries);
        const selfAuthoredEntries = entries.filter((entry) =>
          selfAuthoredKeys.has(entry.key),
        );
        if (selfAuthoredEntries.length > 0) {
          markInboxItemsSeen(selfAuthoredEntries);
        }
        for (const item of selfAuthored) {
          if (item.provider !== "github" || item.kind === "linear") continue;
          const updatedAt = Date.parse(item.updatedAt);
          if (!Number.isFinite(updatedAt)) continue;
          const key = linkedWorkItemUpdateKey({
            repo: item.repo,
            kind: item.kind,
            number: item.number,
          });
          for (const session of sessionsRef.current) {
            if (
              session.linkedWorkItem &&
              linkedWorkItemUpdateKey(session.linkedWorkItem) === key
            ) {
              markLinkedSessionUpdateSeen(session.id, updatedAt);
            }
          }
        }
        applyUnseen();

        const targets = linkedWorkItemTargets(sessionsRef.current);
        const targetKeys = new Set(targets.map((target) => target.key));
        const listedKeys = new Set<string>();
        const snapshots: Array<readonly [string, GithubWorkItem]> = [];
        for (const item of listed.items) {
          const kind = item.kind;
          if (
            item.provider !== "github" ||
            (kind !== "issue" && kind !== "pr")
          ) {
            continue;
          }
          const key = linkedWorkItemUpdateKey({
            repo: item.repo,
            kind,
            number: item.number,
          });
          if (!targetKeys.has(key)) continue;
          listedKeys.add(key);
          if (Number.isFinite(Date.parse(item.updatedAt))) {
            snapshots.push([key, { ...item, kind }]);
          }
        }
        if (snapshots.length > 0) {
          setWorkItems((current) => mergeInboxSnapshots(current, snapshots));
        }

        const now = Date.now();
        const missing = targets.filter((target) => {
          if (listedKeys.has(target.key)) return false;
          const last = fallbackFetchedAt.current.get(target.key) ?? 0;
          if (now - last < INBOX_FALLBACK_REFRESH_MS) return false;
          fallbackFetchedAt.current.set(target.key, now);
          return true;
        });
        if (missing.length > 0) {
          const fallback = await fetchInboxFallbackUpdates(cwd, missing);
          if (!cancelled && fallback.length > 0) {
            setWorkItems((current) => mergeInboxSnapshots(current, fallback));
          }
        }
        const githubError = listed.errors.github;
        if (githubError && isInboxRateLimitMessage(githubError)) {
          backoffUntil = Date.now() + INBOX_RATE_LIMIT_BACKOFF_MS;
        }
      } catch {
        // Leave the last known badges; back off so a dead backend or
        // offline machine is not hammered every 30s.
        failures += 1;
        backoffUntil = Date.now() + inboxBackoffMs(failures);
      } finally {
        pulling = false;
        if (!cancelled && pullAgain) {
          pullAgain = false;
          void pull(true);
        }
      }
    };

    void pull(false);
    const stopSelfActivity = subscribeInboxSelfActivity(() => void pull(true));
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      // Unforced: honors backoffUntil and the incremental `since` path, so
      // rate limits and dead backends actually quiet the poll. Forced pulls
      // stay reserved for explicit user refreshes.
      void pull(false);
    }, INBOX_POLL_MS);
    const onVis = () => {
      if (!document.hidden) void pull(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      stopSelfActivity();
    };
  }, [applyUnseen, cwd, recents, targetKey]);

  const updates = useMemo(
    () => linkedSessionUpdates(sessions, workItems, linkedSessionSeenAt),
    [sessions, workItems, linkedSeenRevision],
  );
  const linkedIndicators = useMemo(() => {
    const preferences = loadNotificationPreferences();
    return new Set(
      [...updates]
        .filter(([, update]) =>
          allowsProjectNotificationIndicator(
            inboxNotificationSubject({ ...update.item, provider: "github" }),
            preferences,
          ),
        )
        .map(([id]) => id),
    );
  }, [updates, notificationRevision]);
  return {
    unseen,
    linkedSessionUpdates: updates,
    linkedSessionUpdateIds: linkedIndicators,
  };
}

/** Badge-only compatibility wrapper for consumers that do not render sessions. */
export function useInboxUnseen(recents: RecentProject[], cwd: string): boolean {
  return useInboxActivity(recents, cwd, []).unseen;
}
