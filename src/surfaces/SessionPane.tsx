import { ChevronDown, GripVertical, Search, X } from "../chrome/icons";
import { searchTranscriptBlocks } from "../lib/transcriptSearch";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Composer } from "../chrome/Composer";
import { MessageQueue } from "../chrome/MessageQueue";
import type { Worktree } from "../lib/worktrees";
import type { WorkspaceMode } from "../lib/session";
import { ErrorBoundary } from "../chrome/ErrorBoundary";
import { orchestrator, sameCheckout } from "../lib/orchestration";
import { isCustomEvent, reportError } from "../lib/errors";
import { DiscussionEmpty } from "../chrome/DiscussionEmpty";
import { LinkedWorkItemUpdateNotice } from "../chrome/LinkedWorkItemUpdateNotice";
import { SessionReview } from "../chrome/SessionReview";
import { PromptOutline } from "../chrome/PromptOutline";
import { TasksPill } from "../chrome/TasksPill";
import {
  loadExperimentalAnimations,
  loadTasksPill,
  EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT,
  TASKS_PILL_CHANGE_EVENT,
} from "../lib/appearance";
import { useReducedMotion } from "../lib/motion";
import {
  canCompactHarnessContext,
  type ApprovalDecision,
  type UserQuestionReply,
} from "../lib/harness";
import { looksLikeProject, type RecentProject } from "../lib/recents";
import {
  sessionDisplayTitle,
  sessionWorkCwd,
  type Attachment,
  type Block,
  type HarnessId,
  type LinkedWorkItem,
  type ModelTarget,
  type PlanBuildTarget,
  type RuntimeMode,
  type Session,
  type ComposerTurnOptions,
} from "../lib/session";
import { AgentTranscript } from "./AgentTranscript";
import { EmptySession } from "./EmptySession";
import { MOD } from "../lib/platform";
import {
  acknowledgeQuoteRequest,
  ADD_TO_CHAT_EVENT,
  type AddToChatRequest,
  type QuoteRequest,
} from "../lib/quoteDraft";
import {
  activateSessionDraft,
  flushSessionDraft,
  getLiveDraft,
  loadSessionDraft,
  saveSessionDraft,
  setLiveDraft,
} from "../lib/composerDraft";
import { createNote, noteTitle } from "../lib/notes";
import { canEditLastTurn, lastTurnRecall } from "../lib/editLastTurn";
import { loadNotesEnabled, subscribeNotesEnabled } from "../lib/settings";
import { resolveModel } from "../lib/models";
import { isAstraModel } from "../lib/astraWelcome";
import { AstraWelcome } from "./AstraWelcome";
import { projectKey } from "../lib/paths";
import {
  loadProjectChatBackgroundSettings,
  projectChatBackgroundRevision,
  subscribeProjectChatBackground,
} from "../lib/projectChatBackground";
import { projectChatBackgroundSrc } from "../lib/chatBackground";
import {
  loadChatBackgroundPath,
  subscribeChatBackgroundPath,
} from "../lib/appearance";
import type { SessionFolderTarget } from "../lib/sessionFolders";
import { markLinkedSessionUpdateSeen } from "../lib/linkedSessionSeen";

