import type { Block, Session } from "./session";
import { toolCallLabel } from "./toolCallLabel";

export type PendingApprovalNotice = {
  sessionId: string;
  requestId: number;
  label: string;
  kind: "approval" | "question";
  block?: Block;
};

/** Latest undecided approval or clarifying question in a session, if any. */
export function pendingApprovalForSession(
  session: Session,
): PendingApprovalNotice | null {
  if (session.pendingQuestion) {
    return {
      sessionId: session.id,
      requestId: session.pendingQuestion.requestId,
      label:
        session.pendingQuestion.title ||
        session.pendingQuestion.questions[0]?.prompt ||
        "Question",
      kind: "question",
    };
  }
  for (let i = session.blocks.length - 1; i >= 0; i--) {
    const block = session.blocks[i];
    if (!block.approval || block.approval.decided) continue;
    return {
      sessionId: session.id,
      requestId: block.approval.requestId,
      label: toolCallLabel(block, session.cwd),
      kind: "approval",
      block,
    };
  }
  return null;
}

/**
 * Every session with a pending approval or question, including the focused
 * one. The toast used to stay hidden while its conversation was focused, on
 * the assumption the inline Allow/Deny row speaks for itself — but the row
 * is easy to miss (out of view, subtle), so the request looked like nothing
 * happened until the user switched sessions. The toast is the prominent
 * surface everywhere now; it resolves the same request the inline row does.
 */
export function approvalNotices(
  sessions: Session[],
): Array<PendingApprovalNotice & { session: Session }> {
  const notices: Array<PendingApprovalNotice & { session: Session }> = [];
  for (const session of sessions) {
    if (session.inboxAsk) continue;
    // An orchestrated worker answers to its lead, never to the user directly.
    if (session.orchestrationLeadId) continue;
    const pending = pendingApprovalForSession(session);
    if (!pending) continue;
    notices.push({ ...pending, session });
  }
  return notices;
}
