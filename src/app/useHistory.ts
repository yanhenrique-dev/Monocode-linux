import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { message } from "@tauri-apps/plugin-dialog";
import {
  deleteSession,
  getSession,
  markSessionConflicts,
  persistFingerprint,
  samePersistedSession,
  applySessionRevisionsToSessions,
  setSessionArchived,
  setSessionPinned,
  shouldPersistSession,
  upsertSession,
} from "../lib/sessionStore";
import {
  mergeHistorySummary,
  mergeProjectHistorySummary,
  summaryFromSession,
} from "../lib/sessionHistory";
import {
  newAvailableDefaultSession,
  newSessionForSeed,
  formatSessionTitle,
  sessionDisplayTitle,
  type HarnessId,
  type Session,
} from "../lib/session";
import { availableHarnessIds } from "../lib/harness/availability";
import { newTab } from "../lib/layout";
import { forgetHarnessSession } from "../lib/harness";
import { orchestrator } from "../lib/orchestration";
import { flushSessionCheckpoint } from "../lib/checkpoint";
import { isBlankSession } from "../lib/projectReturn";
import { isFilesystemTab, leafIds, type PaneEdge } from "../lib/layout";
import {
  applyPlaceSessionOnPane,
  applyPlaceTabOnPane,
  type WorkspaceTabCloseScope,
} from "../lib/workspaceTabGroups";
import { markLinkedSessionUpdateSeen } from "../lib/linkedSessionSeen";
import { runSessionRemoval } from "../lib/sessionRemoval";
import { sessionChildHarnesses } from "../lib/handoff";
import { confirmDiscardUnsaved } from "./workspaceEvents";
import { filesInWorkspaceTabs } from "./tabHelpers";
import { confirmCloseTerminals } from "../lib/terminalClose";
import { archiveFocusedSession } from "../lib/archiveShortcut";
import { releaseOrchestrationWorker } from "../lib/orchestrationWorkspace";
import { rememberLoadedSession } from "../lib/sessionCache";
import type { SessionSummary } from "../lib/sessionStore";
import type { WorktreeDeletionHooks } from "./useWorktrees";
import type { SidebarTabId } from "../lib/appearance";
import type { LinkedSessionUpdate } from "../lib/linkedSessionUpdates";
import { useSessionReminders } from "../hooks/useSessionReminders";
import { rememberProject, type RecentProject } from "../lib/recents";