type Props = {
  session: Session;
  reviewUndoLocked?: boolean;
  visible: boolean;
  focused: boolean;
  addToChatTarget?: boolean;
  inSplit: boolean;
  composerFocused: boolean;
  composerFocusToken?: number;
  recents: RecentProject[];
  hideProjectPicker?: boolean;
  onFocus: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onCwdChange: (sessionId: string, cwd: string) => void;
  onBranchChange: (sessionId: string) => void;
  onModelChange: (sessionId: string, harness: HarnessId, model: string) => void;
  onModelSettingsChange: (
    sessionId: string,
    settings: Record<string, string>,
  ) => void;
  onRuntimeModeChange: (sessionId: string, mode: RuntimeMode) => void;
  onSubmit: (
    sessionId: string,
    text: string,
    attachments: Attachment[],
    options?: ComposerTurnOptions,
  ) => boolean | "steered" | void;
  onStop: (sessionId: string) => Promise<void>;
  onCompactContext: (sessionId: string) => boolean;
  onPlaceSessionInFolder: (
    sessionId: string,
    target: SessionFolderTarget,
  ) => void;
  onDeleteQueuedMessage: (sessionId: string, messageId: string) => void;
  onEditQueuedMessage: (
    sessionId: string,
    messageId: string,
    text: string,
  ) => void;
  onQueuedMessageEditingChange: (sessionId: string, messageId?: string) => void;
  onSteerQueuedMessage: (sessionId: string, messageId: string) => void;
  onResumeQueue: (sessionId: string) => void;
  onInboxCardDismiss?: (sessionId: string) => void;
  onLinkedWorkItemUpdateCardDismiss?: (sessionId: string) => void;
  onNoteCardDismiss?: (sessionId: string) => void;
  onHandoffCardDismiss?: (sessionId: string) => void;
  onOpenLinkedWorkItem?: (item: LinkedWorkItem, sessionId: string) => void;
  onArchiveSession?: (sessionId: string, archived: boolean) => Promise<boolean>;
  onDeleteSession?: (sessionId: string) => Promise<boolean>;
  onApproval: (
    sessionId: string,
    requestId: number,
    decision: ApprovalDecision,
  ) => void;
  onQuestionReply: (
    sessionId: string,
    requestId: number,
    reply: UserQuestionReply,
  ) => void;
  onQuestionInteraction?: (sessionId: string, requestId: number) => void;
  onOpenFile: (path: string) => void;
  onOpenDiff: (
    path?: string,
    session?: { sessionId: string; cwd: string },
  ) => void;
  onOpenPlan: (sessionId: string, blockId: string) => void;
  onBuildPlan: (
    sessionId: string,
    blockId: string,
    target?: PlanBuildTarget,
  ) => void;
  onSecondOpinion?: (
    sessionId: string,
    target: ModelTarget,
    turn: Block[],
  ) => void;
  onHandoff?: (sessionId: string, target: ModelTarget, turn: Block[]) => void;
  onWorktreeChange?: (sessionId: string, tree: Worktree) => Promise<void>;
  onManageWorktrees?: () => void;
  onWorkspaceModeChange: (
    sessionId: string,
    mode: WorkspaceMode,
    base?: string,
  ) => void;
  onWorktreeBaseChange: (sessionId: string, base: string) => void;
  onNewTerminal: (sessionId: string) => void;
  onPaneDragStart?: (event: ReactPointerEvent<HTMLElement>) => void;
};

