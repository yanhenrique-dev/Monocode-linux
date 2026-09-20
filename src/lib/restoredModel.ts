import { findModel, mergeModelSettings, resolveModel } from "./models";
import type { Block, Session } from "./session";

/**
 * Quit/reopen model preservation.
 *
 * Sessions are persisted with their exact model id, but the model catalog is
 * rebuilt asynchronously at boot. Re-resolving unconditionally (as the boot
 * catalog-refresh effect used to do) silently rewrites the session to another
 * model whenever the stored id does not resolve identically — renamed/removed
 * provider models, overlays still loading, changed opencode ids — and the
 * auto-continued turn then runs under a model the user never chose.
 *
 * `reconcileRestoredModel` keeps a persisted model verbatim whenever it still
 * exists in the catalog, and only falls back with a visible transcript note
 * when the id is truly gone.
 */

const MODEL_SWAP_NOTICE_MARK = "não está mais no catálogo; continuando com ";

export function modelSwapNoticeText(from: string, to: string): string {
  return `Modelo ${from} não está mais no catálogo; continuando com ${to}.`;
}

export function isModelSwapNotice(
  block: Pick<Block, "role" | "text"> | undefined,
): boolean {
  return (
    !!block &&
    block.role === "system" &&
    block.text.startsWith("Modelo ") &&
    block.text.includes(MODEL_SWAP_NOTICE_MARK)
  );
}

export type RestoredModelResult = {
  session: Session;
  /** Set only when the persisted id was replaced (once; never stacked). */
  swapped: { from: string; to: string } | null;
};

function sameRecord(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => right[key] === left[key])
  );
}

export function reconcileRestoredModel(session: Session): RestoredModelResult {
  // A previous reconciliation already noted a swap: never stack notes and
  // never re-swap on re-runs (e.g. StrictMode double effects).
  if (isModelSwapNotice(session.blocks[session.blocks.length - 1])) {
    return { session, swapped: null };
  }
  const known = findModel(session.model);
  if (known && known.harness === session.harness) {
    const modelSettings = mergeModelSettings(known, session.modelSettings);
    if (sameRecord(modelSettings, session.modelSettings)) {
      return { session, swapped: null };
    }
    return { session: { ...session, modelSettings }, swapped: null };
  }
  const resolved = resolveModel(session.harness, session.model);
  const modelSettings = mergeModelSettings(resolved, session.modelSettings);
  const settingsChanged = !sameRecord(modelSettings, session.modelSettings);
  const from = session.model;
  if (resolved.id === from) {
    if (!settingsChanged) return { session, swapped: null };
    return { session: { ...session, modelSettings }, swapped: null };
  }
  const next: Session = { ...session, model: resolved.id, modelSettings };
  // Sessions that never had a model (blank restored panes) are initialized,
  // not swapped: resolving them is silent by design.
  if (!from.trim()) return { session: next, swapped: null };
  const notice: Block = {
    id: crypto.randomUUID(),
    role: "system",
    text: modelSwapNoticeText(from, resolved.id),
  };
  return {
    session: { ...next, blocks: [...next.blocks, notice] },
    swapped: { from, to: resolved.id },
  };
}
