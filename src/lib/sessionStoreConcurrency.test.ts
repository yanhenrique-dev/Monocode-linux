import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function loadStore() {
  vi.resetModules();
  return import("./sessionStore");
}

function session(id: string) {
  return {
    id,
    cwd: "/tmp/project",
    harness: "cursor" as const,
    model: "",
    modelSettings: {},
    runtimeMode: "supervised" as const,
    title: "",
    blocks: [{ id: "user", role: "user" as const, text: "hello" }],
    busy: true,
  };
}

afterEach(() => {
  mocks.invoke.mockReset();
});

describe("session persistence concurrency", () => {
  it("drains worker writes before deleting a lead and strips ownership from later snapshots", async () => {
    const firstWrite = deferred<unknown>();
    const commands: string[] = [];
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      return command === "session_upsert" && commands.length === 1
        ? firstWrite.promise
        : Promise.resolve();
    });
    const { deleteSession, upsertSession } = await loadStore();
    const worker = { ...session("worker"), orchestrationLeadId: "lead" };
    const writing = upsertSession(worker);
    await vi.waitFor(() => expect(commands).toEqual(["session_upsert"]));
    const queued = upsertSession(worker);
    const deleting = deleteSession("lead");
    expect(commands).toEqual(["session_upsert"]);
    firstWrite.resolve(undefined);
    await Promise.all([writing, queued, deleting]);
    expect(commands).toEqual([
      "session_upsert",
      "session_upsert",
      "session_delete",
    ]);
    await upsertSession(worker);
    for (const [, args] of mocks.invoke.mock.calls
      .slice(1)
      .filter(([command]) => command === "session_upsert")) {
      expect(args.session.blocks[0].orchestrationLeadId).toBeUndefined();
    }
  });

  it("waits for an in-flight draft write before deleting its session", async () => {
    const draftWrite = deferred<void>();
    const commands: string[] = [];
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      return command === "composer_draft_set"
        ? draftWrite.promise
        : Promise.resolve();
    });
    const { deleteSession } = await loadStore();
    const { flushSessionDraft, saveSessionDraft } = await import(
      "./composerDraft"
    );
    saveSessionDraft("s-draft", "stale");
    const flushing = flushSessionDraft();
    await vi.waitFor(() => expect(commands).toEqual(["composer_draft_set"]));
    const deleting = deleteSession("s-draft");
    await Promise.resolve();
    expect(commands).toEqual(["composer_draft_set"]);
    draftWrite.resolve();
    await Promise.all([flushing, deleting]);
    expect(commands).toEqual(["composer_draft_set", "session_delete"]);
  });

  it("reactivates draft persistence when session deletion fails", async () => {
    const commands: string[] = [];
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      return command === "session_delete"
        ? Promise.reject(new Error("delete failed"))
        : Promise.resolve();
    });
    const { deleteSession } = await loadStore();
    const { flushSessionDraft, saveSessionDraft } = await import(
      "./composerDraft"
    );
    saveSessionDraft("s-failed", "stale");
    await expect(deleteSession("s-failed")).rejects.toThrow("delete failed");
    saveSessionDraft("s-failed", "new");
    await flushSessionDraft();
    expect(commands).toEqual(["session_delete", "composer_draft_set"]);
  });

  it("serializes deletion after an active write and drops a queued late upsert", async () => {
    const firstWrite = deferred<unknown>();
    const commands: string[] = [];
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "session_upsert") return firstWrite.promise;
      return Promise.resolve();
    });
    const { deleteSession, upsertSession } = await loadStore();

    const writing = upsertSession(session("s1"));
    await vi.waitFor(() => expect(commands).toEqual(["session_upsert"]));
    const lateWrite = upsertSession({ ...session("s1"), title: "late" });
    const deleting = deleteSession("s1");

    expect(commands).toEqual(["session_upsert"]);
    firstWrite.resolve({
      id: "s1",
      cwd: "/tmp/project",
      harness: "cursor",
      model: "",
      runtimeMode: "supervised",
      title: "",
      createdAt: 1,
      updatedAt: 1,
    });
    await Promise.all([writing, lateWrite, deleting]);

    expect(commands).toEqual(["session_upsert", "session_delete"]);
  });

  it("archives only after the final active-turn snapshot is durable", async () => {
    const firstWrite = deferred<unknown>();
    const commands: string[] = [];
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "session_upsert" && commands.length === 1) {
        return firstWrite.promise;
      }
      return Promise.resolve({
        id: "s1",
        cwd: "/tmp/project",
        harness: "cursor",
        model: "",
        runtimeMode: "supervised",
        title: "",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const { setSessionArchived, upsertSession } = await loadStore();

    const writing = upsertSession(session("s1"));
    await vi.waitFor(() => expect(commands).toEqual(["session_upsert"]));
    const finalSnapshot = upsertSession({
      ...session("s1"),
      blocks: [
        { id: "user", role: "user", text: "hello" },
        { id: "assistant", role: "assistant", text: "final buffered output" },
      ],
    });
    const archiving = setSessionArchived("s1", true);

    expect(commands).toEqual(["session_upsert"]);
    firstWrite.resolve({
      id: "s1",
      cwd: "/tmp/project",
      harness: "cursor",
      model: "",
      runtimeMode: "supervised",
      title: "",
      createdAt: 1,
      updatedAt: 1,
    });
    await Promise.all([writing, finalSnapshot, archiving]);

    expect(commands).toEqual([
      "session_upsert",
      "session_upsert",
      "session_set_archived",
    ]);
    expect(mocks.invoke.mock.calls[1]?.[1]).toMatchObject({
      session: {
        blocks: [{ text: "hello" }, { text: "final buffered output" }],
      },
    });
  });
});
