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
    let upserts = 0;
    const summary = (revision: number) => ({
      id: "worker",
      revision,
      cwd: "/tmp/project",
      harness: "cursor",
      model: "",
      runtimeMode: "supervised",
      title: "",
      createdAt: 1,
      updatedAt: 1,
    });
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command !== "session_upsert") return Promise.resolve();
      upserts += 1;
      return upserts === 1 ? firstWrite.promise : Promise.resolve(summary(upserts));
    });
    const { deleteSession, upsertSession } = await loadStore();
    const worker = { ...session("worker"), orchestrationLeadId: "lead" };
    const writing = upsertSession(worker);
    await vi.waitFor(() => expect(commands).toEqual(["session_upsert"]));
    const queued = upsertSession(worker);
    const deleting = deleteSession("lead");
    expect(commands).toEqual(["session_upsert"]);
    firstWrite.resolve(summary(1));
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
    let upserts = 0;
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command !== "session_upsert") return Promise.resolve();
      upserts += 1;
      return upserts === 1
        ? firstWrite.promise
        : Promise.resolve({
            id: "s1",
            revision: 2,
            cwd: "/tmp/project",
            harness: "cursor",
            model: "",
            runtimeMode: "supervised",
            title: "",
            createdAt: 1,
            updatedAt: 1,
          });
    });
    const { deleteSession, upsertSession } = await loadStore();

    const writing = upsertSession(session("s1"));
    await vi.waitFor(() => expect(commands).toEqual(["session_upsert"]));
    const lateWrite = upsertSession({ ...session("s1"), title: "late" });
    const deleting = deleteSession("s1");

    expect(commands).toEqual(["session_upsert"]);
    firstWrite.resolve({
      id: "s1",
      revision: 1,
      cwd: "/tmp/project",
      harness: "cursor",
      model: "",
      runtimeMode: "supervised",
      title: "",
      createdAt: 1,
      updatedAt: 1,
    });
    await Promise.all([writing, lateWrite, deleting]);

    expect(commands).toEqual([
      "session_upsert",
      "session_delete",
    ]);
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

  it("does not attach current revision to an unknown transferred snapshot", async () => {
    const commands: string[] = [];
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session?: { expectedRevision: number } },
      ) => {
        commands.push(command);
        if (command === "session_upsert" && args.session) {
          expectedRevisions.push(args.session.expectedRevision);
          return {
            id: "s1",
            revision: 1,
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
    const { upsertSession } = await loadStore();

    await upsertSession(session("s1"));

    expect(commands).toEqual(["session_upsert"]);
    expect(expectedRevisions).toEqual([0]);
  });

  it("uses the revision carried by a transferred session", async () => {
    const expectedRevisions: number[] = [];
    mocks.invoke.mockImplementation(
      async (
        command: string,
        args: { session?: { expectedRevision: number } },
      ) => {
        if (command === "session_upsert" && args.session) {
          expectedRevisions.push(args.session.expectedRevision);
          return {
            id: "s1",
            revision: 7,
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
    const { upsertSession } = await loadStore();

    await upsertSession({ ...session("s1"), revision: 6 });

    expect(expectedRevisions).toEqual([6]);
  });

  it("does not retry a rejected stale write", async () => {
    const commands: string[] = [];
    let lookups = 0;
    mocks.invoke.mockImplementation(async (command: string) => {
      commands.push(command);
      if (command === "session_get") {
        lookups += 1;
        return { ...session("s1"), revision: 5 };
      }
      if (command === "session_upsert") {
        throw new Error(
          "Session changed in another window (expected revision 4, current 5)",
        );
      }
      return undefined;
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const { upsertSession } = await loadStore();

      await expect(
        upsertSession({ ...session("s1"), revision: 4 }),
      ).rejects.toThrow("Session changed in another window");
      expect(lookups).toBe(1);
      await expect(upsertSession(session("s1"))).rejects.toThrow(
        "Reload conversation s1",
      );
      expect(commands.filter((command) => command === "session_upsert")).toHaveLength(1);
    } finally {
      consoleError.mockRestore();
    }
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
    await upsertSession({ ...worker, revision: 7 });

    expect(expectedRevisions).toEqual([0, 7]);
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

  it("prefers cached revision over a stale snapshot copy", async () => {
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
    const { applySessionRevisions, deleteSession, upsertSession } =
      await loadStore();
    const worker = { ...session("worker"), orchestrationLeadId: "lead" };

    await upsertSession(worker);
    const staleCopy = { ...worker, revision: 0 };
    await deleteSession("lead");
    applySessionRevisions([{ sessionId: "worker", revision: 7 }]);
    await upsertSession(staleCopy);

    expect(expectedRevisions).toEqual([0, 7]);
  });

  it("archives only after the final active-turn snapshot is durable", async () => {
    const firstWrite = deferred<unknown>();
    const commands: string[] = [];
    let upserts = 0;
    mocks.invoke.mockImplementation((command: string) => {
      commands.push(command);
      if (command === "session_upsert") {
        upserts += 1;
        if (upserts === 1) return firstWrite.promise;
      }
      return Promise.resolve({
        id: "s1",
        revision: upserts + 1,
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
      revision: 1,
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
