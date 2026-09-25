import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  appendSteerUser,
  appendUser,
  canRewindHarnessLastTurn,
  canSteerHarness,
  cancelHarnessTurn,
  forgetHarnessSession,
  generateHarnessBranchName,
  generateHarnessTitle,
  isLiveHarness,
  pickTextHarness,
  promoteLastAssistantToPlan,
  rewindHarnessLastTurn,
  sendHarnessTurn,
  steerHarnessTurn,
  stopHarnessSession,
  stopStreaming,
  type HarnessEvent,
} from "../lib/harness";
import {
  HARNESS_LABEL,
  canReplaceSessionTitle,
  formatSessionTitle,
  sessionWorkCwd,
  titleFromPrompt,
  type Attachment,
  type PlanBuildTarget,
  type SecondOpinionMeta,
  type Session,
  type TurnIntent,
} from "../lib/session";
import type { ControlOutcome } from "../lib/orchestration";
import { orchestrator } from "../lib/orchestration";
import {
  CONTROL_BUFFER_CHARS,
  PROPOSAL_BUFFER_CHARS,
  truncateTail,
} from "../lib/truncate";
import { selectedProviderAccountId } from "../lib/providerAccounts";
import {
  completeOrchestrationProposal,
  completeOrRepairOrchestrationProposal,
  orchestrationRepairPrompt,
  orchestrationPlanningPrompt,
  proposalBlock,
  withOrchestrationProposal,
  type OrchestrationProposal,
} from "../lib/orchestrationPlan";
import {
  appendPreparingHandoff,
  buildDeterministicHandoff,
  chooseHandoffBrief,
  completeHandoff,
  consumeHandoff,
  handoffTurnCard,
  isPreparingHandoff,
  pendingHandoff,
  shouldAskOutgoingAgent,
  userMessagesAfterHandoff,
  type HandoffComposerCard,
} from "../lib/handoff";
import { requestOutgoingHandoff } from "../lib/handoffTurn";
import { buildPlanPrompt, isProviderFailureText, planTurnPrompt } from "../lib/plan";
import { composeNoteMessage, type NoteComposerCard } from "../lib/notes";
import { SECOND_OPINION_TITLE } from "../lib/secondOpinion";
import { CONTINUE_PROMPT } from "../lib/inFlight";
import { announceSessionFinished } from "../lib/notifications";
import { wrapHandoffPrompt } from "../lib/handoff";
import {
  dequeueQueuedMessage,
  queuedMessageForSubmit,
} from "../lib/messageQueue";
import {
  discoverOrchestrationSettings,
} from "../lib/orchestrationCatalog";
import {
  displayAttachments,
  prepareAttachments,
} from "../lib/attachments";
import {
  beginSessionTurn,
  flushSessionCheckpoint,
  notifyReviewChanged,
} from "../lib/checkpoint";
import { inboxAskPrompt } from "../lib/inboxAsk";
import { loadFollowUpBehavior, type FollowUpBehavior } from "../lib/settings";
import { notifyGitChanged } from "../lib/fs";
import { notifyUsageStale, usageProviderFor } from "../lib/rateLimits";
import {
  resolveModel,
  saveRecentModelChoice,
} from "../lib/models";
import { preparePrompt } from "../lib/promptPreparation";
import { isNativeCommandPrompt } from "../lib/skills";
import {
  createWorktree,
  namedWorktreeBranch,
  renameWorktreeBranch,
  temporaryWorktreeBranchName,
} from "../lib/worktrees";
import { pathKey } from "../lib/paths";
import { resolveLinkedWorkItem } from "../lib/sessionWorkItem";
import {
  lastAssistantTextInTurn,
  userTurnCards,
  withPlanBuildTarget,
  withPlanStatus,
} from "./sessionTransforms";
import {
  canEditLastTurn,
  lastUserTurnBlock,
  truncateBeforeLastUserTurn,
} from "../lib/editLastTurn";
import { useComposerModels } from "./composer/useComposerModels";
import {
  nudgeOpenEditors,
  nudgeWorkspace,
  scheduleNudge,
  trackSessionEdits,
} from "./workspaceEvents";


export interface ComposerDeps {
  sessionsRef: MutableRefObject<Session[]>;
  activeSessionIdRef: MutableRefObject<string | undefined>;
  turnGen: MutableRefObject<Map<string, number>>;
  removingSessionIds: MutableRefObject<Set<string>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  enqueueHarnessEvent: (sessionId: string, event: HarnessEvent) => void;
  flushHarnessEvents: () => void;
    dismissNoticesForContinuedSession: (sessionId: string) => void;
}

