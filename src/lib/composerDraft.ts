import { invoke } from "@tauri-apps/api/core";
import { DRAFT_FLUSH_DELAY_MS } from "./uiTimings";
import { reportError } from "./errors";

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
 * Texto vivo por sessão, só em memória. (porte #336)
 *
 * O draft persistido cobre reload e restart, mas fecha/reabre rápido do pane
 * perde teclas ainda no debounce: o flush do unmount é async e o remount
 * carrega do backend antes dele terminar. Este mapa vive fora do React e
 * responde na hora, sem round-trip. Até o texto vazio vira marcador, para o
 * remount não ressuscitar o valor persistido anterior; o marcador cai quando
 * o backend confirma a escrita.
 */
const live = new Map<string, string>();

export function getLiveDraft(sessionId: string): string | undefined {
  return live.get(sessionId);
}

export function setLiveDraft(sessionId: string, text: string): void {
  // Keep the empty marker until the backend confirms it: deleting on clear
  // lets a remount inside the persist window reload the previous text.
  // persist() drops the marker once "" is confirmed written.
  live.set(sessionId, text);
}

/**
 * Persist the composer draft for a session, debounced per session. Only the
 * latest text for a session is written; rapid keystrokes collapse into a
 * single `composer_draft_set` invoke. (porte #321)
 */
export function saveSessionDraft(sessionId: string, text: string): void {
  const prev = pending.get(sessionId);
  // Same text (e.g. effect refire on unrelated renders): don't churn the
  // debounce timer and revision for a no-op write.
  if (prev && prev.text === text) return;
  if (prev?.timer) clearTimeout(prev.timer);
  const revision = (prev?.revision ?? 0) + 1;
  pending.set(sessionId, {
    text,
    revision,
    tail: prev?.tail ?? Promise.resolve(),
    timer: setTimeout(() => {
      // Best-effort path: the entry stays pending on failure so an explicit
      // flush can retry it.
      void persist(sessionId, revision).catch(
        reportError("composerDraft.persist", { sessionId }),
      );
    }, DRAFT_FLUSH_DELAY_MS),
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
    // Backend caught up: an empty marker served its purpose, drop it so the
    // live map does not grow one entry per cleared session. Non-empty text
    // stays as the fast path for remounts.
    if (live.get(sessionId) === "") live.delete(sessionId);
  }
}
