import { useCallback, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { stopStreaming } from "../lib/harness/apply";
import { bindHarnessSession, forgetHarnessSession } from "../lib/harness";
import { bindResumedSessions } from "../lib/appLifecycle";
import {
  flushSessionCheckpoint,
  keepSessionChanges,
  notifyReviewChanged,
} from "../lib/checkpoint";
import { notifyGitChanged } from "../lib/fs";
import { isEqualOrInside, pathKey } from "../lib/paths";
import { isBlankSession } from "../lib/projectReturn";
import { rememberProject, type RecentProject } from "../lib/recents";
import {
  sessionChildHarnesses,
} from "../lib/handoff";
import {
  newTab,
  type WorkspaceTab,
} from "../lib/layout";
import { orchestrator } from "../lib/orchestration";
import {
  applySessionRevisions,
  applySessionRevisionsToSessions,
  flushSessionWrites,
  getSession,
  markSessionConflicts,
  samePersistedSession,
  shouldPersistSession,
  upsertSession,
  type SessionSummary,
} from "../lib/sessionStore";
import {
  sessionWorkCwd,
  type Session,
} from "../lib/session";
import {
  assertWorktreeFilesClosed,
  checkWorktreeRemoval,
  detachSessionWorktree,
  listWorktrees,
  removeWorktree,
  sessionInWorktree,
  worktreeSessionIds,
  type Worktree,
} from "../lib/worktrees";
import { filesInWorkspaceTabs } from "./tabHelpers";
import type { SessionDeleteChoice } from "../chrome/DeleteSessionDialog";
import type { ProjectTerminalDock } from "../lib/projectTerminal";

export interface SessionDeleteRequest {
  title: string;
  unusedWorktree: string;
  resolve: (choice: SessionDeleteChoice) => void;
}

/** Worktree integration consumed by history deletion (via ref, set after mount). */
export interface WorktreeDeletionHooks {
  switchingWorktrees: MutableRefObject<Map<string, string>>;
  deleteConfirmationPending: MutableRefObject<boolean>;
  requestSessionDelete: (
    label: string,
    seed: Pick<Session, "cwd" | "worktreeCwd"> | undefined,
    sessionId: string,
  ) => Promise<{ confirmed: boolean; deleteWorktreePath?: string }>;
  removeWorktreeAfterDelete: (cwd: string, path: string) => Promise<void>;
}

interface WorktreesDeps {
  sessionsRef: MutableRefObject<Session[]>;
  tabsRef: MutableRefObject<WorkspaceTab[]>;
  projectTerminalsRef: MutableRefObject<ProjectTerminalDock[]>;
  projectCwdRef: MutableRefObject<string>;
  pendingPersist: MutableRefObject<Map<string, Session>>;
  lastPersisted: MutableRefObject<Map<string, string>>;
  removingSessionIds: MutableRefObject<Set<string>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setHistory: Dispatch<SetStateAction<SessionSummary[]>>;
  setStoredLinkedSessions: Dispatch<SetStateAction<SessionSummary[]>>;
  setProjectCwd: Dispatch<SetStateAction<string>>;
  setRecents: Dispatch<SetStateAction<RecentProject[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setComposerFocused: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsSection: Dispatch<SetStateAction<import("../lib/settings").SettingsSectionId>>;
  appendTab: (tab: WorkspaceTab, cwd?: string) => void;
  stopSessionForRemoval: (sessionId: string) => Promise<Session | undefined>;
  invalidateLoadedSession: (sessionId: string) => void;
  refreshHistory: (cwd: string) => Promise<void>;
  onRemoveHistorySession: (
    sessionId: string,
    mode: "archive" | "delete",
    skipDeleteConfirm?: boolean,
  ) => Promise<boolean>;
}

/** Git-worktree behaviors: switching, removal, delete prompts, settings entry. */
export function useWorktrees(deps: WorktreesDeps) {
  const {
    sessionsRef,
    tabsRef,
    projectTerminalsRef,
    projectCwdRef,
    pendingPersist,
    lastPersisted,
    removingSessionIds,
    setSessions,
    setHistory,
    setStoredLinkedSessions,
    setProjectCwd,
    setRecents,
    setActiveTabId,
    setComposerFocused,
    setSettingsOpen,
    setSettingsSection,
    appendTab,
    stopSessionForRemoval,
    invalidateLoadedSession,
    refreshHistory,
    onRemoveHistorySession,
  } = deps;

  const switchingWorktrees = useRef(new Map<string, string>());
  const removingWorktreePaths = useRef(new Set<string>());
  const deleteConfirmationPending = useRef(false);
  const [sessionDeleteDialog, setSessionDeleteDialog] =
    useState<SessionDeleteRequest | undefined>();

  const checkOpenWorktreeFiles = useCallback((path: string) => {
    assertWorktreeFilesClosed(path, [
      ...filesInWorkspaceTabs(tabsRef.current),
      ...projectTerminalsRef.current.flatMap((dock) => dock.pane.files),
    ]);
  }, [projectTerminalsRef, tabsRef]);

  const onCheckWorktreeRemoval = useCallback(
    async (cwd: string, path: string, force: boolean) => {
      checkOpenWorktreeFiles(path);
      await checkWorktreeRemoval(cwd, path, force);
      // Re-read UI state after the native check, before deleting sessions.
      checkOpenWorktreeFiles(path);
    },
    [checkOpenWorktreeFiles],
  );

  const onRemoveWorktree = useCallback(
    async (cwd: string, path: string, force: boolean, keepSessions = false) => {
      if (removingWorktreePaths.current.has(path)) {
        throw new Error("This worktree is already being deleted.");
      }
      removingWorktreePaths.current.add(path);
      const lockedIds = new Set<string>();
      const forgottenIds = new Set<string>();
      try {
        if (
          [...switchingWorktrees.current.values()].some((target) =>
            isEqualOrInside(target, path),
          )
        ) {
          throw new Error(
            "A session is selecting this worktree. Try deleting it again once selection finishes.",
          );
        }
        await onCheckWorktreeRemoval(cwd, path, force);
        const listed = await listWorktrees(cwd);
        const tree = listed.worktrees.find(
          (entry) => pathKey(entry.path) === pathKey(path),
        );
        if (!tree) throw new Error("This worktree is no longer available.");
        const ids = worktreeSessionIds(tree, sessionsRef.current);
        if (!keepSessions && ids.length) {
          throw new Error(
            "Move or delete the sessions using this worktree first.",
          );
        }
        if (
          ids.some(
            (id) =>
              removingSessionIds.current.has(id) ||
              switchingWorktrees.current.has(id),
          )
        ) {
          throw new Error(
            "Wait for these sessions to finish changing before deleting the worktree.",
          );
        }
        for (const id of ids) {
          removingSessionIds.current.add(id);
          lockedIds.add(id);
          pendingPersist.current.delete(id);
          invalidateLoadedSession(id);
        }
        for (const id of ids) {
          await stopSessionForRemoval(id);
          const session = sessionsRef.current.find((entry) => entry.id === id);
          if (!session) continue;
          await flushSessionCheckpoint(id);
          forgottenIds.add(id);
          for (const harness of sessionChildHarnesses(session)) {
            await forgetHarnessSession(harness, id);
          }
          const latest = sessionsRef.current.find((entry) => entry.id === id);
          if (!latest) continue;
          const stopped = {
            ...stopStreaming(latest),
            busy: false,
            queueStatus: "paused" as const,
            pendingQuestion: undefined,
          };
          sessionsRef.current = sessionsRef.current.map((entry) =>
            entry.id === id ? stopped : entry,
          );
          setSessions(sessionsRef.current);
          if (shouldPersistSession(stopped)) await upsertSession(stopped);
        }
        await flushSessionWrites();
        checkOpenWorktreeFiles(path);
        const removed = await removeWorktree(cwd, path, force, keepSessions);
        applySessionRevisions(removed.sessionRevisions);
        sessionsRef.current = applySessionRevisionsToSessions(
          sessionsRef.current,
          removed.sessionRevisions,
        );
        const affected = new Set([...ids, ...removed.sessionIds]);
        if (isEqualOrInside(projectCwdRef.current, path)) {
          setProjectCwd(removed.projectCwd);
          setRecents(rememberProject(removed.projectCwd));
        }
        for (const id of affected) {
          invalidateLoadedSession(id);
          const pending = pendingPersist.current.get(id);
          if (pending) {
            const detached = detachSessionWorktree(
              pending,
              removed.projectCwd,
              path,
            );
            pendingPersist.current.set(
              id,
              applySessionRevisionsToSessions(
                [detached],
                removed.sessionRevisions,
              )[0],
            );
          } else {
            pendingPersist.current.delete(id);
          }
          lastPersisted.current.delete(id);
        }
        const detachSessions = (entries: Session[]) =>
          entries.map((session) =>
            affected.has(session.id)
              ? detachSessionWorktree(session, removed.projectCwd, path)
              : session,
          );
        const detached = detachSessions(sessionsRef.current);
        sessionsRef.current = detached;
        setSessions((current) => detachSessions(current));
        const patchSummary = (entry: SessionSummary) =>
          affected.has(entry.id)
            ? detachSessionWorktree(entry, removed.projectCwd, path)
            : entry;
        setHistory((current) => current.map(patchSummary));
        setStoredLinkedSessions((current) => current.map(patchSummary));
        for (const id of affected) notifyReviewChanged(id);
      } catch (error) {
        const reloaded = await Promise.all(
          [...lockedIds].map(async (id) => ({
            id,
            session: await getSession(id).catch(() => null),
          })),
        );
        markSessionConflicts(
          reloaded
            .filter((entry) => entry.session === null)
            .map((entry) => entry.id),
        );
        const freshById = new Map(
          reloaded
            .filter(
              (entry): entry is { id: string; session: Session } =>
                entry.session !== null,
            )
            .map((entry) => [entry.id, entry.session]),
        );
        const mergeFreshSession = (entry: Session, fresh: Session): Session => {
          if (!samePersistedSession(entry, fresh)) {
            markSessionConflicts([entry.id]);
            return entry;
          }
          const { revision: freshRevision, ...freshWithoutRevision } = fresh;
          const merged = {
            ...entry,
            ...freshWithoutRevision,
            blocks: entry.blocks,
            busy: entry.busy,
          };
          return freshRevision === undefined
            ? merged
            : applySessionRevisionsToSessions(
                [merged],
                [{ sessionId: entry.id, revision: freshRevision }],
              )[0];
        };
        const restoreSessions = (entries: Session[]) =>
          entries.map((entry) => {
            const fresh = freshById.get(entry.id);
            return fresh ? mergeFreshSession(entry, fresh) : entry;
          });
        const restored = restoreSessions(sessionsRef.current);
        sessionsRef.current = restored;
        setSessions((current) => restoreSessions(current));
        for (const id of lockedIds) {
          const pending = pendingPersist.current.get(id);
          if (!pending) continue;
          const fresh = freshById.get(id);
          if (!fresh) {
            markSessionConflicts([id]);
            continue;
          }
          pendingPersist.current.set(id, mergeFreshSession(pending, fresh));
        }
        const kept = restored.filter(
          (session) => forgottenIds.has(session.id) && !session.worktreeRemoved,
        );
        bindResumedSessions(kept);
        for (const session of kept) {
          const pending = session.pendingSwitch;
          if (pending?.fromProviderSessionId) {
            bindHarnessSession(
              pending.from,
              session.id,
              pending.fromProviderSessionId,
              sessionWorkCwd(session),
              pending.fromProviderAccountId,
            );
          }
        }
        throw error;
      } finally {
        removingWorktreePaths.current.delete(path);
        for (const id of lockedIds) removingSessionIds.current.delete(id);
      }
    },
    [
      checkOpenWorktreeFiles,
      invalidateLoadedSession,
      onCheckWorktreeRemoval,
      pendingPersist,
      lastPersisted,
      projectCwdRef,
      projectTerminalsRef,
      removingSessionIds,
      sessionsRef,
      setHistory,
      setProjectCwd,
      setRecents,
      setSessions,
      setStoredLinkedSessions,
      stopSessionForRemoval,
      tabsRef,
    ],
  );

  const onWorktreeChange = useCallback(
    async (sessionId: string, tree: Worktree) => {
      const current = sessionsRef.current.find((s) => s.id === sessionId);
      if (
        !current ||
        current.busy ||
        removingSessionIds.current.has(sessionId) ||
        switchingWorktrees.current.has(sessionId)
      ) {
        throw new Error(
          "Wait for this session to finish before changing working copies.",
        );
      }
      if (
        !current.worktreeRemoved &&
        pathKey(sessionWorkCwd(current)) === pathKey(tree.path)
      )
        return;
      if (
        [...removingWorktreePaths.current].some((path) =>
          isEqualOrInside(tree.path, path),
        )
      ) {
        throw new Error(
          "This worktree is being deleted. Select another working copy.",
        );
      }
      if (!current.worktreeRemoved && current.queuedMessages?.length) {
        throw new Error(
          "Clear queued messages before changing working copies.",
        );
      }
      const run = orchestrator.forSession(sessionId);
      if (run && ["active", "paused"].includes(run.status)) {
        throw new Error(
          "Stop this orchestration run before changing working copies.",
        );
      }
      switchingWorktrees.current.set(sessionId, tree.path);
      pendingPersist.current.delete(sessionId);
      try {
        const listed = await listWorktrees(current.cwd);
        const target = listed.worktrees.find(
          (entry) =>
            pathKey(entry.path) === pathKey(tree.path) && !entry.missing,
        );
        if (!target) {
          throw new Error(
            "This worktree is no longer available. Refresh the picker.",
          );
        }
        const source = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          !source ||
          source.busy ||
          source.cwd !== current.cwd ||
          sessionWorkCwd(source) !== sessionWorkCwd(current)
        ) {
          throw new Error(
            "The session changed. Try selecting the working copy again.",
          );
        }
        const selected = sessionInWorktree(source, target);
        if (selected.id !== sessionId) {
          // Leave the original conversation, checkpoints, and live provider
          // context attached to the files they describe.
          const tab = newTab(selected.id);
          sessionsRef.current = [...sessionsRef.current, selected];
          setSessions(sessionsRef.current);
          appendTab(tab, selected.cwd);
          setActiveTabId(tab.id);
          setComposerFocused(true);
          return;
        }
        await flushSessionCheckpoint(sessionId);
        for (const harness of sessionChildHarnesses(source)) {
          await forgetHarnessSession(harness, sessionId);
        }
        const latest = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          !latest ||
          (!latest.worktreeRemoved && !isBlankSession(latest)) ||
          latest.cwd !== current.cwd ||
          sessionWorkCwd(latest) !== sessionWorkCwd(current)
        ) {
          throw new Error(
            "The session changed. Try selecting the working copy again.",
          );
        }
        const next = sessionInWorktree(latest, target);
        if (latest.worktreeRemoved)
          await keepSessionChanges(sessionId, target.path);
        pendingPersist.current.delete(sessionId);
        if (shouldPersistSession(next)) await upsertSession(next);
        invalidateLoadedSession(sessionId);
        sessionsRef.current = sessionsRef.current.map((s) =>
          s.id === sessionId ? next : s,
        );
        setSessions(sessionsRef.current);
        notifyGitChanged();
        notifyReviewChanged(sessionId);
        void refreshHistory(next.cwd);
      } finally {
        switchingWorktrees.current.delete(sessionId);
      }
    },
    [
      appendTab,
      invalidateLoadedSession,
      pendingPersist,
      refreshHistory,
      removingSessionIds,
      sessionsRef,
      setActiveTabId,
      setComposerFocused,
      setSessions,
    ],
  );

  const onDeleteWorktreeSessions = useCallback(
    async (sessionIds: readonly string[]): Promise<boolean> => {
      for (const sessionId of sessionIds) {
        if (!(await onRemoveHistorySession(sessionId, "delete", true))) {
          return false;
        }
      }
      return true;
    },
    [onRemoveHistorySession],
  );

  const onManageWorktrees = useCallback(() => {
    setSettingsSection("worktrees");
    setSettingsOpen(true);
  }, [setSettingsOpen, setSettingsSection]);

  const onWorkspaceModeChange = useCallback(
    (
      sessionId: string,
      mode: import("../lib/session").WorkspaceMode,
      base?: string,
    ) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (
            session.id !== sessionId ||
            (!isBlankSession(session) &&
              !(session.workspaceMode && !session.worktreeCwd && !session.busy))
          ) {
            return session;
          }
          return mode === "worktree"
            ? base || session.worktreeBase
              ? {
                  ...session,
                  workspaceMode: "worktree",
                  worktreeBase: base || session.worktreeBase,
                }
              : session
            : {
                ...session,
                workspaceMode: undefined,
                worktreeBase: undefined,
              };
        }),
      );
    },
    [setSessions],
  );

  const onWorktreeBaseChange = useCallback(
    (sessionId: string, base: string) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId &&
          (isBlankSession(session) ||
            (!!session.workspaceMode &&
              !session.worktreeCwd &&
              !session.busy)) &&
          session.workspaceMode === "worktree"
            ? { ...session, worktreeBase: base }
            : session,
        ),
      );
    },
    [setSessions],
  );

  const requestSessionDelete = useCallback(
    async (
      label: string,
      seed: Pick<Session, "cwd" | "worktreeCwd"> | undefined,
      sessionId: string,
    ): Promise<{ confirmed: boolean; deleteWorktreePath?: string }> => {
      deleteConfirmationPending.current = true;
      try {
        let unusedWorktree: string | undefined;
        if (seed?.worktreeCwd) {
          try {
            const { worktrees } = await listWorktrees(seed.cwd);
            const tree = worktrees.find(
              (entry) => pathKey(entry.path) === pathKey(seed.worktreeCwd!),
            );
            if (
              tree &&
              !tree.isMain &&
              !tree.locked &&
              tree.branch &&
              worktreeSessionIds(tree, sessionsRef.current).every(
                (id) => id === sessionId,
              )
            )
              unusedWorktree = tree.path;
          } catch {
            // A failed lookup must never offer filesystem cleanup.
          }
        }
        // Only confirm when an unused worktree exists; plain deletions rely
        // on the unsaved-files/terminal guards in the removal flow.
        if (!unusedWorktree) return { confirmed: true };
        const choice = await new Promise<SessionDeleteChoice>((resolve) => {
          setSessionDeleteDialog({ title: label, unusedWorktree, resolve });
        });
        if (!choice.confirmed) return { confirmed: false };
        return {
          confirmed: true,
          deleteWorktreePath: choice.deleteWorktree
            ? unusedWorktree
            : undefined,
        };
      } finally {
        deleteConfirmationPending.current = false;
      }
    },
    [sessionsRef],
  );

  const removeWorktreeAfterDelete = useCallback(
    async (cwd: string, path: string) => {
      try {
        await onRemoveWorktree(cwd, path, false);
      } catch (error) {
        void message(
          `The session was deleted. Its worktree was kept.\n\n${String(error)}\n\nYou can manage it in Settings → Worktrees.`,
          { title: "MonoCode", kind: "warning" },
        );
      }
    },
    [onRemoveWorktree],
  );

  const deletionHooks: WorktreeDeletionHooks = {
    switchingWorktrees,
    deleteConfirmationPending,
    requestSessionDelete,
    removeWorktreeAfterDelete,
  };

  return {
    switchingWorktrees,
    removingWorktreePaths,
    deleteConfirmationPending,
    sessionDeleteDialog,
    setSessionDeleteDialog,
    deletionHooks,
    onCheckWorktreeRemoval,
    onRemoveWorktree,
    onWorktreeChange,
    onDeleteWorktreeSessions,
    onManageWorktrees,
    onWorkspaceModeChange,
    onWorktreeBaseChange,
  };
}