/** Phase 3 (clean-code): names the deliberate fire-and-forget swallows below.
 * Policy: only non-fatal side effects may ignore rejections, and only through
 * this helper — everything else propagates into ControlOutcome. */
function ignoreRejection(): undefined {
    return undefined;
}

/** Extract Method: the empty-submit guard reads as one named predicate. */
function isEmptySubmit(
    text: string,
    attachments: Attachment[],
    noteCard: NoteComposerCard | undefined,
    handoffCard: HandoffComposerCard | undefined,
): boolean {
    return (
        !text.trim() &&
        attachments.length === 0 &&
        !noteCard &&
        !handoffCard
    );
}

/** Extract Method: approved-plan lookup for the build intent. */
function findApprovedPlanBlock(
    session: Session,
    planBlockId: string | undefined,
) {
    if (!planBlockId) return undefined;
    return session.blocks.find(
        (block) => block.id === planBlockId && block.role === "plan",
    );
}

/** Extract Method: pure availability predicate; event emission stays at the call site. */
function isManagedSubmitBlocked(
    target: Session | undefined,
    removing: Set<string>,
    sessionId: string,
): boolean {
    return (
        !target ||
        !!target.busy ||
        !!target.pendingSwitch ||
        (!!target && isPreparingHandoff(target)) ||
        removing.has(sessionId)
    );
}

