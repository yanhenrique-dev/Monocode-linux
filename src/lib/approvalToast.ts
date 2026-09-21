import { leafIds, type WorkspaceTab } from "./layout";
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

/** True when conversation pane for session focused and active. */
export function isSessionConversationFocused(
  sessionId: string,
  activeTabId: string,
  tabs: WorkspaceTab[],
  composerFocused: boolean,
): boolean {
  const tab = tabs.find((entry) => entry.id === activeTabId);
  if (!tab) return false;
  if (!leafIds(tab.layout).includes(sessionId)) return false;
  if (tab.focusedId !== sessionId) return false;
  return composerFocused;
}

/**
 * Pending approvals/questions in background sessions only. Focused
 * conversation uses inline Allow/Deny row on tool line itself (ex: Find),
 * never corner popup. Popup exists only when user cannot see inline row.
 */
export function hiddenApprovalNotices(
  sessions: Session[],
  activeTabId: string,
  tabs: WorkspaceTab[],
  composerFocused: boolean,
): Array<PendingApprovalNotice & { session: Session }> {
  const notices: Array<PendingApprovalNotice & { session: Session }> = [];
  for (const session of sessions) {
    if (session.inboxAsk) continue;
    // An orchestrated worker answers to its lead, never to the user directly.
    if (session.orchestrationLeadId) continue;
    const pending = pendingApprovalForSession(session);
    if (!pending) continue;
    if (
      isSessionConversationFocused(
        session.id,
        activeTabId,
        tabs,
        composerFocused,
      )
    ) {
      continue;
    }
    notices.push({ ...pending, session });
  }
  return notices;
}
