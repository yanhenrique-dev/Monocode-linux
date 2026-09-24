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

  it("renews the expected revision after a queued write", async () => {
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session: { expectedRevision: number } },
      ) => {
        if (command !== "session_upsert") return undefined;
        expectedRevisions.push(args.session.expectedRevision);
        return {
          id: "s1",
          revision: expectedRevisions.length,
          cwd: "/tmp/project",
          harness: "cursor",
          model: "",
          runtimeMode: "supervised",
          title: "",
          createdAt: 1,
          updatedAt: 1,
        };
      },
    );
    const { upsertSession } = await loadStore();

    await Promise.all([
      upsertSession(session("s1")),
      upsertSession({ ...session("s1"), title: "later" }),
    ]);

    expect(expectedRevisions).toEqual([0, 1]);
  });

  it("uses the revision loaded with a session", async () => {
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session: { expectedRevision: number } },
      ) => {
        if (command === "session_get") return { ...session("s1"), revision: 7 };
        if (command === "session_upsert") {
          expectedRevisions.push(args.session.expectedRevision);
          return {
            id: "s1",
            revision: 8,
            cwd: "/tmp/project",
            harness: "cursor",
            model: "",
            runtimeMode: "supervised",
            title: "",
            createdAt: 1,
            updatedAt: 1,
          };
        }
        return undefined;
      },
    );
    const { getSession, upsertSession } = await loadStore();
    const loaded = await getSession("s1");

    await upsertSession(loaded!);

    expect(expectedRevisions).toEqual([7]);
  });

  it("refreshes revision after an external session update", async () => {
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session?: { expectedRevision: number } },
      ) => {
        if (command === "session_get") return { ...session("s1"), revision: 9 };
        if (command === "session_upsert" && args.session) {
          expectedRevisions.push(args.session.expectedRevision);
          return {
            id: "s1",
            revision: 10,
            cwd: "/tmp/project",
            harness: "cursor",
            model: "",
            runtimeMode: "supervised",
            title: "",
            createdAt: 1,
            updatedAt: 1,
          };
        }
        return undefined;
      },
    );
    const { refreshSessionRevision, upsertSession } = await loadStore();

    expect(await refreshSessionRevision("s1")).toBe(9);
    await upsertSession(session("s1"));

    expect(expectedRevisions).toEqual([9]);
  });

  it("uses worker revisions returned when a lead is deleted", async () => {
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session?: { expectedRevision: number } },
      ) => {
        if (command === "session_upsert" && args.session) {
          expectedRevisions.push(args.session.expectedRevision);
          return {
            id: "worker",
            revision: expectedRevisions.length,
            cwd: "/tmp/project",
            harness: "cursor",
            model: "",
            runtimeMode: "supervised",
            title: "",
            createdAt: 1,
            updatedAt: 1,
          };
        }
        if (command === "session_delete") {
          return [{ sessionId: "worker", revision: 7 }];
        }
        return undefined;
      },
    );
    const { deleteSession, upsertSession } = await loadStore();
    const worker = { ...session("worker"), orchestrationLeadId: "lead" };

    await upsertSession(worker);
    await deleteSession("lead");
    await upsertSession(worker);

    expect(expectedRevisions).toEqual([0, 7]);
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