/** Extract Method: orchestration-run check; emission stays at the call site. */
function activeOrchestrationError(sessionId: string): string | null {
    try {
        const run = orchestrator.forSession(sessionId);
        if (run && ["active", "paused"].includes(run.status))
            return "Stop the current orchestration run before preparing another proposal.";
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    return null;
}

/**
 * Composer turn submission (submit / steer / queue / handoff / plan).
 *
 * Single responsibility: turn the composer draft into harness turns.
 * Session list ownership, tab layout, and orchestration runs live in
 * `useSessionSync`, `useWorkspaceTabs`, and `useTurnActions`.
 * Follow-up split: `useComposerSubmit`, `useComposerQueue`,
 * `useComposerHandoff`, `useComposerPlan` (see plan Fase 4).
 */
export function useComposer(deps: ComposerDeps) {
  const {
    sessionsRef,
    activeSessionIdRef,
    turnGen,
    removingSessionIds,
    setSessions,
    enqueueHarnessEvent,
    flushHarnessEvents,
    dismissNoticesForContinuedSession,
  } = deps;
  const rewindingLastTurn = useRef(new Set<string>());
  const models = useComposerModels({ sessionsRef, setSessions });
  const { onModelChange, onModelSettingsChange, onRuntimeModeChange } = models;
  const onSubmit = useCallback(
    (
      sessionId: string,
      text: string,
      attachments: Attachment[] = [],
      options?: {
        secondOpinion?: SecondOpinionMeta;
        followUpBehavior?: FollowUpBehavior;
        noteCard?: NoteComposerCard;
        handoffCard?: HandoffComposerCard;
        queuedMessageId?: string;
        intent?: TurnIntent;
        planBlockId?: string;
        buildTarget?: PlanBuildTarget;
        managed?: boolean;
        orchestrationRetry?: OrchestrationProposal;
        onSettled?: (outcome: ControlOutcome) => void;
        onResendRejected?: () => void;
        resendEdited?: boolean;
      },
    ) => {
      if (rewindingLastTurn.current.has(sessionId)) return false;
      const controlError = orchestrator.submissionError(
        sessionId,
        options?.managed,
      );
      if (controlError) {
        enqueueHarnessEvent(sessionId, { type: "status", text: controlError });
        flushHarnessEvents();
        return false;
      }
      if (options?.managed) {
        const target = sessionsRef.current.find((s) => s.id === sessionId);
        if (
          isManagedSubmitBlocked(
            target,
            removingSessionIds.current,
            sessionId,
          )
        ) {
          options.onSettled?.({
            status: "failed",
            text: "",
            error: "Session is unavailable or already running",
          });
          return false;
        }
      }
      if (removingSessionIds.current.has(sessionId)) return false;
      const storedCurrent = sessionsRef.current.find((s) => s.id === sessionId);
      if (!storedCurrent) return false;
      let current = options?.buildTarget
        ? withPlanBuildTarget(storedCurrent, options.buildTarget)
        : storedCurrent;
      const editedProviderTurnId = options?.resendEdited
        ? lastUserTurnBlock(current.blocks)?.providerTurnId
        : undefined;
      if (options?.resendEdited) {
        if (!canEditLastTurn(current)) return false;
        current = {
          ...current,
          blocks: truncateBeforeLastUserTurn(current.blocks),
        };
      }
      const intent = options?.intent ?? "default";
      if (intent === "orchestrate") {
        const orchestrationError = activeOrchestrationError(sessionId);
        if (orchestrationError) {
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: orchestrationError,
          });
          flushHarnessEvents();
          return false;
        }
      }
      const approvedPlan = findApprovedPlanBlock(
        current,
        options?.planBlockId,
      );
      if (intent === "build" && !approvedPlan?.text.trim()) return false;
      if (options?.queuedMessageId) {
        const mode =
          options.followUpBehavior === "steer" ? "steer" : "dispatch";
        if (!queuedMessageForSubmit(current, options.queuedMessageId, mode)) {
          return false;
        }
      }
      const noteCard =
        options && "noteCard" in options ? options.noteCard : current.noteCard;
      const handoffCard =
        options && "handoffCard" in options
          ? options.handoffCard
          : current.handoffCard;
      if (isEmptySubmit(text, attachments, noteCard, handoffCard)) {
        return false;
      }
      if (isPreparingHandoff(current)) return false;
      saveRecentModelChoice(current.harness, current.model);
      const initialWorkCwd = sessionWorkCwd(current);
      const createDraftWorktree =
        !current.worktreeCwd && current.workspaceMode === "worktree";
      let workCwd = initialWorkCwd;
      const providerAccountId =
        current.harness === "claude" || current.harness === "codex"
          ? (current.providerAccountId ??
            selectedProviderAccountId(current.harness, current.cwd))
          : undefined;
      const submittedText = intent === "build" ? "Build approved plan" : text;
      const rawCommand = isNativeCommandPrompt(submittedText, current.harness);
      const harnessText = rawCommand
        ? submittedText
        : composeNoteMessage(noteCard, submittedText);

      const pendingSwitch =
        current.pendingSwitch && current.pendingSwitch.from !== current.harness
          ? current.pendingSwitch
          : null;

      if (current.busy && !pendingSwitch) {
        const followUpBehavior =
          current.worktreePreparing ||
          intent === "plan" ||
          intent === "orchestrate"
            ? "queue"
            : (options?.followUpBehavior ?? loadFollowUpBehavior());
        if (followUpBehavior === "queue") {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    inboxCard: rawCommand ? s.inboxCard : undefined,
                    noteCard: rawCommand ? s.noteCard : undefined,
                    handoffCard: rawCommand ? s.handoffCard : undefined,
                    queuedMessages: [
                      ...(s.queuedMessages ?? []),
                      {
                        id: crypto.randomUUID(),
                        text,
                        attachments,
                        noteCard,
                        handoffCard,
                        intent,
                      },
                    ],
                    queueStatus:
                      s.queueStatus === "paused" ? "paused" : "active",
                  }
                : s,
            ),
          );
      dismissNoticesForContinuedSession(sessionId);
          return true;
        }
        if (
          !isLiveHarness(current.harness) ||
          !canSteerHarness(current.harness)
        ) {
          // Harnesses that cannot steer (fx) used to drop the message on the
          // floor here, so a follow-up sent mid-turn just vanished. Say so.
          enqueueHarnessEvent(sessionId, {
            type: "status",
            text: `${current.harness} cannot take a follow-up mid-turn — wait for this turn to finish, or stop it first.`,
          });
          flushHarnessEvents();
          return false;
        }
        dismissNoticesForContinuedSession(sessionId);
        const visible = displayAttachments(attachments);
        const cards = userTurnCards(noteCard);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            let next: Session = {
              ...s,
              inboxCard: rawCommand ? s.inboxCard : undefined,
              noteCard: rawCommand ? s.noteCard : undefined,
              handoffCard: rawCommand ? s.handoffCard : undefined,
            };
            if (options?.queuedMessageId) {
              next = dequeueQueuedMessage(next, options.queuedMessageId);
            }
            return appendSteerUser(next, submittedText, visible, cards);
          }),
        );
        const steerGeneration = turnGen.current.get(sessionId) ?? 0;
        void (async () => {
          try {
            const prepared = await prepareAttachments(attachments);
            if (turnGen.current.get(sessionId) !== steerGeneration) return;
            const prompt = await preparePrompt(harnessText, {
              harness: current.harness,
              sessionId,
              cwd: workCwd,
            });
            if (turnGen.current.get(sessionId) !== steerGeneration) return;
            await steerHarnessTurn({
              harness: current.harness,
              sessionId,
              cwd: workCwd,
              model: current.model,
              modelSettings: current.modelSettings,
              text: inboxAskPrompt(
                rawCommand ? undefined : current.inboxAsk,
                prompt,
              ),
              attachments: prepared,
            });
          } catch (error: unknown) {
            if (turnGen.current.get(sessionId) !== steerGeneration) return;
            const message =
              error instanceof Error
                ? error.message
                : `${current.harness} could not steer the active turn`;
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message,
            });
            flushHarnessEvents();
          }
        })();
        // Reports back as steered (not merely accepted) so the composer can
        // tell the user the message went straight into the running turn
        // instead of waiting as a queued card.
        return "steered";
      }

      if (options?.resendEdited && canRewindHarnessLastTurn(current.harness)) {
        rewindingLastTurn.current.add(sessionId);
        const locked = sessionsRef.current.map((session) =>
          session.id === sessionId ? { ...session, busy: true } : session,
        );
        sessionsRef.current = locked;
        setSessions(locked);
      }

      const gen = (turnGen.current.get(sessionId) ?? 0) + 1;
      turnGen.current.set(sessionId, gen);
      const proposalId =
        intent === "orchestrate" ? crypto.randomUUID() : undefined;
      let proposalDraft: OrchestrationProposal | undefined = proposalId
        ? {
            version: 1,
            leadId: sessionId,
            cwd: current.cwd,
            request: harnessText,
            author: {
              harness: current.harness,
              model: current.model,
              name: resolveModel(current.harness, current.model).name,
            },
            settings: { choices: [], maxWorkers: 2 },
            status: "planning",
            title: "Orchestration plan",
            summary: "",
            tasks: [],
          }
        : undefined;
      const isFirstTurn = current.blocks.length === 0;
      const placeholderTitle = canReplaceSessionTitle(
        current.title,
        current.harness,
        HARNESS_LABEL[current.harness],
      );
      const titleSeed =
        isFirstTurn &&
        !current.inboxCard &&
        !current.noteCard &&
        placeholderTitle
          ? titleFromPrompt(submittedText, current.harness, attachments)
          : current.title;
      const visible = displayAttachments(attachments);
      const card =
        options?.secondOpinion ??
        (handoffCard ? handoffTurnCard(handoffCard) : undefined);
      const visibleText =
        card?.kind === "handoff"
          ? submittedText
          : card
            ? SECOND_OPINION_TITLE
            : submittedText;
      const cards = {
        ...(rawCommand ? undefined : userTurnCards(noteCard, card)),
        // The orchestrator writes these turns, not the user; hide them.
        ...(options?.managed ? { internal: true } : {}),
      };
      const live = isLiveHarness(current.harness);
      const queuedHandoff =
        live && !pendingSwitch ? pendingHandoff(current) : null;

      if (pendingSwitch && current.busy) {
        void cancelHarnessTurn(pendingSwitch.from, sessionId);
      }

      // A resend whose provider revert runs later in the chain swaps the
      // transcript only after the revert succeeds; truncating or appending
      // here would lose the old turn (and duplicate the prompt) when the
      // revert rejects.
      const deferResend =
        options?.resendEdited &&
        canRewindHarnessLastTurn(current.harness) &&
        live;

      dismissNoticesForContinuedSession(sessionId);
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const selected = options?.buildTarget
            ? withPlanBuildTarget(s, options.buildTarget)
            : s;
          const titled = isFirstTurn ? titleSeed : selected.title;
          let next: Session = {
            ...selected,
            providerAccountId,
            // Only flag preparing when the async flow below can actually run:
            // the !live branch returns early and its finally/catch never
            // clears the flag, leaving a stuck "preparing" state.
            worktreePreparing:
              live && createDraftWorktree
                ? true
                : selected.worktreePreparing,
            inboxCard: rawCommand ? s.inboxCard : undefined,
            noteCard: rawCommand ? s.noteCard : undefined,
            handoffCard: rawCommand ? s.handoffCard : undefined,
          };
          if (options?.resendEdited && !deferResend) {
            next = {
              ...next,
              blocks: truncateBeforeLastUserTurn(next.blocks),
            };
          }
          if (approvedPlan && intent === "build") {
            next = {
              ...next,
              blocks: next.blocks.map((block) =>
                block.id === approvedPlan.id
                  ? {
                      ...block,
                      plan: {
                        ...(block.plan ?? { status: "ready" as const }),
                        status: "building" as const,
                        approvedText: block.text,
                      },
                    }
                  : block,
              ),
            };
          }
          if (options?.queuedMessageId) {
            next = dequeueQueuedMessage(next, options.queuedMessageId);
          }
          if (!live) {
            return {
              ...next,
              title: titled,
              pendingSwitch: undefined,
              busy: false,
              blocks: [
                ...next.blocks,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  text: visibleText,
                  ...(visible.length > 0 ? { attachments: visible } : {}),
                  ...cards,
                },
                {
                  id: crypto.randomUUID(),
                  role: "system",
                  text: `${next.harness} is not connected yet — install and sign in to that provider, then retry.`,
                  notice: "error",
                },
              ],
            };
          }
          if (pendingSwitch) {
            const sealed = stopStreaming({
              ...next,
              title: titled,
              pendingSwitch: undefined,
            });
            if (deferResend) return sealed;
            return appendUser(
              appendPreparingHandoff(sealed, pendingSwitch.from, next.harness),
              visibleText,
              visible,
              cards,
            );
          }
          if (deferResend) return { ...next, title: titled };
          return appendUser(
            { ...next, title: titled },
            visibleText,
            visible,
            cards,
          );
        }),
      );

      if (isFirstTurn && live && placeholderTitle) {
        const titleMessage =
          harnessText || attachments.map((file) => file.name).join(", ");
        void generateHarnessTitle(current.harness, {
          sessionId,
          cwd: workCwd,
          message: titleMessage,
          providerAccountId,
        })
          .then(async (generated) => {
            const linkedWorkItem = await resolveLinkedWorkItem(
              titleMessage,
              workCwd,
              generated?.workItem ?? null,
            );
            if (!generated && !linkedWorkItem) return;
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s;
                let next = s;
                if (
                  generated &&
                  canReplaceSessionTitle(s.title, s.harness, titleSeed)
                ) {
                  next = {
                    ...next,
                    title: formatSessionTitle(s.harness, generated.title),
                  };
                }
                if (linkedWorkItem && !next.linkedWorkItem) {
                  next = { ...next, linkedWorkItem };
                }
                return next;
              }),
            );
          })
            .catch(ignoreRejection);
      }

      if (!live) {
        if (pendingSwitch) {
          void forgetHarnessSession(pendingSwitch.from, sessionId);
        }
        options?.onSettled?.({
          status: "failed",
          text: "",
          error: "Harness is not connected",
        });
        return true;
      }

      if (proposalId && proposalDraft) {
        const draft = proposalDraft;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  blocks: [...session.blocks, proposalBlock(proposalId, draft)],
                }
              : session,
          ),
        );
      }

      let controlOutcome: ControlOutcome = {
        status: "failed",
        text: "",
        error: "Turn did not complete",
      };
      let controlText = "";
      let proposalText = "";
      let nativeProposalText = "";
      let completedProposal: OrchestrationProposal | undefined;
      void (async () => {
        if (createDraftWorktree) {
          const tree = await createWorktree(
            current.cwd,
            temporaryWorktreeBranchName(),
            current.worktreeBase || "HEAD",
            false,
          );
          workCwd = tree.path;
          setSessions((prev) =>
            prev.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    worktreeCwd: tree.path,
                    branch: tree.branch ?? undefined,
                    workspaceMode: undefined,
                    worktreeBase: undefined,
                    worktreePreparing: undefined,
                  }
                : session,
            ),
          );
          notifyReviewChanged(sessionId);

          const branchMessage =
            harnessText || attachments.map((file) => file.name).join(", ");
          void generateHarnessBranchName(
            pickTextHarness(current.harness),
            workCwd,
            branchMessage,
          )
            .then(async (fragment) => {
              const branch = fragment ? namedWorktreeBranch(fragment) : null;
              if (!branch) return;
              const renamed = await renameWorktreeBranch(
                current.cwd,
                tree.path,
                branch,
              );
              setSessions((prev) =>
                prev.map((session) =>
                  session.id === sessionId &&
                  pathKey(sessionWorkCwd(session)) === pathKey(tree.path)
                    ? { ...session, branch: renamed.branch ?? undefined }
                    : session,
                ),
              );
            })
          .catch(ignoreRejection);
        }
        if (proposalDraft && proposalId) {
          const settings = await discoverOrchestrationSettings();
          if (turnGen.current.get(sessionId) !== gen) return;
          proposalDraft = { ...proposalDraft, settings };
          const discovering = proposalDraft;
          setSessions((prev) =>
            prev.map((session) =>
              session.id === sessionId
                ? withOrchestrationProposal(session, proposalId, discovering)
                : session,
            ),
          );
        }
        let wrap = handoffCard
          ? {
              from: handoffCard.from,
              to: current.harness,
              text: handoffCard.brief,
            }
          : queuedHandoff;
        if (pendingSwitch) {
          let agentText = "";
          if (
            shouldAskOutgoingAgent(current) &&
            isLiveHarness(pendingSwitch.from)
          ) {
            try {
              agentText = await requestOutgoingHandoff({
                harness: pendingSwitch.from,
                sessionId,
                cwd: workCwd,
                model: pendingSwitch.fromModel,
                modelSettings: pendingSwitch.fromSettings,
                providerAccountId: pendingSwitch.fromProviderAccountId,
                userRequest: text,
              });
            } catch {
              // Deliberate: a handoff-brief failure must not fail the turn;
              // the brief is advisory. Pinned, not fixed (see TECH-DEBT.md).
              agentText = "";
            }
          }
          if (turnGen.current.get(sessionId) !== gen) return;
          const latest = sessionsRef.current.find((s) => s.id === sessionId);
          const brief = chooseHandoffBrief(
            agentText,
            buildDeterministicHandoff(latest ?? current, text),
          );
          await forgetHarnessSession(pendingSwitch.from, sessionId);
          if (turnGen.current.get(sessionId) !== gen) return;
          wrap = { from: pendingSwitch.from, to: current.harness, text: brief };
        }

        const revealHandoff = (brief: string) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId || !isPreparingHandoff(s)) return s;
              return { ...completeHandoff(s, brief), busy: true };
            }),
          );
        };

        const planEventKey = `turn:${gen}`;
        let nativePlanSeen = false;
        let providerFailureSeen = false;
        const routePlanEvent = (event: HarnessEvent): HarnessEvent | null => {
          if (event.type === "session.error") providerFailureSeen = true;
          if (proposalDraft) {
            if (event.type === "message.delta") {
              proposalText = truncateTail(
                proposalText + event.text,
                PROPOSAL_BUFFER_CHARS,
              );
              return null;
            }
            if (event.type === "message.completed") {
              proposalText += "\n";
              return null;
            }
            if (event.type === "plan") {
              nativeProposalText = event.append
                ? nativeProposalText + event.text
                : event.text;
              return null;
            }
          }
          if (intent !== "plan") return event;
          if (event.type === "plan") {
            nativePlanSeen = true;
            return {
              ...event,
              key: planEventKey,
            };
          }
          return event;
        };

        if (!current.inboxAsk && !orchestrator.forSession(sessionId)) {
          await beginSessionTurn(sessionId, workCwd).catch(ignoreRejection);
        }
        if (turnGen.current.get(sessionId) !== gen) return;
        let buildSucceeded = false;
        try {
          if (
            options?.resendEdited &&
            canRewindHarnessLastTurn(current.harness)
          ) {
            try {
              await rewindHarnessLastTurn({
                harness: current.harness,
                sessionId,
                cwd: workCwd,
                model: current.model,
                modelSettings: current.modelSettings,
                runtimeMode: current.runtimeMode,
                ...(editedProviderTurnId
                  ? { providerTurnId: editedProviderTurnId }
                  : {}),
                onEvent: (event) => {
                  if (turnGen.current.get(sessionId) !== gen) return;
                  enqueueHarnessEvent(sessionId, event);
                },
              });
            } catch (error) {
              options?.onResendRejected?.();
              throw error;
            }
            if (turnGen.current.get(sessionId) !== gen) {
              const latest = sessionsRef.current.find(
                (session) => session.id === sessionId,
              );
              if (
                !latest ||
                (!latest.busy &&
                  latest.providerSessionId === current.providerSessionId)
              ) {
                await forgetHarnessSession(current.harness, sessionId);
                if (latest) {
                  setSessions((prev) =>
                    prev.map((session) =>
                      session.id === sessionId &&
                      session.providerSessionId === current.providerSessionId
                        ? { ...session, providerSessionId: undefined }
                        : session,
                    ),
                  );
                }
              }
              return;
            }
            // The provider revert succeeded: now swap the local transcript to
            // the edited turn. It was left intact until now so a rejection
            // above leaves the old turn (and no duplicate prompt) in place.
            // Pass the truncated state through untouched: generateHarnessTitle
            // may have updated the title while the revert was in flight.
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s;
                const truncated = {
                  ...s,
                  blocks: truncateBeforeLastUserTurn(s.blocks),
                };
                return appendUser(truncated, visibleText, visible, cards);
              }),
            );
          }
          const prepared = await prepareAttachments(attachments);
          const prompt =
            intent === "build" && approvedPlan
              ? buildPlanPrompt(approvedPlan.text)
              : await preparePrompt(harnessText, {
                  harness: current.harness,
                  sessionId,
                  cwd: workCwd,
                });
          const turnPrompt = proposalDraft
            ? options?.orchestrationRetry?.response
              ? orchestrationRepairPrompt({
                  ...proposalDraft,
                  error: options.orchestrationRetry.error,
                  response: options.orchestrationRetry.response,
                })
              : orchestrationPlanningPrompt(
                  prompt,
                  proposalDraft.settings,
                  proposalDraft.cwd,
                )
            : intent === "plan" && !rawCommand
              ? planTurnPrompt(prompt)
              : prompt;
          const earlier = queuedHandoff
            ? userMessagesAfterHandoff(current)
            : [];
          const sendTurn = (text: string, turnAttachments = prepared) =>
            sendHarnessTurn({
              harness: current.harness,
              sessionId,
              cwd: workCwd,
              model: current.model,
              modelSettings: current.modelSettings,
              providerAccountId,
              runtimeMode: current.runtimeMode,
              intent: intent === "orchestrate" ? "plan" : intent,
              // A lead drives the control CLI over loopback; without this the
              // harness sandbox denies the socket and it cannot supervise.
              controlsAgents: orchestrator.run(sessionId)?.status === "active",
              text,
              attachments: turnAttachments,
              onEvent: (event) => {
                if (turnGen.current.get(sessionId) !== gen) return;
                orchestrator.observe(sessionId, event);
                if (options?.onSettled && event.type === "message.delta")
                  controlText = truncateTail(
                    controlText + event.text,
                    CONTROL_BUFFER_CHARS,
                  );
                if (options?.onSettled && event.type === "message.completed")
                  controlText += "\n";
                if (event.type === "session.error")
                  controlOutcome.error = event.message;
                if (
                  wrap &&
                  (event.type === "session.started" ||
                    event.type === "session.providerBound")
                ) {
                  revealHandoff(wrap.text);
                }
                nudgeOpenEditors(event, workCwd, sessionId);
                if (!orchestrator.forSession(sessionId))
                  trackSessionEdits(sessionId, workCwd, event);
                const routed = routePlanEvent(event);
                if (routed) enqueueHarnessEvent(sessionId, routed);
              },
            });
          await sendTurn(
            orchestrator.prompt(
              sessionId,
              inboxAskPrompt(
                rawCommand ? undefined : current.inboxAsk,
                wrap && !rawCommand
                  ? wrapHandoffPrompt(
                      wrap.text,
                      wrap.from,
                      turnPrompt.trim() || CONTINUE_PROMPT,
                      earlier,
                    )
                  : turnPrompt,
              ),
            ),
          );
          if (proposalDraft && !providerFailureSeen) {
            completedProposal = await completeOrRepairOrchestrationProposal(
              proposalDraft,
              nativeProposalText || proposalText,
              async (repairPrompt) => {
                proposalText = "";
                nativeProposalText = "";
                await sendTurn(repairPrompt, []);
                if (providerFailureSeen)
                  throw new Error(
                    controlOutcome.error ??
                      "The lead could not repair the proposal.",
                  );
                return nativeProposalText || proposalText;
              },
              () =>
                turnGen.current.get(sessionId) === gen &&
                !isProviderFailureText(nativeProposalText || proposalText),
            );
          }
          if (turnGen.current.get(sessionId) !== gen) return;
          if (wrap) {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s;
                const ready = isPreparingHandoff(s)
                  ? completeHandoff(s, wrap.text)
                  : s;
                // A command owns its arguments; deliver the recap with the next chat prompt.
                return rawCommand ? ready : consumeHandoff(ready);
              }),
            );
          }
          buildSucceeded = true;
        } catch (error: unknown) {
          if (turnGen.current.get(sessionId) !== gen) return;
          if (wrap) revealHandoff(wrap.text);
          const message =
            error instanceof Error
              ? error.message
              : `${current.harness} adapter failed`;
          controlOutcome.error = message;
          if (!providerFailureSeen) {
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message,
            });
          }
          providerFailureSeen = true;
        } finally {
          if (turnGen.current.get(sessionId) !== gen) {
            // Superseded: a newer turn took over, so a build this turn
            // started will never settle. Drop its "building" state instead
            // of stranding the Build button showing Building… forever.
            if (approvedPlan && intent === "build") {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sessionId
                    ? withPlanStatus(stopStreaming(s), approvedPlan.id, "ready")
                    : s,
                ),
              );
            }
            return;
          }
          flushHarnessEvents();
          controlOutcome = {
            status:
              providerFailureSeen ||
              isProviderFailureText(controlText) ||
              !buildSucceeded
                ? "failed"
                : "completed",
            text: controlText.trim(),
            ...(providerFailureSeen ? { error: controlOutcome.error } : {}),
          };
          // A failed provider can leave its process alive with a dead event
          // stream or poisoned turn state. Park it now; the next prompt will
          // reconnect and resume through a fresh transport.
          if (providerFailureSeen) {
            await stopHarnessSession(current.harness, sessionId).catch(
              () => undefined,
            );
          }
          await flushSessionCheckpoint(sessionId);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              const stopped = {
                ...stopStreaming(s),
                worktreePreparing: undefined,
              };
              const providerFailed =
                providerFailureSeen ||
                isProviderFailureText(lastAssistantTextInTurn(stopped));
              const finalized =
                proposalDraft && proposalId
                  ? withOrchestrationProposal(
                      stopped,
                      proposalId,
                      completedProposal && !providerFailed && buildSucceeded
                        ? completedProposal
                        : completeOrchestrationProposal(
                            proposalDraft,
                            nativeProposalText || proposalText,
                            providerFailed || !buildSucceeded
                              ? (controlOutcome.error ??
                                  "The lead could not finish planning.")
                              : undefined,
                          ),
                    )
                  : intent === "plan" && !nativePlanSeen && !providerFailed
                    ? promoteLastAssistantToPlan(stopped, planEventKey)
                    : stopped;
              return approvedPlan && intent === "build"
                ? withPlanStatus(
                    finalized,
                    approvedPlan.id,
                    buildSucceeded && !providerFailed ? "built" : "ready",
                  )
                : finalized;
            }),
          );
          // Next tick: the flush above has rendered by then, so the banner
          // quotes the reply's final text rather than the previous batch.
          window.setTimeout(() => {
            const finished = sessionsRef.current.find(
              (s) => s.id === sessionId,
            );
            const visible = sessionId === activeSessionIdRef.current;
            if (finished) void announceSessionFinished(finished, visible);
          }, 0);
          notifyReviewChanged(sessionId);
          notifyGitChanged();
          notifyUsageStale(usageProviderFor(current.harness));
          nudgeWorkspace(workCwd);
          scheduleNudge(workCwd);
        }
      })()
        .catch((error: unknown) => {
          controlOutcome = {
            status: "failed",
            text: controlText,
            error: error instanceof Error ? error.message : String(error),
          };
          if (turnGen.current.get(sessionId) === gen) {
            enqueueHarnessEvent(sessionId, {
              type: "session.error",
              message: controlOutcome.error!,
            });
            flushHarnessEvents();
            setSessions((prev) =>
              prev.map((session) =>
                session.id === sessionId
                  ? proposalId && proposalDraft
                    ? withOrchestrationProposal(
                        {
                          ...stopStreaming(session),
                          worktreePreparing: undefined,
                        },
                        proposalId,
                        completeOrchestrationProposal(
                          proposalDraft,
                          "",
                          controlOutcome.error,
                        ),
                      )
                    : {
                        ...stopStreaming(session),
                        worktreePreparing: undefined,
                      }
                  : session,
              ),
            );
            // A failed turn may still have spent quota: nudge the footer off
            // the failed harness's snapshot, resolved at settle time.
            const settled = sessionsRef.current.find(
              (s) => s.id === sessionId,
            );
            notifyUsageStale(
              usageProviderFor(settled?.harness ?? current.harness),
            );
          }
        })
        .finally(() => {
          if (options?.resendEdited) {
            rewindingLastTurn.current.delete(sessionId);
          }
          options?.onSettled?.(
            turnGen.current.get(sessionId) !== gen
              ? { status: "cancelled", text: controlText }
              : controlOutcome,
          );
        });
      return true;
    },
    [
      dismissNoticesForContinuedSession,
      enqueueHarnessEvent,
      flushHarnessEvents,
    ],
  );

  return {
    onModelChange,
    onModelSettingsChange,
    onRuntimeModeChange,
    onSubmit,
  };
}
