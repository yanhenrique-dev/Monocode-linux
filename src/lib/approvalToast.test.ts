import { describe, expect, it } from "vitest";
import {
  approvalNotices,
  pendingApprovalForSession,
} from "./approvalToast";
import { newSession, type Block } from "./session";

function block(role: Block["role"], approval?: Block["approval"]): Block {
  return {
    id: crypto.randomUUID(),
    role,
    text: role === "tool" ? "Run command" : "Approve?",
    ...(role === "tool"
      ? { tool: { title: "Run command", kind: "execute" } }
      : {}),
    ...(approval ? { approval } : {}),
  };
}

describe("pendingApprovalForSession", () => {
  it("never toasts a worker approval, which its lead answers instead", () => {
    const worker = {
      ...newSession(),
      id: "worker",
      orchestrationLeadId: "lead",
      blocks: [block("tool", { requestId: 42 })],
    };
    expect(approvalNotices([worker])).toEqual([]);
    // The same approval on an ordinary session still reaches the user.
    const solo = { ...worker, orchestrationLeadId: undefined };
    expect(approvalNotices([solo])[0]?.sessionId).toBe("worker");
  });
  it("returns the latest undecided approval", () => {
    const session = newSession();
    session.blocks = [
      block("tool", { requestId: 1, decided: "allow" }),
      block("tool", { requestId: 2 }),
    ];
    const pending = pendingApprovalForSession(session);
    expect(pending?.requestId).toBe(2);
    expect(pending?.label).toBe("Shell");
    expect(pending?.kind).toBe("approval");
  });

  it("prefers a parked clarifying question over a tool approval", () => {
    const session = newSession();
    session.blocks = [block("tool", { requestId: 2 })];
    session.pendingQuestion = {
      requestId: 9,
      title: "Which file?",
      questions: [
        {
          id: "q1",
          prompt: "Which file?",
          multiSelect: false,
          allowCustom: true,
          options: [{ id: "a.ts", label: "a.ts" }],
        },
      ],
    };
    const pending = pendingApprovalForSession(session);
    expect(pending?.requestId).toBe(9);
    expect(pending?.kind).toBe("question");
    expect(pending?.label).toBe("Which file?");
  });

  it("toasts an opencode permission approval without a tool call id", () => {
    // permission.asked without a callID appends a bare tool block; the
    // corner toast must still fire for it.
    const session = {
      ...newSession(),
      id: "opencode-1",
      harness: "opencode" as const,
      blocks: [
        {
          id: crypto.randomUUID(),
          role: "tool" as const,
          text: "Edit file",
          tool: { title: "Edit file", kind: "edit" },
          approval: { requestId: 7 },
        },
      ],
    };
    const notices = approvalNotices([session]);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.kind).toBe("approval");
    expect(notices[0]?.requestId).toBe(7);
    expect(notices[0]?.label.length).toBeGreaterThan(0);
  });
});

describe("approvalNotices", () => {
  it("includes approvals in the focused conversation, not just other tabs", () => {
    // Regression: the toast used to stay hidden while its session was
    // focused, so a request looked like nothing happened until the user
    // switched sessions. The inline Allow/Deny row is easy to miss; the
    // toast is the prominent surface everywhere now.
    const focused = newSession();
    focused.blocks = [block("tool", { requestId: 1 })];
    const other = newSession();
    other.blocks = [block("tool", { requestId: 2 })];

    expect(
      approvalNotices([focused, other]).map((notice) => notice.sessionId),
    ).toEqual([focused.id, other.id]);
  });

  it("shows approvals from every pane, focused or not", () => {
    const left = newSession();
    left.blocks = [block("tool", { requestId: 1 })];
    const right = newSession();
    right.blocks = [block("tool", { requestId: 2 })];

    expect(
      approvalNotices([left, right]).map((notice) => notice.sessionId),
    ).toEqual([left.id, right.id]);
  });
});
