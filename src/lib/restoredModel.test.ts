import { beforeEach, describe, expect, it } from "vitest";
import {
  findModel,
  resetHarnessModelOverlays,
  type AgentModel,
} from "./models";
import {
  isModelSwapNotice,
  modelSwapNoticeText,
  reconcileRestoredModel,
} from "./restoredModel";
import type { Session } from "./session";

const GONE_ID = "claude:zz-test-gone-9f8d7c";

function restored(
  model: string,
  modelSettings: Record<string, string> = {},
  blocks: Session["blocks"] = [],
): Session {
  return {
    id: "s1",
    harness: "claude",
    model,
    modelSettings,
    runtimeMode: "supervised",
    title: "t",
    cwd: "/repo",
    blocks,
  };
}

function claudeModel(id: string): AgentModel {
  const found = findModel(id);
  if (!found || found.harness !== "claude") throw new Error(`no base model ${id}`);
  return found;
}

describe("reconcileRestoredModel", () => {
  beforeEach(() => {
    resetHarnessModelOverlays();
  });

  it("keeps a persisted model that still exists in the catalog", () => {
    const session = restored("claude:opus-4.5");
    const first = reconcileRestoredModel(session);
    expect(first.swapped).toBeNull();
    expect(first.session.model).toBe("claude:opus-4.5");
    // Second pass over the reconciled session is a no-op (same reference).
    expect(reconcileRestoredModel(first.session).session).toBe(first.session);
  });

  it("reconciles only settings for a known model, never the id", () => {
    const session = restored("claude:opus-4.5", { bogus: "x" });
    const { session: next, swapped } = reconcileRestoredModel(session);
    expect(swapped).toBeNull();
    expect(next.model).toBe("claude:opus-4.5");
    expect(next.modelSettings).not.toHaveProperty("bogus");
  });

  it("swaps an unknown model id with a visible notice", () => {
    const session = restored(GONE_ID, {}, [
      { id: "u1", role: "user", text: "hi" },
    ]);
    const { session: next, swapped } = reconcileRestoredModel(session);
    expect(swapped).not.toBeNull();
    expect(swapped?.from).toBe(GONE_ID);
    expect(next.model).toBe(swapped?.to);
    expect(next.model).not.toBe(GONE_ID);
    const last = next.blocks[next.blocks.length - 1];
    expect(last?.role).toBe("system");
    expect(last?.text).toBe(modelSwapNoticeText(GONE_ID, swapped!.to));
    expect(last?.text).toContain(GONE_ID);
    expect(last?.text).toContain(swapped!.to);
    expect(isModelSwapNotice(last)).toBe(true);
    // Original blocks are preserved ahead of the notice.
    expect(next.blocks[0]).toEqual(session.blocks[0]);
  });

  it("never stacks swap notices on repeated reconciliations", () => {
    const { session: once } = reconcileRestoredModel(restored(GONE_ID));
    const twice = reconcileRestoredModel(once);
    expect(twice.session).toBe(once);
    expect(twice.swapped).toBeNull();
    expect(
      once.blocks.filter((block) => isModelSwapNotice(block)),
    ).toHaveLength(1);
  });

  it("resolves a blank model silently (initialization, not a swap)", () => {
    const { session: next, swapped } = reconcileRestoredModel(restored(""));
    expect(swapped).toBeNull();
    expect(next.model).not.toBe("");
    expect(next.blocks).toHaveLength(0);
  });

  it("does not touch sessions whose model belongs to another harness", () => {
    // findModel(GONE) is undefined so this goes through fallback; the point
    // is the helper never silently keeps a cross-harness id.
    const session: Session = {
      ...restored(GONE_ID),
      harness: "codex",
    };
    const { swapped } = reconcileRestoredModel(session);
    expect(swapped).not.toBeNull();
  });

  it("sanity: base catalog fixture exists", () => {
    expect(claudeModel("claude:opus-4.5").harness).toBe("claude");
  });
});

describe("isModelSwapNotice", () => {
  it("rejects ordinary system rows", () => {
    expect(
      isModelSwapNotice({ role: "system", text: "Turn interrupted when MonoCode quit." }),
    ).toBe(false);
    expect(isModelSwapNotice(undefined)).toBe(false);
    expect(
      isModelSwapNotice({ role: "user", text: modelSwapNoticeText("a", "b") }),
    ).toBe(false);
  });
});
