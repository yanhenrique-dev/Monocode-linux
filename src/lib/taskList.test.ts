import { describe, expect, it } from "vitest";
import {
  isTaskListToolName,
  lastTaskBlock,
  legacyTaskListFromText,
  normalizeTaskListStatus,
  taskListActiveLabel,
  taskListFromToolInput,
  taskListProgressLabel,
  taskListText,
} from "./taskList";
import type { Block } from "./session";

describe("task lists", () => {
  it("normalizes provider status spellings", () => {
    expect(normalizeTaskListStatus("inProgress")).toBe("in_progress");
    expect(normalizeTaskListStatus("in_progress")).toBe("in_progress");
    expect(normalizeTaskListStatus("done")).toBe("completed");
    expect(normalizeTaskListStatus("skipped")).toBe("cancelled");
    expect(normalizeTaskListStatus("unknown")).toBe("pending");
  });

  it("normalizes todo-write tools from different harnesses", () => {
    expect(isTaskListToolName("TodoWrite")).toBe(true);
    expect(isTaskListToolName("update_todos")).toBe(true);
    expect(isTaskListToolName("edit")).toBe(false);
    expect(
      taskListFromToolInput("todowrite", {
        todos: [
          { id: "inspect", content: "Inspect", status: "completed" },
          { id: 2, activeForm: "Implementing", status: "inProgress" },
          { text: "Verify", status: "pending" },
        ],
      }),
    ).toEqual([
      { id: "inspect", text: "Inspect", status: "completed" },
      { id: "2", text: "Implementing", status: "in_progress" },
      { text: "Verify", status: "pending" },
    ]);
    expect(taskListFromToolInput("edit", { todos: [] })).toBeNull();
  });

  it("keeps a searchable text representation and reads legacy snapshots", () => {
    const items = [
      { text: "Inspect", status: "completed" as const },
      { text: "Implement", status: "in_progress" as const },
      { text: "Verify", status: "pending" as const },
    ];
    const text = taskListText(items);
    expect(text).toBe("[x] Inspect\n[~] Implement\n[ ] Verify");
    expect(legacyTaskListFromText(text)).toEqual(items);
    expect(legacyTaskListFromText("## Plan\n\n- Implement it")).toBeNull();
  });

  it("summarizes progress without counting cancelled tasks", () => {
    expect(
      taskListProgressLabel([
        { text: "One", status: "completed" },
        { text: "Two", status: "cancelled" },
      ]),
    ).toBe("Complete");
    expect(
      taskListProgressLabel([
        { text: "One", status: "completed" },
        { text: "Two", status: "pending" },
      ]),
    ).toBe("1 of 2");
  });

  it("prefers the in-progress item for the active legend", () => {
    expect(
      taskListActiveLabel([
        { text: "Done", status: "completed" },
        { text: "Building", status: "in_progress" },
        { text: "Later", status: "pending" },
      ]),
    ).toBe("Building");
  });

  it("falls back to the next pending item for the active legend", () => {
    expect(
      taskListActiveLabel([
        { text: "Done", status: "completed" },
        { text: "Later", status: "pending" },
      ]),
    ).toBe("Later");
  });

  it("returns null for the active legend once settled", () => {
    expect(
      taskListActiveLabel([
        { text: "Done", status: "completed" },
        { text: "Skipped", status: "cancelled" },
      ]),
    ).toBeNull();
  });

  it("selects the most recent non-empty task block", () => {
    const oldTasks = {
      id: "t1",
      role: "tasks",
      text: "",
      taskList: { items: [{ text: "Old", status: "completed" }] },
    } as Block;
    const user = { id: "u1", role: "user", text: "hi" } as Block;
    const empty = { id: "t2", role: "tasks", text: "" } as Block;
    const fresh = {
      id: "t3",
      role: "tasks",
      text: "",
      taskList: { items: [{ text: "New", status: "in_progress" }] },
    } as Block;
    expect(lastTaskBlock([])).toBeNull();
    expect(lastTaskBlock([user])).toBeNull();
    expect(lastTaskBlock([oldTasks, user, empty])).toBe(oldTasks);
    expect(lastTaskBlock([oldTasks, user, empty, fresh])).toBe(fresh);
  });
});

describe("lastTaskBlock", () => {
  const block = (id: string, items?: { text: string }[]): Block =>
    ({
      id,
      role: "tasks",
      text: "",
      ...(items ? { taskList: { items } } : {}),
    }) as Block;

  it("returns null without task blocks", () => {
    expect(lastTaskBlock([])).toBeNull();
    expect(
      lastTaskBlock([{ id: "u", role: "user", text: "hi" } as Block]),
    ).toBeNull();
  });

  it("skips empty task lists and prefers the latest block", () => {
    const first = block("first", [{ text: "One" }]);
    const empty = block("empty", []);
    const latest = block("latest", [{ text: "Two" }]);
    expect(lastTaskBlock([first, empty, latest])).toBe(latest);
    expect(lastTaskBlock([first, empty])).toBe(first);
  });
});
