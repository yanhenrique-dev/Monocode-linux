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
const writeChains = new Map<string, Promise<void>>();
const discarded = new Set<string>();
let flushPromise: Promise<void> | null = null;

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

export function activateSessionDraft(sessionId: string): void {
  discarded.delete(sessionId);
}

/**
 * Persist the composer draft for a session, debounced per session. Only the
 * latest text for a session is written; rapid keystrokes collapse into a
 * single `composer_draft_set` invoke. (porte #321)
 */
export function saveSessionDraft(sessionId: string, text: string): void {
  if (discarded.has(sessionId)) return;
  const prev = pending.get(sessionId);
  if (prev && prev.text === text) return;
  if (prev?.timer) clearTimeout(prev.timer);
  const revision = (prev?.revision ?? 0) + 1;
  pending.set(sessionId, {
    text,
    revision,
    tail: writeChains.get(sessionId) ?? prev?.tail ?? Promise.resolve(),
    timer: setTimeout(() => {
      void persist(sessionId, revision).catch(
        reportError("composerDraft.persist", { sessionId }),
      );
    }, DRAFT_FLUSH_DELAY_MS),
  });
}

export function flushSessionDraft(): Promise<void> {
  if (flushPromise) return flushPromise;
  const run = (async () => {
    while (true) {
      const entries = [...pending.entries()];
      if (entries.length === 0) {
        const chains = [...writeChains.values()];
        if (chains.length === 0) return;
        await Promise.all(chains);
        continue;
      }
      await Promise.all(
        entries.map(([sessionId, entry]) => persist(sessionId, entry.revision)),
      );
    }
  })();
  const settled = run.finally(() => {
    if (flushPromise === settled) flushPromise = null;
  });
  flushPromise = settled;
  return settled;
}

export function discardPendingDraft(): void {
  for (const entry of pending.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  pending.clear();
}

export async function discardSessionDraft(sessionId: string): Promise<void> {
  discarded.add(sessionId);
  const entry = pending.get(sessionId);
  if (entry?.timer) clearTimeout(entry.timer);
  pending.delete(sessionId);
  live.delete(sessionId);
  await writeChains.get(sessionId);
}

export async function loadSessionDraft(sessionId: string): Promise<string> {
  try {
    const result: unknown = await invoke("composer_draft_get", { sessionId });
    return typeof result === "string" ? result : "";
  } catch {
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
  const previous = writeChains.get(sessionId) ?? entry.tail;
  const write = previous.catch(() => undefined).then(() => {
    if (discarded.has(sessionId)) return undefined;
    return invoke("composer_draft_set", { sessionId, text: entry.text });
  });
  const settled = write.then(
    () => undefined,
    () => undefined,
  );
  writeChains.set(sessionId, settled);
  entry.tail = settled;
  try {
    await write;
  } finally {
    if (writeChains.get(sessionId) === settled) writeChains.delete(sessionId);
  }
  if (discarded.has(sessionId)) {
    if (pending.get(sessionId)?.revision === revision) {
      pending.delete(sessionId);
    }
    return;
  }
  if (pending.get(sessionId)?.revision === revision) {
    pending.delete(sessionId);
    if (live.get(sessionId) === "") live.delete(sessionId);
  }
}
