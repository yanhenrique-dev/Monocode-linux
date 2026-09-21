import { useEffect, useState } from "react";
import { sameProjectPath } from "./recents";

const KEY = "monocode.inboxSeen";
const LEGACY_KEY = "monocode.inboxSeenAt";

export type InboxSeenEntry = {
  key: string;
  updatedAt: string;
};

type SeenMap = Record<string, number>;

type SeenStore = {
  seeded: boolean;
  items: SeenMap;
};

type Listener = () => void;

const listeners = new Set<Listener>();
const knownItems = new Map<string, InboxSeenEntry & { projectPaths: string[] }>();
/** Cap for the in-memory activity snapshot shared across views. */
const MAX_KNOWN_ITEMS = 5000;
/** Cap for persisted read marks; the oldest stamps go first. */
const MAX_SEEN_ITEMS = 2000;

/** Share fetched activity across the Inbox view, background poll, and rail menu. */
export function rememberInboxItems(entries: readonly (InboxSeenEntry & { projectPath: string })[]) {
  let changed = false;
  for (const entry of entries) {
    const previous = knownItems.get(entry.key);
    const projectPaths = previous?.projectPaths ?? [];
    const knownPath = projectPaths.some((path) => sameProjectPath(path, entry.projectPath));
    const newer = !previous || inboxUpdatedAt(entry) > inboxUpdatedAt(previous);
    if (knownPath && !newer) continue;
    knownItems.set(entry.key, {
      key: entry.key,
      updatedAt: newer ? entry.updatedAt : previous!.updatedAt,
      projectPaths: knownPath ? projectPaths : [...projectPaths, entry.projectPath],
    });
    changed = true;
  }
  while (knownItems.size > MAX_KNOWN_ITEMS) {
    const oldest = knownItems.keys().next();
    if (oldest.done) break;
    knownItems.delete(oldest.value);
  }
  if (changed) notifyInboxSeen();
}

export function knownInboxEntries(projectPaths: readonly string[]): InboxSeenEntry[] {
  return [...knownItems.values()].filter((entry) =>
    entry.projectPaths.some((knownPath) =>
      !knownPath || projectPaths.some((path) => sameProjectPath(path, knownPath)),
    ),
  );
}

export function clearKnownInboxItems() {
  knownItems.clear();
  notifyInboxSeen();
}

export function inboxUpdatedAt(item: { updatedAt: string }): number {
  const value = Date.parse(item.updatedAt);
  return Number.isFinite(value) ? value : 0;
}

function notifyInboxSeen() {
  for (const listener of listeners) listener();
}

function isSeenMap(value: unknown): value is SeenMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => typeof entry === "number" && Number.isFinite(entry),
  );
}

function loadInboxSeenStore(): SeenStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { seeded: false, items: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { seeded: false, items: {} };
    }
    const record = parsed as { seeded?: unknown; items?: unknown };
    if (typeof record.seeded === "boolean" && isSeenMap(record.items)) {
      return { seeded: record.seeded, items: record.items };
    }
    if (isSeenMap(parsed)) {
      return { seeded: true, items: parsed };
    }
    return { seeded: false, items: {} };
  } catch {
    return { seeded: false, items: {} };
  }
}

/** Drop the oldest read marks past the cap, keeping the newest stamps. */
function pruneSeenMap(items: SeenMap): SeenMap {
  const keys = Object.keys(items);
  if (keys.length <= MAX_SEEN_ITEMS) return items;
  const ordered = keys.sort((a, b) => (items[a] ?? 0) - (items[b] ?? 0));
  const next: SeenMap = {};
  for (const key of ordered.slice(keys.length - MAX_SEEN_ITEMS)) {
    next[key] = items[key]!;
  }
  return next;
}

function saveInboxSeenStore(store: SeenStore): boolean {
  const pruned = { ...store, items: pruneSeenMap(store.items) };
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ seeded: pruned.seeded, items: pruned.items }),
    );
  } catch {
    // A rejected write leaves state untouched: the item stays unseen, the
    // caller reports the error, and retry can still land the mark.
    return false;
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Legacy cleanup must not turn a successful write into a failure.
  }
  notifyInboxSeen();
  return true;
}

function mapFrom(items: readonly InboxSeenEntry[]): SeenMap {
  const next: SeenMap = {};
  for (const item of items) {
    if (!item.key) continue;
    next[item.key] = inboxUpdatedAt(item);
  }
  return next;
}

function mergeSeen(items: SeenMap, entry: InboxSeenEntry): SeenMap {
  if (!entry.key) return items;
  return {
    ...items,
    [entry.key]: Math.max(items[entry.key] ?? 0, inboxUpdatedAt(entry)),
  };
}

function entryIsUnseen(entry: InboxSeenEntry, items: SeenMap): boolean {
  if (!entry.key) return false;
  const was = items[entry.key];
  if (was == null) return true;
  return inboxUpdatedAt(entry) > was;
}

/**
 * Freshest stamp worth remembering for a read mark. The clicked card may
 * render a stale snapshot while a poll is in flight, so the freshest known
 * list entry wins; the click time itself is the floor, so a stale snapshot
 * can never resurrect the unread dot on the next poll. Genuinely newer
 * remote activity (timestamp above now) still marks the item unseen again.
 */
export function resolveSeenMark(
  clickUpdatedAt: string,
  freshUpdatedAt: string | undefined,
  now: number = Date.now(),
): string {
  const stamp = Math.max(
    inboxUpdatedAt({ updatedAt: clickUpdatedAt }),
    freshUpdatedAt ? inboxUpdatedAt({ updatedAt: freshUpdatedAt }) : 0,
    now,
  );
  return new Date(stamp).toISOString();
}

export function inboxSeenIsSeeded(): boolean {
  return loadInboxSeenStore().seeded;
}

export function isInboxEntryUnseen(entry: InboxSeenEntry): boolean {
  const store = loadInboxSeenStore();
  if (!store.seeded) return false;
  return entryIsUnseen(entry, store.items);
}

export function markInboxItemSeen(entry: InboxSeenEntry) {
  const store = loadInboxSeenStore();
  saveInboxSeenStore({
    ...store,
    items: mergeSeen(store.items, entry),
  });
}

export function markInboxItemsSeen(entries: readonly InboxSeenEntry[]): boolean {
  const store = loadInboxSeenStore();
  return saveInboxSeenStore({
    ...store,
    items: entries.reduce(mergeSeen, store.items),
  });
}

/** First snapshot of the list is remembered so existing items do not badge. */
export function seedInboxSeenIfNeeded(items: readonly InboxSeenEntry[]) {
  const store = loadInboxSeenStore();
  if (store.seeded || items.length === 0) return;
  saveInboxSeenStore({
    seeded: true,
    items: { ...store.items, ...mapFrom(items) },
  });
}

export function inboxHasUnseenItems(items: readonly InboxSeenEntry[]): boolean {
  const store = loadInboxSeenStore();
  if (!store.seeded) return false;
  return items.some((item) => entryIsUnseen(item, store.items));
}

export function subscribeInboxSeen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInboxSeenTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeInboxSeen(() => setTick((value) => value + 1)), []);
  return tick;
}