export interface HistoryDeps {
  sessions: Session[];
  history: SessionSummary[];
  activeTabId: string;
  projectCwd: string;
  sidebarCwd: string;
  tabCloseScope: WorkspaceTabCloseScope;
  sessionsRef: MutableRefObject<Session[]>;
  tabsRef: MutableRefObject<import("../lib/layout").WorkspaceTab[]>;
  dirtyFilesRef: MutableRefObject<Set<string>>;
  activeTabIdRef: MutableRefObject<string>;
  linkedSessionUpdatesRef: MutableRefObject<ReadonlyMap<string, LinkedSessionUpdate>>;
  lastPersisted: MutableRefObject<Map<string, string>>;
  projectCwdRef: MutableRefObject<string>;
  projectTerminalFocusedRef: MutableRefObject<boolean>;
  pendingPersist: MutableRefObject<Map<string, Session>>;
  loadedSessionCache: MutableRefObject<Map<string, Session>>;
  removingSessionIds: MutableRefObject<Set<string>>;
  sessionLoads: MutableRefObject<Map<string, Promise<Session | null>>>;
  whatsNewVersionRef: MutableRefObject<string | null>;
  settingsOpenRef: MutableRefObject<boolean>;
  filePickerOpenRef: MutableRefObject<boolean>;
  inboxViewOpenRef: MutableRefObject<boolean>;
  notesViewOpenRef: MutableRefObject<boolean>;
  searchViewOpenRef: MutableRefObject<boolean>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setHistory: Dispatch<SetStateAction<SessionSummary[]>>;
  setStoredLinkedSessions: Dispatch<SetStateAction<SessionSummary[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setComposerFocused: Dispatch<SetStateAction<boolean>>;
  setSearchViewOpen: Dispatch<SetStateAction<boolean>>;
  setInboxViewOpen: Dispatch<SetStateAction<boolean>>;
  setNotesViewOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setFilePickerOpen: Dispatch<SetStateAction<boolean>>;
  setSidebarTab: Dispatch<SetStateAction<SidebarTabId>>;
  setProjectCwd: Dispatch<SetStateAction<string>>;
  setRecents: Dispatch<SetStateAction<RecentProject[]>>;
  setInspectedWorkerId: Dispatch<SetStateAction<string | null>>;
  setTabs: Dispatch<SetStateAction<import("../lib/layout").WorkspaceTab[]>>;
  setDirtyFiles: Dispatch<SetStateAction<Set<string>>>;
  setProjectTerminalFocused: Dispatch<SetStateAction<boolean>>;
  invalidateLoadedSession: (sessionId: string) => void;
  setLinkedWorkItemUpdateCard: (
    sessionId: string,
    update: (
      card: import("../lib/linkedWorkItemActivity").LinkedWorkItemUpdateCard | undefined,
    ) => import("../lib/linkedWorkItemActivity").LinkedWorkItemUpdateCard | undefined,
  ) => void;
  appendTab: (tab: import("../lib/layout").WorkspaceTab, cwd?: string) => void;
  ensureOpenSession: (sessionId: string) => Promise<Session | null>;
  focusOpenSession: (sessionId: string) => boolean;
  replaceBlankPaneWithSession: (session: Session) => boolean;
  revealLinkedSessionUpdate: (sessionId: string, update: LinkedSessionUpdate) => void;
  stopSessionForRemoval: (sessionId: string) => Promise<Session | undefined>;
  refreshHistory: (cwd: string) => Promise<void>;
  persistSession: (session: Session | undefined) => void;
  activateTab: (id: string, paneId?: string) => void;
  /** Set by the worktrees hook after mount; read at call time. */
  worktreeApiRef?: MutableRefObject<WorktreeDeletionHooks | null>;
}

export function useHistory(deps: HistoryDeps) {
  const {
    sessions,
    history,
    sidebarCwd,
    tabCloseScope,
    sessionsRef,
    tabsRef,
    dirtyFilesRef,
    activeTabIdRef,
    linkedSessionUpdatesRef,
    lastPersisted,
    projectCwdRef,
    projectTerminalFocusedRef,
    pendingPersist,
    loadedSessionCache,
    removingSessionIds,
    whatsNewVersionRef,
    settingsOpenRef,
    filePickerOpenRef,
    inboxViewOpenRef,
    notesViewOpenRef,
    searchViewOpenRef,
    setSessions,
    setHistory,
    setStoredLinkedSessions,
    setActiveTabId,
    setComposerFocused,
    setSearchViewOpen,
    setInboxViewOpen,
    setNotesViewOpen,
    setSettingsOpen,
    setFilePickerOpen,
    setSidebarTab,
    setProjectCwd,
    setRecents,
    setInspectedWorkerId,
    setTabs,
    setDirtyFiles,
    setProjectTerminalFocused,
    invalidateLoadedSession,
    setLinkedWorkItemUpdateCard,
    appendTab,
    ensureOpenSession,
    focusOpenSession,
    replaceBlankPaneWithSession,
    revealLinkedSessionUpdate,
    stopSessionForRemoval,
    refreshHistory,
    persistSession,
    activateTab,
    worktreeApiRef,
  } = deps;
  const onSelectHistorySession = useCallback(
    async (sessionId: string) => {
      let session = await ensureOpenSession(sessionId);
      if (!session || session.inboxAsk) return;
      const parentId =
        session.orchestrationLeadId ??
        orchestrator.forSession(sessionId)?.leadId;
      if (parentId && parentId !== sessionId) {
        setInspectedWorkerId(sessionId);
        session = await ensureOpenSession(parentId);
        if (!session) return;
      }
      const linkedUpdate = linkedSessionUpdatesRef.current.get(session.id);
      if (focusOpenSession(session.id)) {
        if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
        return;
      }
      if (replaceBlankPaneWithSession(session)) {
        if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
        return;
      }
      const tab = newTab(session.id);
      appendTab(tab, session.cwd);
      setActiveTabId(tab.id);
      setComposerFocused(true);
      if (linkedUpdate) revealLinkedSessionUpdate(session.id, linkedUpdate);
    },
    [
      appendTab,
      ensureOpenSession,
      focusOpenSession,
      replaceBlankPaneWithSession,
      revealLinkedSessionUpdate,
    ],
  );

  const openReminderSession = useCallback(
    async (sessionId: string) => {
      const session = await ensureOpenSession(sessionId);
      if (!session)
        throw new Error("This conversation is no longer available.");
      setSearchViewOpen(false);
      setInboxViewOpen(false);
      setNotesViewOpen(false);
      setSettingsOpen(false);
      setFilePickerOpen(false);
      setSidebarTab("sessions");
      setProjectCwd(session.cwd);
      setRecents(rememberProject(session.cwd));
      await onSelectHistorySession(sessionId);
    },
    [ensureOpenSession, onSelectHistorySession],
  );

  const ensureReminderSessionsSaved = useCallback(
    async (ids: readonly string[]) => {
      for (const id of ids) {
        const session = sessionsRef.current.find(
          (session) => session.id === id,
        );
        if (session && !(await upsertSession(session))) {
          throw new Error(
            "Send a message in this conversation before setting a reminder.",
          );
        }
      }
    },
    [],
  );

  const sessionReminders = useSessionReminders(
    openReminderSession,
    ensureReminderSessionsSaved,
    sessions
      .filter((session) => !session.inboxAsk)
      .map((session) => session.id),
  );

  const dismissNoticesForContinuedSession = useCallback(
    (sessionId: string) => {
      void sessionReminders.dismissDue(sessionId);
      const updatedAt = sessionsRef.current.find(
        (session) => session.id === sessionId,
      )?.linkedWorkItemUpdateCard?.updatedAt;
      if (updatedAt == null) return;
      markLinkedSessionUpdateSeen(sessionId, updatedAt);
      setLinkedWorkItemUpdateCard(sessionId, (card) =>
        card?.updatedAt === updatedAt ? undefined : card,
      );
    },
    [sessionReminders.dismissDue, setLinkedWorkItemUpdateCard],
  );

  const onPlaceSessionOnPane = useCallback(
    async (sessionId: string, targetId: string, edge: PaneEdge) => {
      if (sessionId === targetId) return;
      const targetTab = tabsRef.current.find((tab) =>
        leafIds(tab.layout).includes(targetId),
      );
      if (!targetTab) return;

      const alreadyHere = leafIds(targetTab.layout).includes(sessionId);
      if (!alreadyHere) {
        const session = await ensureOpenSession(sessionId);
        if (!session) return;
      }

      const tab = tabsRef.current.find((entry) => entry.id === targetTab.id);
      if (!tab || !leafIds(tab.layout).includes(targetId)) return;

      const replaceTarget =
        !leafIds(tab.layout).includes(sessionId) &&
        isBlankSession(
          sessionsRef.current.find((entry) => entry.id === targetId),
        );

      if (replaceTarget) {
        lastPersisted.current.delete(targetId);
        const blank = sessionsRef.current.find(
          (entry) => entry.id === targetId,
        );
        if (blank) void forgetHarnessSession(blank.harness, targetId);
      }

      const result = applyPlaceSessionOnPane({
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        sessionId,
        targetId,
        edge,
        replaceTarget,
        scope: tabCloseScope,
        createReplacement: (seed) =>
          newAvailableDefaultSession(
            seed?.cwd ?? projectCwdRef.current,
            seed?.runtimeMode,
            availableHarnessIds(),
          ),
      });
      if (!result) return;

      sessionsRef.current = result.sessions;
      tabsRef.current = result.tabs;
      setSessions(result.sessions);
      setTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      setProjectTerminalFocused(false);
      setComposerFocused(true);
    },
    [ensureOpenSession, tabCloseScope],
  );

  const onPlaceTabOnPane = useCallback(
    (sourceTabId: string, targetId: string, edge: PaneEdge) => {
      const targetTab = tabsRef.current.find((tab) =>
        leafIds(tab.layout).includes(targetId),
      );
      if (!targetTab || targetTab.id === sourceTabId) return;

      const blankTarget = sessionsRef.current.find(
        (session) => session.id === targetId && isBlankSession(session),
      );
      const result = applyPlaceTabOnPane({
        tabs: tabsRef.current,
        sessions: sessionsRef.current,
        sourceTabId,
        targetId,
        edge,
        replaceTarget: blankTarget != null,
      });
      if (!result) return;

      if (blankTarget) {
        lastPersisted.current.delete(blankTarget.id);
        void forgetHarnessSession(blankTarget.harness, blankTarget.id);
      }
      sessionsRef.current = result.sessions;
      tabsRef.current = result.tabs;
      setSessions(result.sessions);
      setTabs(result.tabs);
      setActiveTabId(result.activeTabId);
      setProjectTerminalFocused(false);
      setComposerFocused(
        result.sessions.some((session) => session.id === result.focusedId),
      );
    },
    [],
  );

  const onRenameHistorySession = useCallback(
    async (sessionId: string, displayTitle: string) => {
      const trimmed = displayTitle.trim();
      if (!trimmed) return;
      invalidateLoadedSession(sessionId);

      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (open) {
        const title = formatSessionTitle(open.harness, trimmed);
        const updated = { ...open, title };
        setSessions((prev) =>
          prev.map((session) => (session.id === sessionId ? updated : session)),
        );
        loadedSessionCache.current.delete(sessionId);
        persistSession(updated);
      } else {
        const restored = await getSession(sessionId).catch(() => null);
        if (!restored) {
          void refreshHistory(sidebarCwd);
          return;
        }
        const updated = {
          ...restored,
          title: formatSessionTitle(restored.harness, trimmed),
        };
        const saved = await upsertSession(updated).catch(() => null);
        if (saved) {
          const cached = updated;
          rememberLoadedSession(loadedSessionCache.current, cached);
          lastPersisted.current.set(sessionId, persistFingerprint(updated));
        }
      }
      void refreshHistory(sidebarCwd);
    },
    [invalidateLoadedSession, persistSession, refreshHistory, sidebarCwd],
  );

  const onRemoveHistorySession = useCallback(
    async (
      sessionId: string,
      mode: "archive" | "delete",
      skipDeleteConfirm = false,
    ): Promise<boolean> => {
      const worktreeApi = worktreeApiRef?.current;
      if (
        removingSessionIds.current.has(sessionId) ||
        (worktreeApi?.switchingWorktrees.current.has(sessionId) ?? false) ||
        (worktreeApi?.deleteConfirmationPending.current ?? false)
      )
        return false;
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      const summary = history.find((entry) => entry.id === sessionId);
      const seed = open ?? summary;
      const label = seed
        ? sessionDisplayTitle(seed.title, seed.harness)
        : "this session";
      removingSessionIds.current.add(sessionId);
      let deleteWorktreePath: string | undefined;
      if (mode === "delete" && !skipDeleteConfirm) {
        if (!worktreeApi) {
          if (!window.confirm(`Delete “${label}”?`)) {
            removingSessionIds.current.delete(sessionId);
            return false;
          }
        } else {
          const decision = await worktreeApi.requestSessionDelete(
            label,
            seed,
            sessionId,
          );
          if (!decision.confirmed) {
            removingSessionIds.current.delete(sessionId);
            return false;
          }
          deleteWorktreePath = decision.deleteWorktreePath;
        }
      }
      invalidateLoadedSession(sessionId);
      pendingPersist.current.delete(sessionId);
      let savedSummary: SessionSummary | undefined;
      try {
        const removed = await runSessionRemoval({
          sessionId,
          scope: tabCloseScope,
          readWorkspace: () => ({
            tabs: tabsRef.current,
            sessions: sessionsRef.current,
            activeTabId: activeTabIdRef.current,
            dirtyFiles: dirtyFilesRef.current,
          }),
          createReplacement: (latest) =>
            newSessionForSeed(
              {
                harness: latest?.harness ?? seed?.harness ?? "cursor",
                model: latest?.model ?? seed?.model,
                runtimeMode: latest?.runtimeMode ?? seed?.runtimeMode,
                modelSettings: latest?.modelSettings ?? open?.modelSettings,
              },
              latest?.cwd ?? seed?.cwd ?? sidebarCwd,
            ),
          confirmClose: async (closedTabs) => {
            const files = filesInWorkspaceTabs(closedTabs);
            const unsaved = files.some(
              (file) =>
                isFilesystemTab(file) && dirtyFilesRef.current.has(file.id),
            );
            if (
              unsaved &&
              !(await confirmDiscardUnsaved(
                `${mode === "archive" ? "Archive" : "Delete"} this conversation with unsaved files?`,
              ))
            )
              return false;
            const terminals = files.filter((file) => file.terminal);
            return (
              terminals.length === 0 || (await confirmCloseTerminals(terminals))
            );
          },
          stop: async () => {
            const run =
              mode === "delete" ? orchestrator.forSession(sessionId) : undefined;
            if (run && (run.status === "active" || run.status === "paused"))
              await orchestrator.stopRun(run.leadId);
            await stopSessionForRemoval(sessionId);
            if (mode === "delete") {
              const latest = sessionsRef.current.find(
                (s) => s.id === sessionId,
              );
              const harnesses: HarnessId[] = latest
                ? sessionChildHarnesses(latest)
                : [seed?.harness ?? "cursor"];
              // Release native processes before deleting the record, so a
              // following worktree removal cannot race fire-and-forget cleanup.
              await Promise.all(
                harnesses.map((harness) =>
                  forgetHarnessSession(harness, sessionId),
                ),
              );
            }
          },
          updateSession: (stopped) => {
            const next = sessionsRef.current.map((session) =>
              session.id === sessionId ? stopped : session,
            );
            sessionsRef.current = next;
            setSessions(next);
          },
          persist: async (latest) => {
            if (latest) await flushSessionCheckpoint(sessionId);
            if (mode === "delete") {
              const revisions = await orchestrator.deleteSession(
                sessionId,
                () => deleteSession(sessionId),
              );
              const revisionById = new Map(
                revisions.map((entry) => [entry.sessionId, entry.revision]),
              );
              const freshWorkers = await Promise.all(
                revisions.map(async (entry) => ({
                  sessionId: entry.sessionId,
                  session: await getSession(entry.sessionId).catch(() => null),
                })),
              );
              markSessionConflicts(
                freshWorkers
                  .filter((entry) => entry.session === null)
                  .map((entry) => entry.sessionId),
              );
              const freshById = new Map(
                freshWorkers
                  .filter(
                    (entry): entry is { sessionId: string; session: Session } =>
                      entry.session !== null,
                  )
                  .map((entry) => [entry.sessionId, entry.session]),
              );
              const withRevision = <
                T extends { id: string; revision?: number },
              >(
                entry: T,
                revision: number | undefined,
              ): T =>
                revision === undefined
                  ? entry
                  : applySessionRevisionsToSessions(
                      [entry],
                      [{ sessionId: entry.id, revision }],
                    )[0];
              const releaseSessions = (entries: Session[]) =>
                entries.map((session) => {
                  const released = releaseOrchestrationWorker(
                    session,
                    sessionId,
                  );
                  const fresh = freshById.get(session.id);
                  if (!fresh) return released;
                  if (!samePersistedSession(released, fresh)) {
                    markSessionConflicts([session.id]);
                    return released;
                  }
                  const { revision: freshRevision, ...freshWithoutRevision } =
                    fresh;
                  const merged = {
                    ...released,
                    ...freshWithoutRevision,
                    blocks: released.blocks,
                    busy: released.busy,
                  };
                  return freshRevision === undefined
                    ? merged
                    : applySessionRevisionsToSessions(
                        [merged],
                        [{ sessionId: session.id, revision: freshRevision }],
                      )[0];
                });
              const released = releaseSessions(sessionsRef.current);
              sessionsRef.current = released;
              setSessions((current) => releaseSessions(current));
              for (const [id, cached] of loadedSessionCache.current) {
                if (releaseOrchestrationWorker(cached, sessionId) !== cached) {
                  invalidateLoadedSession(id);
                }
              }
              for (const id of revisionById.keys()) {
                invalidateLoadedSession(id);
              }
              for (const [id, pending] of pendingPersist.current) {
                const releasedPending = releaseOrchestrationWorker(
                  pending,
                  sessionId,
                );
                const fresh = freshById.get(id);
                if (!revisionById.has(id)) {
                  pendingPersist.current.set(id, releasedPending);
                } else if (
                  fresh &&
                  samePersistedSession(releasedPending, fresh)
                ) {
                  pendingPersist.current.set(id, fresh);
                } else {
                  markSessionConflicts([id]);
                }
              }
              const releaseSummary = (entry: SessionSummary) => {
                const released =
                  entry.orchestrationLeadId === sessionId
                    ? { ...entry, orchestrationLeadId: undefined }
                    : entry;
                return withRevision(released, revisionById.get(entry.id));
              };
              setHistory((current) => current.map(releaseSummary));
              setStoredLinkedSessions((current) => current.map(releaseSummary));
              return;
            }
            if (latest && shouldPersistSession(latest)) {
              const saved = await upsertSession(latest);
              if (!saved)
                throw new Error("The conversation could not be saved.");
              savedSummary = saved;
            }
            await setSessionArchived(sessionId, true);
          },
          commit: (removal) => {
            const latest = sessionsRef.current.find(
              (session) => session.id === sessionId,
            );
            const harnesses: HarnessId[] = latest
              ? sessionChildHarnesses(latest)
              : [seed?.harness ?? "cursor"];
            for (const harness of harnesses) {
              void forgetHarnessSession(harness, sessionId);
            }
            lastPersisted.current.delete(sessionId);
            pendingPersist.current.delete(sessionId);
            const closingFiles = filesInWorkspaceTabs(removal.closedTabs);
            setDirtyFiles((current) => {
              const next = new Set(current);
              for (const file of closingFiles) next.delete(file.id);
              return next;
            });
            sessionsRef.current = removal.sessions;
            tabsRef.current = removal.tabs;
            setSessions(removal.sessions);
            setTabs(removal.tabs);
            if (removal.activeTabId !== activeTabIdRef.current) {
              activateTab(removal.activeTabId);
            }
            const activeTab = removal.tabs.find(
              (tab) => tab.id === removal.activeTabId,
            );
            setComposerFocused(
              removal.sessions.some(
                (session) => session.id === activeTab?.focusedId,
              ),
            );
            if (mode === "archive") {
              if (latest && shouldPersistSession(latest)) {
                rememberLoadedSession(loadedSessionCache.current, latest);
              }
              const archived =
                savedSummary ??
                summary ??
                (latest && summaryFromSession(latest));
              if (archived) {
                setHistory((current) =>
                  mergeHistorySummary(current, { ...archived, archived: true }),
                );
              }
            } else {
              setHistory((current) =>
                current.filter((entry) => entry.id !== sessionId),
              );
              void refreshHistory(sidebarCwd);
            }
          },
        });
        if (removed && deleteWorktreePath && seed) {
          await worktreeApiRef?.current?.removeWorktreeAfterDelete(
            seed.cwd,
            deleteWorktreePath,
          );
        }
        return removed;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        void message(`Could not ${mode} this conversation.\n\n${detail}`, {
          title: "MonoCode",
          kind: "error",
        });
        return false;
      } finally {
        removingSessionIds.current.delete(sessionId);
      }
    },
    [
      activateTab,
      history,
      invalidateLoadedSession,
      refreshHistory,
      sidebarCwd,
      stopSessionForRemoval,
      tabCloseScope,
      worktreeApiRef,
    ],
  );

  const onArchiveHistorySession = useCallback(
    async (sessionId: string, archived: boolean) => {
      if (archived) return onRemoveHistorySession(sessionId, "archive");
      if (removingSessionIds.current.has(sessionId)) return false;
      try {
        await setSessionArchived(sessionId, false);
        setHistory((current) =>
          current.map((entry) =>
            entry.id === sessionId ? { ...entry, archived: false } : entry,
          ),
        );
        return true;
      } catch (error) {
        void message(
          `Could not unarchive this conversation.\n\n${String(error)}`,
          {
            title: "MonoCode",
            kind: "error",
          },
        );
        return false;
      }
    },
    [onRemoveHistorySession],
  );

  const onArchiveFocusedSession = useCallback(
    (event: KeyboardEvent) => {
      archiveFocusedSession(
        event,
        {
          activeTabId: activeTabIdRef.current,
          tabs: tabsRef.current,
          sessions: sessionsRef.current,
          projectTerminalFocused: projectTerminalFocusedRef.current,
          surfaceOpen: Boolean(
            searchViewOpenRef.current ||
            inboxViewOpenRef.current ||
            notesViewOpenRef.current ||
            settingsOpenRef.current ||
            filePickerOpenRef.current ||
            whatsNewVersionRef.current,
          ),
        },
        (sessionId) => {
          void onArchiveHistorySession(sessionId, true);
        },
      );
    },
    [onArchiveHistorySession],
  );

  const onPinHistorySession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const open = sessionsRef.current.find(
        (session) => session.id === sessionId,
      );
      if (open && shouldPersistSession(open)) {
        await upsertSession(open).catch(() => undefined);
      }
      await setSessionPinned(sessionId, pinned).catch(() => undefined);
      setHistory((current) => {
        const existing = current.find((entry) => entry.id === sessionId);
        if (existing) {
          return mergeProjectHistorySummary(current, { ...existing, pinned });
        }
        if (!open) return current;
        return mergeProjectHistorySummary(current, {
          ...summaryFromSession(open),
          pinned,
        });
      });
    },
    [],
  );

  const onArchiveHistorySessions = useCallback(
    async (sessionIds: readonly string[], archived: boolean) => {
      for (const sessionId of sessionIds) {
        if (!(await onArchiveHistorySession(sessionId, archived))) break;
      }
    },
    [onArchiveHistorySession],
  );

  const onPinHistorySessions = useCallback(
    async (sessionIds: readonly string[], pinned: boolean) => {
      await Promise.all(
        sessionIds.map((sessionId) => onPinHistorySession(sessionId, pinned)),
      );
    },
    [onPinHistorySession],
  );

  const onDeleteHistorySession = useCallback(
    (sessionId: string) => onRemoveHistorySession(sessionId, "delete"),
    [onRemoveHistorySession],
  );

  const onDeleteHistorySessions = useCallback(
    async (sessionIds: readonly string[]) => {
      if (sessionIds.length === 0) return;
      if (
        !window.confirm(
          `Delete ${sessionIds.length} selected conversations? This can’t be undone.`,
        )
      )
        return;
      for (const sessionId of sessionIds) {
        if (!(await onRemoveHistorySession(sessionId, "delete", true))) break;
      }
    },
    [onRemoveHistorySession],
  );

  return {
    sessionReminders,
    onArchiveFocusedSession,
    onSelectHistorySession,
    openReminderSession,
    ensureReminderSessionsSaved,
    dismissNoticesForContinuedSession,
    onPlaceSessionOnPane,
    onPlaceTabOnPane,
    onRenameHistorySession,
    onRemoveHistorySession,
    onArchiveHistorySession,
    onPinHistorySession,
    onArchiveHistorySessions,
    onPinHistorySessions,
    onDeleteHistorySession,
    onDeleteHistorySessions,
  };
}