const SessionPaneContent = memo(function SessionPaneContent({
  session,
  reviewUndoLocked = false,
  visible,
  focused,
  addToChatTarget = focused,
  inSplit,
  composerFocused,
  composerFocusToken,
  recents,
  hideProjectPicker,
  onFocus,
  onClose,
  onCwdChange,
  onBranchChange,
  onModelChange,
  onModelSettingsChange,
  onRuntimeModeChange,
  onSubmit,
  onStop,
  onCompactContext,
  onPlaceSessionInFolder,
  onDeleteQueuedMessage,
  onEditQueuedMessage,
  onQueuedMessageEditingChange,
  onSteerQueuedMessage,
  onResumeQueue,
  onInboxCardDismiss,
  onLinkedWorkItemUpdateCardDismiss,
  onNoteCardDismiss,
  onHandoffCardDismiss,
  onOpenLinkedWorkItem,
  onArchiveSession,
  onDeleteSession,
  onApproval,
  onQuestionReply,
  onQuestionInteraction,
  onOpenFile,
  onOpenDiff,
  onOpenPlan,
  onBuildPlan,
  onSecondOpinion,
  onHandoff,
  onWorktreeChange,
  onManageWorktrees,
  onWorkspaceModeChange,
  onWorktreeBaseChange,
  onNewTerminal,
  onPaneDragStart,
}: Props) {
  const orchestrationRuns = useSyncExternalStore(
    orchestrator.subscribe,
    orchestrator.snapshot,
    orchestrator.snapshot,
  );
  const managed = orchestrationRuns.some(
    (run) =>
      (run.status === "active" || run.status === "paused") &&
      sameCheckout(run.cwd, sessionWorkCwd(session)),
  );
  const title = sessionDisplayTitle(session.title, session.harness);
  const isEmpty = session.blocks.length === 0;
  const recallLastTurnRef = useRef<(() => void) | null>(null);
  const editLastTurnSupported = canEditLastTurn(session);
  const turnRecall = useMemo(
    () => (editLastTurnSupported ? lastTurnRecall(session) : null),
    [editLastTurnSupported, session],
  );
  const backgroundRevision = useSyncExternalStore(
    subscribeProjectChatBackground,
    projectChatBackgroundRevision,
    projectChatBackgroundRevision,
  );
  const globalBackgroundPath = useSyncExternalStore(
    subscribeChatBackgroundPath,
    loadChatBackgroundPath,
    loadChatBackgroundPath,
  );
  const projectBackground = loadProjectChatBackgroundSettings(
    projectKey(session.cwd),
  );
  const projectBackgroundStyle = projectBackground
    ? ({
        "--chat-background-image": `url(${JSON.stringify(
          projectChatBackgroundSrc(projectBackground.path, backgroundRevision),
        )})`,
        "--chat-background-empty-opacity": String(
          projectBackground.emptyOpacity,
        ),
        "--chat-background-session-opacity": String(
          projectBackground.sessionOpacity,
        ),
      } as CSSProperties)
    : undefined;
  const approve = useCallback(
    (requestId: number, decision: ApprovalDecision) =>
      onApproval(session.id, requestId, decision),
    [onApproval, session.id],
  );
  const replyQuestion = useCallback(
    (requestId: number, reply: UserQuestionReply) =>
      onQuestionReply(session.id, requestId, reply),
    [onQuestionReply, session.id],
  );
  const openPlan = useCallback(
    (blockId: string) => onOpenPlan(session.id, blockId),
    [onOpenPlan, session.id],
  );
  const buildPlan = useCallback(
    (blockId: string, target?: PlanBuildTarget) =>
      onBuildPlan(session.id, blockId, target),
    [onBuildPlan, session.id],
  );
  const onSecondOpinionForTranscript = useCallback(
    (target: ModelTarget, turn: Block[]) => {
      if (session.inboxAsk || session.worktreeRemoved || !onSecondOpinion)
        return;
      onSecondOpinion(session.id, target, turn);
    },
    [onSecondOpinion, session.id, session.inboxAsk, session.worktreeRemoved],
  );
  const onHandoffForTranscript = useCallback(
    (target: ModelTarget, turn: Block[]) => {
      if (session.inboxAsk || session.worktreeRemoved || !onHandoff) return;
      onHandoff(session.id, target, turn);
    },
    [onHandoff, session.id, session.inboxAsk, session.worktreeRemoved],
  );
  const workCwdForAccessory = sessionWorkCwd(session);
  const [animationsEnabled, setAnimationsEnabled] = useState(
    loadExperimentalAnimations,
  );
  useEffect(() => {
    const onChange = (event: Event) => {
      setAnimationsEnabled(
        (event as CustomEvent<boolean>).detail ?? loadExperimentalAnimations(),
      );
    };
    window.addEventListener(EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(EXPERIMENTAL_ANIMATIONS_CHANGE_EVENT, onChange);
    };
  }, []);
  const reduceMotion = useReducedMotion();
  const latestTurnAccessory = useMemo(
    () =>
      session.inboxAsk || session.worktreeRemoved ? undefined : (
        <SessionReview
          sessionId={session.id}
          cwd={workCwdForAccessory}
          enabled={visible}
          busy={!!session.busy}
          animationsEnabled={animationsEnabled && !reduceMotion}
          undoLocked={
            reviewUndoLocked ||
            orchestrationRuns.some(
              (run) =>
                (run.status === "active" || run.status === "paused") &&
                (run.leadId === session.id ||
                  run.tasks.some((task) => task.sessionId === session.id)),
            )
          }
          onOpenDiff={onOpenDiff}
        />
      ),
    [
      session.inboxAsk,
      session.worktreeRemoved,
      session.id,
      session.busy,
      workCwdForAccessory,
      visible,
      reviewUndoLocked,
      orchestrationRuns,
      onOpenDiff,
      animationsEnabled,
      reduceMotion,
    ],
  );
  const jumpToBottomRef = useRef<(() => void) | null>(null);
  const transcriptScope = useRef<HTMLDivElement>(null);
  const quoteRequestId = useRef(0);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [tasksPillEnabled, setTasksPillEnabled] = useState(loadTasksPill);
  useEffect(() => {
    const onChange = (event: Event) => {
      setTasksPillEnabled(
        (event as CustomEvent<boolean>).detail ?? loadTasksPill(),
      );
    };
    window.addEventListener(TASKS_PILL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(TASKS_PILL_CHANGE_EVENT, onChange);
    };
  }, []);
  const astraWelcomeSequence = useRef(0);
  const [astraWelcomeRun, setAstraWelcomeRun] = useState<number | null>(null);
  const dismissAstraWelcome = useCallback(() => setAstraWelcomeRun(null), []);
  useEffect(() => {
    if (!visible) setAstraWelcomeRun(null);
  }, [visible]);
  // Restore a saved run for this lead; its agents render on the sidebar card.
  // Deferred past first paint: hydrate only feeds the sidebar, so it must
  // not contend with transcript/composer mount on session switch.
  useEffect(() => {
    if (!session.inboxAsk && !session.worktreeRemoved) {
      const run = () =>
        void orchestrator
          .hydrate(session.id)
          .catch(reportError("SessionPane.hydrate", { sessionId: session.id }));
      if (typeof requestIdleCallback !== "undefined") {
        const id = requestIdleCallback(run, { timeout: 1000 });
        return () => cancelIdleCallback(id);
      }
      const timer = window.setTimeout(run, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [session.id, session.inboxAsk, session.worktreeRemoved]);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest>();
  const [editingLastTurn, setEditingLastTurn] = useState(false);
  useEffect(() => {
    setEditingLastTurn(false);
  }, [session.id, editLastTurnSupported]);
  const onJumpToBottomReady = useCallback((jump: () => void) => {
    jumpToBottomRef.current = jump;
  }, []);
  const revealBlockRef = useRef<((blockId: string) => boolean) | null>(null);
  const onRevealReady = useCallback((reveal: (blockId: string) => boolean) => {
    revealBlockRef.current = reveal;
  }, []);
  const revealBlock = useCallback(
    (blockId: string) => revealBlockRef.current?.(blockId) ?? false,
    [],
  );
  // In-transcript find: the virtualized list unmounts off-screen turns, so
  // the webview find cannot reach them. Hits navigate via revealBlock.
  const [transcriptSearchOpen, setTranscriptSearchOpen] = useState(false);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptHit, setTranscriptHit] = useState(0);
  const transcriptHits = useMemo(
    () => searchTranscriptBlocks(session.blocks, transcriptQuery),
    [session.blocks, transcriptQuery],
  );
  useEffect(() => {
    setTranscriptHit(0);
  }, [transcriptQuery, session.id]);
  useEffect(() => {
    if (!visible) setTranscriptSearchOpen(false);
  }, [visible]);
  const goTranscriptHit = useCallback(
    (direction: 1 | -1) => {
      if (transcriptHits.length === 0) return;
      const next =
        (transcriptHit + direction + transcriptHits.length) %
        transcriptHits.length;
      setTranscriptHit(next);
      const hit = transcriptHits[next];
      if (hit) revealBlock(hit.blockId);
    },
    [transcriptHits, transcriptHit, revealBlock],
  );
  const addSelectionToChat = useCallback(
    (text: string, mode?: QuoteRequest["mode"]) => {
      quoteRequestId.current += 1;
      setQuoteRequest({ id: quoteRequestId.current, text, mode });
    },
    [],
  );
  const acknowledgeQuote = useCallback((handledId: number) => {
    setQuoteRequest((current) => acknowledgeQuoteRequest(current, handledId));
  }, []);
  const notesEnabled = useSyncExternalStore(
    subscribeNotesEnabled,
    loadNotesEnabled,
    () => true,
  );
  const saveNote = useCallback(
    async (text: string) => {
      const sessionTitle = sessionDisplayTitle(session.title, session.harness);
      await createNote({
        title:
          sessionTitle && sessionTitle !== "New session"
            ? sessionTitle
            : noteTitle(text),
        body: text,
        sourceSessionId: session.id,
        sourceCwd: session.cwd,
      });
    },
    [session.cwd, session.harness, session.id, session.title],
  );
  const saveSelectionNote = useCallback(
    async (text: string) => {
      await createNote({
        title: noteTitle(text),
        body: text,
        sourceSessionId: session.id,
        sourceCwd: session.cwd,
      });
    },
    [session.cwd, session.id],
  );

  useEffect(() => {
    if (!addToChatTarget) return;
    const onAdd = (event: Event) => {
      if (!isCustomEvent<AddToChatRequest>(event)) return;
      const detail = event.detail;
      if (!detail?.text) return;
      addSelectionToChat(detail.text, detail.mode);
    };
    window.addEventListener(ADD_TO_CHAT_EVENT, onAdd);
    return () => window.removeEventListener(ADD_TO_CHAT_EVENT, onAdd);
  }, [addSelectionToChat, addToChatTarget]);
  const workCwd = sessionWorkCwd(session);
  const showDeckProjectPicker = isEmpty && !looksLikeProject(session.cwd);
  const dockComposer = !isEmpty || inSplit || !!session.inboxAsk;
  const draftRef = useRef<string | undefined>(getLiveDraft(session.id));
  const [restoredDraft, setRestoredDraft] = useState<string | undefined>(
    getLiveDraft(session.id),
  );
  const [draftReady, setDraftReady] = useState(
    getLiveDraft(session.id) !== undefined,
  );
  useEffect(() => {
    let cancelled = false;
    activateSessionDraft(session.id);
    const liveDraft = getLiveDraft(session.id);
    draftRef.current = liveDraft;
    setRestoredDraft(liveDraft);
    setDraftReady(liveDraft !== undefined);
    void loadSessionDraft(session.id).then((text) => {
      if (cancelled) return;
      if (liveDraft === undefined) {
        draftRef.current = text;
        setRestoredDraft(text);
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [session.id]);
  useEffect(() => {
    return () => {
      void flushSessionDraft().catch(
        reportError("SessionPane.flushDraft", { sessionId: session.id }),
      );
    };
  }, [session.id]);
  // Memoized element: hidden panes (and panes whose session didn't change)
  // skip reconciling the whole composer tree on unrelated renders.
  // Callbacks from App are stable; the session object is the live dep.
  const composer = useMemo(
    () => (
      <Composer
        enabled={visible}
        focused={focused && composerFocused}
        focusToken={composerFocusToken}
        hotkeys={focused}
        shell={!dockComposer}
      harness={session.harness}
      model={session.model}
      modelSettings={session.modelSettings}
      runtimeMode={session.runtimeMode}
      cwd={session.cwd}
      executionCwd={workCwd}
      sessionId={session.id}
      draftReady={draftReady}
      compactSupported={canCompactHarnessContext(session.harness)}
      recents={recents}
      chrome={{
        hideProjectPicker:
          !!session.inboxAsk ||
          (hideProjectPicker ? !showDeckProjectPicker : false),
        hideBranchPicker: !!session.inboxAsk || managed,
        hideTopBar: !!session.inboxAsk,
      }}
      context={session.context}
      quoteRequest={quoteRequest}
      initialDraft={
        draftRef.current ??
        (session.inboxCard || session.noteCard || session.handoffCard
          ? undefined
          : (session.composerSeed ?? restoredDraft))
      }
      onDraftChange={(text) => {
        draftRef.current = text;
        setLiveDraft(session.id, text);
        saveSessionDraft(session.id, text);
      }}
      inboxCard={session.inboxCard}
      noteCard={session.noteCard}
      handoffCard={session.handoffCard}
      question={session.pendingQuestion}
      onQuoteRequestConsumed={acknowledgeQuote}
      onInboxCardDismiss={() => onInboxCardDismiss?.(session.id)}
      onNoteCardDismiss={() => onNoteCardDismiss?.(session.id)}
      onHandoffCardDismiss={() => onHandoffCardDismiss?.(session.id)}
      onQuestionReply={replyQuestion}
      onQuestionInteraction={(id) => onQuestionInteraction?.(session.id, id)}
      onFocus={() => onFocus(session.id)}
      onCwdChange={(cwd) => onCwdChange(session.id, cwd)}
      onBranchChange={() => onBranchChange(session.id)}
      onWorktreeChange={
        onWorktreeChange
          ? (tree) => onWorktreeChange(session.id, tree)
          : undefined
      }
      draftWorkspace={
        !session.inboxAsk &&
        !session.worktreeRemoved &&
        !managed &&
        ((isEmpty && !session.worktreeCwd) ||
          (!!session.workspaceMode && !session.worktreeCwd))
      }
      workspaceMode={session.workspaceMode}
      worktreeBase={session.worktreeBase}
      onWorkspaceModeChange={(mode, base) =>
        onWorkspaceModeChange(session.id, mode, base)
      }
      onWorktreeBaseChange={(base) => onWorktreeBaseChange(session.id, base)}
      worktreeRemoved={session.worktreeRemoved}
      onManageWorktrees={onManageWorktrees}
      onNewTerminal={() => onNewTerminal(session.id)}
      onModelChange={(harness, model) => {
        onModelChange(session.id, harness, model);
        const selected = resolveModel(harness, model);
        // A new key restarts the animation and its cleanup timer on every pick.
        setAstraWelcomeRun(
          isAstraModel(selected) ? ++astraWelcomeSequence.current : null,
        );
      }}
      onModelSettingsChange={(settings) =>
        onModelSettingsChange(session.id, settings)
      }
      onRuntimeModeChange={(mode) => onRuntimeModeChange(session.id, mode)}
      onSubmit={(text, attachments, options) =>
        onSubmit(session.id, text, attachments, options)
      }
      onStop={() =>
        void onStop(session.id).catch(
          reportError("SessionPane.stop", { sessionId: session.id }),
        )
      }
      onCompactContext={() => onCompactContext(session.id)}
      onPlaceInFolder={(target) => onPlaceSessionInFolder(session.id, target)}
      onOpenFile={onOpenFile}
      busy={!!session.busy}
      editLastTurnSupported={editLastTurnSupported}
      lastTurnRecall={turnRecall}
      onRecallLastTurnReady={(recall) => {
        recallLastTurnRef.current = recall;
      }}
      onEditingLastTurnChange={setEditingLastTurn}
      />
    ),
    [
      visible,
      focused,
      composerFocused,
      composerFocusToken,
      dockComposer,
      session,
      workCwd,
      recents,
      hideProjectPicker,
      showDeckProjectPicker,
      managed,
      quoteRequest,
      restoredDraft,
      draftReady,
      acknowledgeQuote,
      replyQuestion,
      onInboxCardDismiss,
      onNoteCardDismiss,
      onHandoffCardDismiss,
      onQuestionInteraction,
      onFocus,
      onCwdChange,
      onBranchChange,
      onWorktreeChange,
      onWorkspaceModeChange,
      onWorktreeBaseChange,
      onManageWorktrees,
      onNewTerminal,
      onModelChange,
      onModelSettingsChange,
      onRuntimeModeChange,
      onSubmit,
      onStop,
      onCompactContext,
      onPlaceSessionInFolder,
      onDeleteQueuedMessage,
      onEditQueuedMessage,
      onQueuedMessageEditingChange,
      onSteerQueuedMessage,
      onResumeQueue,
      onOpenFile,
      isEmpty,
      editLastTurnSupported,
      turnRecall,
    ],
  );

  return (
    <div
      data-session-drop={session.id}
      data-session-empty={isEmpty}
      data-project-chat-background={!!projectBackground}
      data-project-background-scope={projectBackground?.scope}
      style={projectBackgroundStyle}
      className="chat-pane-background relative isolate flex h-full min-h-0 min-w-0 flex-1 flex-col"
      onMouseDown={() => onFocus(session.id)}
    >
      {astraWelcomeRun !== null && visible ? (
        <AstraWelcome key={astraWelcomeRun} onDone={dismissAstraWelcome} />
      ) : null}
      {inSplit ? (
        <div
          className={`flex h-9 shrink-0 touch-none items-center gap-1.5 border-b border-stroke px-2 select-none ${
            onPaneDragStart ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          onPointerDown={(event) => {
            if (event.button !== 0 || !onPaneDragStart) return;
            if (
              (event.target as HTMLElement | null)?.closest("[data-no-drag]")
            ) {
              return;
            }
            onPaneDragStart(event);
          }}
        >
          {onPaneDragStart ? (
            <GripVertical
              className="size-3.5 shrink-0 text-content/35"
              strokeWidth={1.75}
            />
          ) : null}
          <span
            className={`size-2 shrink-0 rounded-full ${focused ? "bg-accent" : "bg-transparent"}`}
          />
          <span
            className="min-w-0 flex-1 truncate text-xs text-content"
            title={title}
          >
            {title}
          </span>
          <button
            type="button"
            title={`Close Pane (${MOD}W)`}
            aria-label="Close pane"
            data-no-drag
            className="grid size-5 shrink-0 place-items-center rounded text-content/50 hover:bg-content/10 hover:text-content"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose(session.id);
            }}
          >
            <X className="size-3" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={transcriptScope}
          className="@container relative min-h-0 flex-1"
        >
          {visible && focused && !session.inboxAsk ? (
            <LinkedWorkItemUpdateNotice
              sessionId={session.id}
              card={session.linkedWorkItemUpdateCard}
              onAcknowledge={() => {
                const updatedAt = session.linkedWorkItemUpdateCard?.updatedAt;
                if (updatedAt != null) {
                  markLinkedSessionUpdateSeen(session.id, updatedAt);
                }
              }}
              onDismiss={() => onLinkedWorkItemUpdateCardDismiss?.(session.id)}
              onOpenDiscussion={() => {
                if (session.linkedWorkItem) {
                  onOpenLinkedWorkItem?.(session.linkedWorkItem, session.id);
                }
              }}
              onAddToChat={(text) => addSelectionToChat(text, "plain")}
              onArchiveSession={
                onArchiveSession
                  ? () => onArchiveSession(session.id, true)
                  : undefined
              }
              onDeleteSession={
                onDeleteSession ? () => onDeleteSession(session.id) : undefined
              }
            />
          ) : null}
          {isEmpty ? (
            session.inboxAsk ? (
              <div className="scrollbar-none h-full min-h-0 overflow-y-auto overflow-x-clip">
                <DiscussionEmpty message="Explore this item with your agent." />
              </div>
            ) : (
              <EmptySession
                cwd={session.cwd}
                hasChatBackground={Boolean(
                  projectBackground || globalBackgroundPath,
                )}
                composer={dockComposer ? undefined : composer}
              />
            )
          ) : (
            <>
              <AgentTranscript
                blocks={session.blocks}
                busy={!!session.busy}
                visible={visible}
                cwd={workCwd}
                harness={session.harness}
                model={session.model}
                modelSettings={session.modelSettings}
                pendingQuestion={!!session.pendingQuestion}
                onApproval={session.worktreeRemoved ? undefined : approve}
                onAddToChat={addSelectionToChat}
                onSaveNote={notesEnabled ? saveNote : undefined}
                onSaveSelectionNote={
                  notesEnabled ? saveSelectionNote : undefined
                }
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
                onOpenPlan={openPlan}
                onBuildPlan={session.worktreeRemoved ? undefined : buildPlan}
                onSecondOpinion={
                  !session.inboxAsk &&
                  !session.worktreeRemoved &&
                  onSecondOpinion
                    ? onSecondOpinionForTranscript
                    : undefined
                }
                onHandoff={
                  !session.inboxAsk &&
                  !session.worktreeRemoved &&
                  onHandoff
                    ? onHandoffForTranscript
                    : undefined
                }
                onJumpToBottomChange={setShowJumpToBottom}
                onJumpToBottomReady={onJumpToBottomReady}
                onRevealReady={onRevealReady}
                editingLastTurn={editingLastTurn}
                onEditLastTurn={
                  editLastTurnSupported
                    ? () => {
                        onFocus(session.id);
                        recallLastTurnRef.current?.();
                      }
                    : undefined
                }
                latestTurnAccessory={latestTurnAccessory}
              />
              <PromptOutline
                blocks={session.blocks}
                scope={transcriptScope}
                visible={visible}
                revealBlock={revealBlock}
              />
              {animationsEnabled && !reduceMotion ? (
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center gap-1 transition-opacity duration-200 ${
                    showJumpToBottom || transcriptSearchOpen
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                  inert={!showJumpToBottom && !transcriptSearchOpen}
                  aria-hidden={!showJumpToBottom && !transcriptSearchOpen}
                >
                  <JumpToBottomButton
                    onJump={() => jumpToBottomRef.current?.()}
                  />
                  <TranscriptSearchButton
                    onToggle={() =>
                      setTranscriptSearchOpen((open) => !open)
                    }
                  />
                </div>
              ) : showJumpToBottom || transcriptSearchOpen ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center gap-1">
                  <JumpToBottomButton
                    onJump={() => jumpToBottomRef.current?.()}
                  />
                  <TranscriptSearchButton
                    onToggle={() =>
                      setTranscriptSearchOpen((open) => !open)
                    }
                  />
                </div>
              ) : null}
              {transcriptSearchOpen ? (
                <TranscriptSearchBox
                  query={transcriptQuery}
                  onQuery={setTranscriptQuery}
                  hit={transcriptHits.length === 0 ? 0 : transcriptHit + 1}
                  total={transcriptHits.length}
                  excerpt={transcriptHits[transcriptHit]?.excerpt}
                  onNext={() => goTranscriptHit(1)}
                  onPrevious={() => goTranscriptHit(-1)}
                  onClose={() => setTranscriptSearchOpen(false)}
                />
              ) : null}
            </>
          )}
        </div>
        {dockComposer ? (
          <div className="mx-auto w-full max-w-4xl shrink-0">
            <MessageQueue
              messages={session.queuedMessages ?? []}
              status={session.queueStatus}
              onDelete={(messageId) =>
                onDeleteQueuedMessage(session.id, messageId)
              }
              onEdit={(messageId, text) =>
                onEditQueuedMessage(session.id, messageId, text)
              }
              onEditingChange={(messageId) =>
                onQueuedMessageEditingChange(session.id, messageId)
              }
              onSteer={(messageId) =>
                onSteerQueuedMessage(session.id, messageId)
              }
              onResume={() => onResumeQueue(session.id)}
            />
            <TasksPill
              blocks={session.blocks}
              scope={transcriptScope}
              visible={visible}
              enabled={tasksPillEnabled}
              animationsEnabled={animationsEnabled}
              revealBlock={revealBlock}
            />
            {composer}
          </div>
        ) : null}
      </div>
    </div>
  );
});

function JumpToBottomButton({ onJump }: { onJump: () => void }) {
  return (
    <button
      type="button"
      title="Jump to latest"
      aria-label="Jump to latest"
      data-jump-to-bottom
      onClick={onJump}
      className="pointer-events-auto grid size-6 place-items-center rounded-md border border-content/15 bg-background-base/95 text-content shadow-md hover:bg-content/5"
    >
      <ChevronDown className="size-4" strokeWidth={2} />
    </button>
  );
}

function TranscriptSearchButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      type="button"
      title="Find in transcript"
      aria-label="Find in transcript"
      data-transcript-search-toggle
      onClick={onToggle}
      className="pointer-events-auto grid size-6 place-items-center rounded-md border border-content/15 bg-background-base/95 text-content shadow-md hover:bg-content/5"
    >
      <Search className="size-3.5" strokeWidth={2} />
    </button>
  );
}

function TranscriptSearchBox({
  query,
  onQuery,
  hit,
  total,
  excerpt,
  onNext,
  onPrevious,
  onClose,
}: {
  query: string;
  onQuery: (query: string) => void;
  hit: number;
  total: number;
  excerpt?: string;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="search"
      aria-label="Find in transcript"
      className="absolute inset-x-0 bottom-9 z-30 mx-auto flex w-[min(420px,calc(100%-2rem))] items-center gap-1.5 rounded-lg border border-content/15 bg-background-base/95 px-2 py-1.5 font-sans text-xs text-content shadow-xl"
    >
      <Search className="size-3.5 shrink-0 text-content/50" strokeWidth={2} />
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="text"
        value={query}
        aria-label="Find in transcript"
        placeholder="Find in transcript"
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-content/35"
      />
      <span
        aria-live="polite"
        title={excerpt ?? ""}
        className="max-w-40 shrink-0 truncate text-content/50 tabular-nums"
      >
        {total === 0 ? (query.trim() ? "0/0" : "") : `${hit}/${total}`}
      </span>
      <button
        type="button"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
        onClick={onPrevious}
        className="grid size-5 shrink-0 place-items-center rounded hover:bg-content/10"
      >
        <ChevronDown className="size-3.5 rotate-180" strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Next match (Enter)"
        aria-label="Next match"
        onClick={onNext}
        className="grid size-5 shrink-0 place-items-center rounded hover:bg-content/10"
      >
        <ChevronDown className="size-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Close find (Escape)"
        aria-label="Close find"
        onClick={onClose}
        className="grid size-5 shrink-0 place-items-center rounded hover:bg-content/10"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export const SessionPane = memo(function SessionPane(props: Props) {
  return (
    <ErrorBoundary label="Session">
      <SessionPaneContent {...props} />
    </ErrorBoundary>
  );
});
