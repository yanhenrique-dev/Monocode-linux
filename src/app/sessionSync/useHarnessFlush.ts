import { useCallback, useRef, type MutableRefObject } from "react";
import {
  applyHarnessEvent,
  type HarnessEvent,
} from "../../lib/harness";
import type { Session } from "../../lib/session";
import {
  cancelScheduledFlush,
  scheduleHarnessFlush,
  type ScheduledFlush,
} from "../workspaceEvents";

export type HarnessFlushApi = {
  flushHarnessEvents: () => void;
  enqueueHarnessEvent: (sessionId: string, event: HarnessEvent) => void;
  applyApprovalEvent: (sessionId: string, event: HarnessEvent) => void;
};

/**
 * Harness event batching (Fase 3c): tokens arrive many times per frame.
 * Extracted from useSessionSync with identical semantics: swap + reduce +
 * no-op guard, rAF flush via scheduleHarnessFlush.
 */
export function useHarnessFlush(
  sessionsRef: MutableRefObject<Session[]>,
  setSessions: (next: Session[]) => void,
): HarnessFlushApi {
  const harnessQueued = useRef(new Map<string, HarnessEvent[]>());
  const harnessFlush = useRef<ScheduledFlush | null>(null);

  const flushHarnessEvents = useCallback(() => {
    cancelScheduledFlush(harnessFlush.current);
    harnessFlush.current = null;
    const batches = harnessQueued.current;
    if (batches.size === 0) return;
    harnessQueued.current = new Map();
    const prev = sessionsRef.current;
    const next = prev.map((session) => {
      const events = batches.get(session.id);
      return events ? events.reduce(applyHarnessEvent, session) : session;
    });
    if (!next.some((session, index) => session !== prev[index])) return;
    sessionsRef.current = next;
    setSessions(next);
  }, [sessionsRef, setSessions]);

  const applyApprovalEvent = useCallback(
    (sessionId: string, event: HarnessEvent) => {
      const queued = harnessQueued.current.get(sessionId) ?? [];
      harnessQueued.current.delete(sessionId);
      const events = [...queued, event];
      const prev = sessionsRef.current;
      const next = prev.map((session) =>
        session.id === sessionId
          ? events.reduce(applyHarnessEvent, session)
          : session,
      );
      if (!next.some((session, index) => session !== prev[index])) return;
      sessionsRef.current = next;
      setSessions(next);
    },
    [sessionsRef, setSessions],
  );

  const enqueueHarnessEvent = useCallback(
    (sessionId: string, event: HarnessEvent) => {
      if (
        event.type === "approval.requested" ||
        event.type === "approval.resolved" ||
        event.type === "question.asked" ||
        event.type === "question.resolved"
      ) {
        applyApprovalEvent(sessionId, event);
        return;
      }
      const queued = harnessQueued.current;
      const events = queued.get(sessionId);
      if (events) events.push(event);
      else queued.set(sessionId, [event]);
      if (!harnessFlush.current) {
        harnessFlush.current = scheduleHarnessFlush(flushHarnessEvents);
      }
    },
    [applyApprovalEvent, flushHarnessEvents],
  );

  return { flushHarnessEvents, enqueueHarnessEvent, applyApprovalEvent };
}
