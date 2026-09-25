import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { setGrabbing, suppressTextSelection } from "../lib/drag";
import {
  paneDropFromPoint,
  setExternalTitleTabDrop,
  titleTabDropFromPoint,
  useExternalPaneDrop,
  type TitleTabDropPosition,
} from "../lib/paneDrop";
import type { ApprovalDecision, UserQuestionReply } from "../lib/harness";
import type { EditorNavigationTarget } from "../lib/search";
import {
  layoutLeaves,
  layoutSashes,
  PANE_RESIZE_END_EVENT,
  setSplitRatio,
  type EditorPane,
  type LayoutNode,
  type LayoutSash,
  type PaneEdge,
} from "../lib/layout";
import { sameProjectPath, type RecentProject } from "../lib/recents";
import type { TerminalMetaPatch } from "../lib/terminalTab";
import {
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
import { FilePane } from "./FilePane";
import {
  useExitAnimation,
  useExperimentalAnimations,
} from "../hooks/useExitAnimation";
import { SessionPane } from "./SessionPane";
import type { SessionFolderTarget } from "../lib/sessionFolders";
import type { Worktree } from "../lib/worktrees";
import type { WorkspaceMode } from "../lib/session";

type Shared = {
  visible: boolean;
  sessions: Session[];
  editorPanes: EditorPane[];
  dirtyFileIds: Set<string>;
  fileErrorCounts: Map<string, number>;
  focusedId: string;
  addToChatSessionId?: string;
  composerFocused: boolean;
  composerFocusToken?: number;
  recents: RecentProject[];
  nextStepGenerations: Readonly<Record<string, number>>;
  dismissedNextStepGenerations: Readonly<Record<string, number>>;
  onDismissNextStep: (sessionId: string, generation: number) => void;
  hideProjectPicker?: boolean;
  onFocus: (paneId: string) => void;
  onClose: (sessionId: string) => void;
  onSelectFile: (paneId: string, fileId: string) => void;
  onCloseFile: (paneId: string, fileId: string) => void;
  onCloseOtherFiles: (paneId: string, fileId: string) => void;
  onReorderFiles: (paneId: string, ids: string[]) => void;
  onFileDirtyChange: (fileId: string, dirty: boolean) => void;
  onFileErrorCountChange: (fileId: string, count: number) => void;
  onRatio: (splitId: string, index: number, ratio: number) => void;
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
  editorNavigation?: EditorNavigationTarget | null;
  onOpenDiff: (
    path?: string,
    session?: { sessionId: string; cwd: string },
  ) => void;
  onOpenPlan: (sessionId: string, blockId: string) => void;
  onUpdatePlan: (sessionId: string, blockId: string, text: string) => void;
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
  onMovePane: (fromId: string, toId: string, edge: PaneEdge) => void;
  onDetachPane: (
    paneId: string,
    targetTabId: string,
    position: TitleTabDropPosition,
  ) => void;
  onNewTerminal: (sessionId: string) => void;
  onTerminalMetaChange?: (fileId: string, patch: TerminalMetaPatch) => void;
};

type Props = Shared & { layout: LayoutNode };

type PaneDrag = {
  fromId: string;
  overId: string | null;
  edge: PaneEdge;
};

const DRAG_THRESHOLD = 5;

function PaneTreeComponent({
  visible,
  layout,
  sessions,
  editorPanes,
  dirtyFileIds,
  fileErrorCounts,
  focusedId,
  addToChatSessionId,
  composerFocused,
  composerFocusToken,
  recents,
  nextStepGenerations,
  dismissedNextStepGenerations,
  onDismissNextStep,
  hideProjectPicker,
  onFocus,
  onClose,
  onSelectFile,
  onCloseFile,
  onCloseOtherFiles,
  onReorderFiles,
  onFileDirtyChange,
  onFileErrorCountChange,
  onRatio,
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
  editorNavigation,
  onOpenDiff,
  onOpenPlan,
  onUpdatePlan,
  onBuildPlan,
  onSecondOpinion,
  onHandoff,
  onWorktreeChange,
  onManageWorktrees,
  onWorkspaceModeChange,
  onWorktreeBaseChange,
  onMovePane,
  onDetachPane,
  onNewTerminal,
  onTerminalMetaChange,
}: Props) {
  const treeRef = useRef<HTMLDivElement>(null);
  /** First paint of the tree is dry; panes mounted later may fade in. */
  const paintedRef = useRef(false);
  useEffect(() => {
    paintedRef.current = true;
  }, []);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [draft, setDraft] = useState<LayoutNode | null>(null);
  const [paneDrag, setPaneDrag] = useState<PaneDrag | null>(null);
  const externalDrop = useExternalPaneDrop(visible);
  const drop = paneDrag ?? externalDrop;
  const onMovePaneRef = useRef(onMovePane);
  onMovePaneRef.current = onMovePane;
  const onDetachPaneRef = useRef(onDetachPane);
  onDetachPaneRef.current = onDetachPane;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    setDraft(null);
  }, [layout]);

  // A sash drag re-renders this tree every frame. `SessionPane` compares props
  // shallowly, so handing it a fresh drag handler each frame would re-render
  // the whole session subtree (transcript, composer, picker) per frame.
  const dragHandlers = useRef(
    new Map<string, (event: ReactPointerEvent<HTMLElement>) => void>(),
  );
  const paneDragStartFor = (paneId: string) => {
    const cached = dragHandlers.current.get(paneId);
    if (cached) return cached;
    const handler = (event: ReactPointerEvent<HTMLElement>) =>
      startPaneDrag(paneId, event);
    dragHandlers.current.set(paneId, handler);
    return handler;
  };

  const tree = draft ?? layout;
  const leaves = layoutLeaves(tree);
  const sashes = layoutSashes(tree);
  const inSplit = leaves.length > 1;

  // Smooth file-pane exit: hold a just-closed pane mounted while its outro
  // plays, then drop it. Keyed by leaf so splits animate independently.
  const fileAnimations = useExperimentalAnimations();
  const [heldFilePanes, setHeldFilePanes] = useState<
    Record<string, EditorPane>
  >({});
  const prevEditorPanes = useRef<Map<string, EditorPane>>(new Map());
  const heldTimers = useRef<Record<string, number>>({});
  useEffect(() => {
    const current = new Map(editorPanes.map((pane) => [pane.id, pane]));
    const leafIds = new Set(leaves.map((leaf) => leaf.id));
    const disappeared = [...prevEditorPanes.current].filter(
      ([id]) => !current.has(id) && leafIds.has(id),
    );
    prevEditorPanes.current = current;
    if (!fileAnimations || disappeared.length === 0) return;
    setHeldFilePanes((prev) => {
      const next = { ...prev };
      for (const [id, pane] of disappeared) {
        if (!current.has(id)) next[id] = pane;
      }
      return next;
    });
    for (const [id] of disappeared) {
      window.clearTimeout(heldTimers.current[id]);
      heldTimers.current[id] = window.setTimeout(() => {
        setHeldFilePanes((prev) => {
          if (!prev[id]) return prev;
          const { [id]: _removed, ...rest } = prev;
          return rest;
        });
      }, 150);
    }
  }, [editorPanes, leaves, fileAnimations]);
  useEffect(
    () => () => {
      for (const timer of Object.values(heldTimers.current)) {
        window.clearTimeout(timer);
      }
    },
    [],
  );
  const dropHeldFilePane = useCallback((id: string) => {
    window.clearTimeout(heldTimers.current[id]);
    setHeldFilePanes((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const startPaneDrag = useCallback(
    (fromId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;

      let lastX = startX;
      let lastY = startY;
      handle.setPointerCapture(pointerId);
      const restoreSelection = suppressTextSelection();

      const onMove = (ev: PointerEvent) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (!active) {
          if (
            Math.hypot(ev.clientX - startX, ev.clientY - startY) <
            DRAG_THRESHOLD
          ) {
            return;
          }
          active = true;
          setGrabbing(true);
          onFocusRef.current(fromId);
          setPaneDrag({ fromId, overId: null, edge: "left" });
        }
        const titleTab = titleTabDropFromPoint(ev.clientX, ev.clientY);
        setExternalTitleTabDrop(titleTab ? { fromId, ...titleTab } : null);
        if (titleTab) {
          setPaneDrag({ fromId, overId: null, edge: "left" });
          return;
        }
        const over = paneDropFromPoint(ev.clientX, ev.clientY);
        if (!over || over.id === fromId) {
          setPaneDrag({
            fromId,
            overId: over?.id === fromId ? fromId : null,
            edge: over?.edge ?? "left",
          });
          return;
        }
        setPaneDrag({ fromId, overId: over.id, edge: over.edge });
      };

      const onUp = () => finish(true);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        finish(false);
      };

      function finish(commit: boolean) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKey);
        restoreSelection();
        setGrabbing(false);
        setPaneDrag(null);
        setExternalTitleTabDrop(null);
        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
        if (!active || !commit) return;
        const titleTab = titleTabDropFromPoint(lastX, lastY);
        if (titleTab) {
          onDetachPaneRef.current(
            fromId,
            titleTab.targetTabId,
            titleTab.position,
          );
          return;
        }
        const over = paneDropFromPoint(lastX, lastY);
        if (over && over.id !== fromId) {
          onMovePaneRef.current(fromId, over.id, over.edge);
        }
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey);
    },
    [],
  );

  return (
    <div ref={treeRef} className="relative h-full min-h-0 min-w-0">
      {leaves.map((leaf) => {
        const editorPane = editorPanes.find((pane) => pane.id === leaf.id);
        const session = sessions.find((entry) => entry.id === leaf.id);
        const dragging = drop?.fromId === leaf.id;
        const onPaneDragStart = inSplit ? paneDragStartFor(leaf.id) : undefined;
        const backgroundStyle = {
          "--chat-background-left": `${(-leaf.rect.x / leaf.rect.w) * 100}%`,
          "--chat-background-top": `${(-leaf.rect.y / leaf.rect.h) * 100}%`,
          "--chat-background-width": `${100 / leaf.rect.w}%`,
          "--chat-background-height": `${100 / leaf.rect.h}%`,
        } as CSSProperties;
        return (
          <div
            key={leaf.id}
            data-pane-id={leaf.id}
            className={`absolute flex min-h-0 min-w-0 flex-col overflow-hidden ${dragging ? "opacity-40" : ""}`}
            style={{
              left: `${leaf.rect.x * 100}%`,
              top: `${leaf.rect.y * 100}%`,
              width: `${leaf.rect.w * 100}%`,
              height: `${leaf.rect.h * 100}%`,
              ...backgroundStyle,
            }}
          >
            {drop && drop.overId === leaf.id && drop.fromId !== leaf.id ? (
              <PaneDropHint edge={drop.edge} />
            ) : null}
            {editorPane ?? heldFilePanes[leaf.id] ? (
              <FilePanePresence
                pane={(editorPane ?? heldFilePanes[leaf.id])!}
                exiting={!editorPane}
                animating={fileAnimations}
                onExitEnd={() => dropHeldFilePane(leaf.id)}
                paintedRef={paintedRef}
              >
                {(pane) => (
                  <FilePane
                    pane={pane}
                    focused={focusedId === pane.id}
                    dirtyFileIds={dirtyFileIds}
                    fileErrorCounts={fileErrorCounts}
                    sessions={sessions}
                    onFocus={onFocus}
                    onSelectFile={onSelectFile}
                    onCloseFile={onCloseFile}
                    onCloseOtherFiles={onCloseOtherFiles}
                    onReorderFiles={onReorderFiles}
                    onDirtyChange={onFileDirtyChange}
                    onErrorCountChange={onFileErrorCountChange}
                    onOpenFile={onOpenFile}
                    onUpdatePlan={onUpdatePlan}
                    onBuildPlan={onBuildPlan}
                    editorNavigation={editorNavigation}
                    onPaneDragStart={onPaneDragStart}
                    onTerminalMetaChange={onTerminalMetaChange}
                  />
                )}
              </FilePanePresence>
            ) : session ? (
              <SessionPane
                key={session.id}
                session={session}
                reviewUndoLocked={sessions.some(
                  (other) =>
                    other.id !== session.id &&
                    other.busy &&
                    sameProjectPath(
                      sessionWorkCwd(other),
                      sessionWorkCwd(session),
                    ),
                )}
                visible={visible}
                focused={focusedId === session.id}
                addToChatTarget={addToChatSessionId === session.id}
                inSplit={inSplit}
                composerFocused={composerFocused}
                composerFocusToken={composerFocusToken}
                recents={recents}
                nextStepGeneration={nextStepGenerations[session.id]}
                nextStepDismissedGeneration={
                  dismissedNextStepGenerations[session.id]
                }
                onDismissNextStep={onDismissNextStep}
                hideProjectPicker={hideProjectPicker}
                onFocus={onFocus}
                onClose={onClose}
                onCwdChange={onCwdChange}
                onBranchChange={onBranchChange}
                onModelChange={onModelChange}
                onModelSettingsChange={onModelSettingsChange}
                onRuntimeModeChange={onRuntimeModeChange}
                onSubmit={onSubmit}
                onStop={onStop}
                onCompactContext={onCompactContext}
                onPlaceSessionInFolder={onPlaceSessionInFolder}
                onDeleteQueuedMessage={onDeleteQueuedMessage}
                onEditQueuedMessage={onEditQueuedMessage}
                onQueuedMessageEditingChange={onQueuedMessageEditingChange}
                onSteerQueuedMessage={onSteerQueuedMessage}
                onResumeQueue={onResumeQueue}
                onInboxCardDismiss={onInboxCardDismiss}
                onLinkedWorkItemUpdateCardDismiss={
                  onLinkedWorkItemUpdateCardDismiss
                }
                onNoteCardDismiss={onNoteCardDismiss}
                onHandoffCardDismiss={onHandoffCardDismiss}
                onOpenLinkedWorkItem={onOpenLinkedWorkItem}
                onArchiveSession={onArchiveSession}
                onDeleteSession={onDeleteSession}
                onApproval={onApproval}
                onQuestionReply={onQuestionReply}
                onQuestionInteraction={onQuestionInteraction}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
                onOpenPlan={onOpenPlan}
                onBuildPlan={onBuildPlan}
                onSecondOpinion={onSecondOpinion}
                onHandoff={onHandoff}
                onWorktreeChange={onWorktreeChange}
                onManageWorktrees={onManageWorktrees}
                onWorkspaceModeChange={onWorkspaceModeChange}
                onWorktreeBaseChange={onWorktreeBaseChange}
                onNewTerminal={onNewTerminal}
                onPaneDragStart={onPaneDragStart}
              />
            ) : null}
          </div>
        );
      })}
      {sashes.map((sash) => (
        <Sash
          key={`${sash.splitId}:${sash.index}`}
          sash={sash}
          containerRef={treeRef}
          onPreview={(ratio) =>
            setDraft(
              setSplitRatio(layoutRef.current, sash.splitId, sash.index, ratio),
            )
          }
          onCommit={(ratio) => {
            setDraft(null);
            onRatio(sash.splitId, sash.index, ratio);
          }}
          onCancel={() => setDraft(null)}
        />
      ))}
    </div>
  );
}

