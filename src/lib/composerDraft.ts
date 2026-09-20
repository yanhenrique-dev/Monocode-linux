import { invoke } from "@tauri-apps/api/core";

const FLUSH_DELAY_MS = 500;

// Keyed by session id: multiple SessionPanes can be mounted at once (split
// view), so a single global pending slot would let one pane clobber or flush
// another session's draft. Each entry carries a revision so a superseded or
// in-flight write can never clear (or overwrite) newer text, and a tail chain
// so writes for one session hit the backend in save order.
type Entry = {
  text: string;
  timer: ReturnType<typeof setTimeout> | undefined;
  revision: number;
  tail: Promise<void>;
};
const pending = new Map<string, Entry>();

/**
 * Persist the composer draft for a session, debounced per session. Only the
 * latest text for a session is written; rapid keystrokes collapse into a
 * single `composer_draft_set` invoke. (porte #321)
 */
export function saveSessionDraft(sessionId: string, text: string): void {
  const prev = pending.get(sessionId);
  if (prev?.timer) clearTimeout(prev.timer);
  const revision = (prev?.revision ?? 0) + 1;
  pending.set(sessionId, {
    text,
    revision,
    tail: prev?.tail ?? Promise.resolve(),
    timer: setTimeout(() => {
      // Best-effort path: the entry stays pending on failure so an explicit
      // flush can retry it.
      void persist(sessionId, revision).catch(console.error);
    }, FLUSH_DELAY_MS),
  });
}

/** Write any pending drafts immediately (used when the pane unmounts). */
export function flushSessionDraft(): Promise<void> {
  const writes = [...pending.entries()].map(([sessionId, entry]) =>
    persist(sessionId, entry.revision),
  );
  return Promise.all(writes).then(() => undefined);
}

/** Drop any pending draft without writing it. */
export function discardPendingDraft(): void {
  for (const entry of pending.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  pending.clear();
}

export async function loadSessionDraft(sessionId: string): Promise<string> {
  try {
    return (await invoke<string | null>("composer_draft_get", { sessionId })) ?? "";
  } catch {
    // A failed load must never block the composer; treat as no draft.
    return "";
  }
}

async function persist(sessionId: string, revision: number): Promise<void> {
  const entry = pending.get(sessionId);
  if (!entry || entry.revision !== revision) return;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }
  // Serialize behind earlier writes; a rejection here propagates to the
  // explicit-flush caller while the chain itself stays alive for retries.
  const write = entry.tail.then(() =>
    invoke("composer_draft_set", { sessionId, text: entry.text }),
  );
  entry.tail = write.then(
    () => undefined,
    () => undefined,
  );
  await write;
  // Only the newest revision may clear the slot: an older write finishing
  // late must not drop text saved after it started.
  if (pending.get(sessionId)?.revision === revision) {
    pending.delete(sessionId);
  }
}