export const PaneTree = memo(
  PaneTreeComponent,
  (previous, next) => !previous.visible && !next.visible,
);

/** Enter/exit wrapper for the file pane: fades the center pane in place and
 * holds a just-closed pane through its outro. Uses the shared exit hook so
 * a missing `animationend` (WebKitGTK) still unmounts via timeout. */
function FilePanePresence({
  pane,
  exiting,
  animating,
  onExitEnd,
  paintedRef,
  children,
}: {
  pane: EditorPane;
  exiting: boolean;
  animating: boolean;
  onExitEnd: () => void;
  /** True once the tree committed its first paint: panes mounted before
   * that are the boot layout and appear dry. */
  paintedRef: { current: boolean };
  children: (pane: EditorPane) => ReactNode;
}) {
  // Enter plays only for panes that arrive after boot; the boot layout
  // appears dry. Exit always plays while the held pane drains.
  const [entered, setEntered] = useState(() => paintedRef.current);
  const prevId = useRef(pane.id);
  useEffect(() => {
    if (prevId.current !== pane.id) {
      prevId.current = pane.id;
      setEntered(true);
    }
  }, [pane.id]);
  const { closing, requestClose, handleAnimationEnd, cancelClose } =
    useExitAnimation({
      enabled: animating,
      durationMs: 150,
      onExit: onExitEnd,
    });
  useEffect(() => {
    if (!animating) return;
    if (exiting) requestClose();
    else cancelClose();
  }, [exiting, animating, requestClose, cancelClose]);
  if (!animating) return <>{children(pane)}</>;
  const exitingOrClosing = exiting || closing;
  const motionClass = exitingOrClosing
    ? "pane-anim-out"
    : entered
      ? "pane-anim-in"
      : "";
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-1 flex-col ${motionClass}`}
      onAnimationEnd={exitingOrClosing ? handleAnimationEnd : undefined}
    >
      {children(pane)}
    </div>
  );
}

function PaneDropHint({ edge }: { edge: PaneEdge }) {
  const wash =
    edge === "left"
      ? "absolute inset-y-0 left-0 w-1/2 bg-accent/15"
      : edge === "right"
        ? "absolute inset-y-0 right-0 w-1/2 bg-accent/15"
        : edge === "top"
          ? "absolute inset-x-0 top-0 h-1/2 bg-accent/15"
          : "absolute inset-x-0 bottom-0 h-1/2 bg-accent/15";
  const line =
    edge === "left"
      ? "absolute inset-y-0 left-0 w-0.5 bg-accent"
      : edge === "right"
        ? "absolute inset-y-0 right-0 w-0.5 bg-accent"
        : edge === "top"
          ? "absolute inset-x-0 top-0 h-0.5 bg-accent"
          : "absolute inset-x-0 bottom-0 h-0.5 bg-accent";
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className={wash} />
      <div className={line} />
    </div>
  );
}

function Sash({
  sash,
  containerRef,
  onPreview,
  onCommit,
  onCancel,
}: {
  sash: LayoutSash;
  containerRef: { current: HTMLDivElement | null };
  onPreview: (ratio: number) => void;
  onCommit: (ratio: number) => void;
  onCancel: () => void;
}) {
  const row = sash.dir === "right";
  const boundary = sash.sizes
    .slice(0, sash.index + 1)
    .reduce((sum, size) => sum + size, 0);
  const group = sash.group;

  return (
    <div
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundary * 100)}
      className={
        row
          ? "absolute z-10 w-px bg-stroke"
          : "absolute z-10 h-px bg-stroke"
      }
      style={
        row
          ? {
              left: `${(group.x + boundary * group.w) * 100}%`,
              top: `${group.y * 100}%`,
              height: `${group.h * 100}%`,
            }
          : {
              left: `${group.x * 100}%`,
              top: `${(group.y + boundary * group.h) * 100}%`,
              width: `${group.w * 100}%`,
            }
      }
    >
      <div
        className={
          row
            ? "absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize touch-none"
            : "absolute inset-x-0 -top-1.5 -bottom-1.5 cursor-row-resize touch-none"
        }
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const handle = e.currentTarget;
          const parent = containerRef.current;
          if (!parent) return;
          handle.setPointerCapture(e.pointerId);
          // Same contract as useDragResize: while a sash moves, the tree
          // re-renders every frame and the whole window relayouts. Mark it so
          // continuous animations, cover images and backdrop blurs can stand
          // down until the drop (see html.is-resizing in index.css).
          document.documentElement.classList.add("is-resizing");
          const rect = parent.getBoundingClientRect();
          const restoreSelection = suppressTextSelection();
          const previousCursor = document.body.style.cursor;
          document.body.style.cursor = row ? "col-resize" : "row-resize";
          const origin = row
            ? rect.left + group.x * rect.width
            : rect.top + group.y * rect.height;
          const span = row ? group.w * rect.width : group.h * rect.height;
          let nextBoundary = boundary;
          let moved = false;
          let frame: number | null = null;

          const move = (ev: PointerEvent) => {
            const pos = row ? ev.clientX : ev.clientY;
            if (span <= 0) return;
            moved = true;
            nextBoundary = (pos - origin) / span;
            if (frame != null) return;
            frame = requestAnimationFrame(() => {
              frame = null;
              onPreview(nextBoundary);
            });
          };
          const finish = (commit: boolean) => {
            if (frame != null) {
              cancelAnimationFrame(frame);
              frame = null;
            }
            if (handle.hasPointerCapture(e.pointerId)) {
              handle.releasePointerCapture(e.pointerId);
            }
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            handle.removeEventListener("pointercancel", cancel);
            window.removeEventListener("keydown", keydown);
            restoreSelection();
            document.body.style.cursor = previousCursor;
            document.documentElement.classList.remove("is-resizing");
            window.dispatchEvent(new Event(PANE_RESIZE_END_EVENT));
            if (!moved) return;
            if (commit) onCommit(nextBoundary);
            else onCancel();
          };
          const up = () => finish(true);
          const cancel = () => finish(false);
          const keydown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            finish(false);
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
          handle.addEventListener("pointercancel", cancel);
          window.addEventListener("keydown", keydown);
        }}
      />
    </div>
  );
}
