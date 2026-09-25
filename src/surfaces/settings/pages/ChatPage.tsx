import { useEffect, useState } from "react";
import {
  loadTranscriptLayout,
  loadTranscriptAnchor,
  loadTasksPill,
  loadExperimentalAnimations,
  saveTranscriptLayout,
  saveTranscriptAnchor,
  saveTasksPill,
  saveExperimentalAnimations,
  TRANSCRIPT_ANCHOR_CHANGE_EVENT,
  type TranscriptLayout,
} from "../../../lib/appearance";
import { useLocale } from "../../../lib/locale";
import {
  loadComposerRunner,
  loadDiffViewer,
  loadFollowUpBehavior,
  loadGridArcadeEnabled,
  loadModelControls,
  loadNextStepsCount,
  loadNextStepsEnabled,
  saveComposerRunner,
  saveDiffViewer,
  saveFollowUpBehavior,
  saveGridArcadeEnabled,
  saveModelControls,
  saveNextStepsCount,
  saveNextStepsEnabled,
  subscribeNextSteps,
  type DiffViewer,
  type FollowUpBehavior,
  type ModelControls,
  type NextStepsCount,
} from "../../../lib/settings";
import { Group, Row } from "../../settings/SettingsChrome";
import { Segmented, Toggle } from "../../settings/SettingsControls";

export function ChatPage() {
  const [transcriptLayout, setTranscriptLayout] =
    useState<TranscriptLayout>(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] =
    useState(loadTranscriptAnchor);
  const [tasksPill, setTasksPill] = useState(loadTasksPill);
  const [experimentalAnimations, setExperimentalAnimations] = useState(
    loadExperimentalAnimations,
  );
  const [followUpBehavior, setFollowUpBehavior] =
    useState<FollowUpBehavior>(loadFollowUpBehavior);
  const [nextStepsEnabled, setNextStepsEnabled] =
    useState(loadNextStepsEnabled);
  const [nextStepsCount, setNextStepsCount] =
    useState<NextStepsCount>(loadNextStepsCount);
  const [modelControls, setModelControls] =
    useState<ModelControls>(loadModelControls);
  const [diffViewer, setDiffViewer] = useState<DiffViewer>(loadDiffViewer);
  const [composerRunner, setComposerRunner] = useState(loadComposerRunner);
  const [gridArcadeEnabled, setGridArcadeEnabled] = useState(
    loadGridArcadeEnabled,
  );
  const { t } = useLocale();

  useEffect(
    () =>
      subscribeNextSteps(() => {
        setNextStepsEnabled(loadNextStepsEnabled());
        setNextStepsCount(loadNextStepsCount());
      }),
    [],
  );

  useEffect(() => {
    const onAnchor = (event: Event) => {
      setTranscriptAnchor((event as CustomEvent<boolean>).detail === true);
    };
    window.addEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    return () => {
      window.removeEventListener(TRANSCRIPT_ANCHOR_CHANGE_EVENT, onAnchor);
    };
  }, []);

  const onTranscriptLayout = (next: TranscriptLayout) => {
    saveTranscriptLayout(next);
    setTranscriptLayout(next);
  };

  const onTranscriptAnchor = (next: boolean) => {
    saveTranscriptAnchor(next);
    setTranscriptAnchor(next);
  };

  const onTasksPill = (next: boolean) => {
    saveTasksPill(next);
    setTasksPill(next);
  };

  const onExperimentalAnimations = (next: boolean) => {
    saveExperimentalAnimations(next);
    setExperimentalAnimations(next);
  };

  const onFollowUpBehavior = (next: FollowUpBehavior) => {
    saveFollowUpBehavior(next);
    setFollowUpBehavior(next);
  };

  const onNextStepsEnabled = (next: boolean) => {
    saveNextStepsEnabled(next);
    setNextStepsEnabled(next);
  };

  const onNextStepsCount = (next: NextStepsCount) => {
    saveNextStepsCount(next);
    setNextStepsCount(next);
  };

  const onModelControls = (next: ModelControls) => {
    saveModelControls(next);
    setModelControls(next);
  };

  const onDiffViewer = (next: DiffViewer) => {
    saveDiffViewer(next);
    setDiffViewer(next);
  };

  const onComposerRunner = (next: boolean) => {
    saveComposerRunner(next);
    setComposerRunner(next);
  };

  const onGridArcadeEnabled = (next: boolean) => {
    saveGridArcadeEnabled(next);
    setGridArcadeEnabled(next);
  };

  return (
    <>
      <Group
        title={t("settings.chat.transcript.title")}
        description={t("settings.chat.transcript.description")}
      >
        <Row
          id="transcript-layout"
          label={t("settings.chat.transcript_layout.label")}
          description={t("settings.chat.transcript_layout.description")}
        >
          <Segmented
            label={t("settings.chat.transcript_layout.selector")}
            value={transcriptLayout}
            options={[
              {
                value: "full",
                label: t("settings.chat.transcript_layout.full"),
              },
              {
                value: "chat",
                label: t("settings.chat.transcript_layout.chat"),
              },
            ]}
            onChange={onTranscriptLayout}
          />
        </Row>
        <Row
          id="anchor-prompts"
          label={t("settings.chat.anchor_prompts.label")}
          description={t("settings.chat.anchor_prompts.description")}
        >
          <Toggle
            label={t("settings.chat.anchor_prompts.toggle")}
            on={transcriptAnchor}
            onChange={onTranscriptAnchor}
          />
        </Row>
        <Row
          id="tasks-pill"
          label={t("settings.chat.tasks_pill.label")}
          description={t("settings.chat.tasks_pill.description")}
        >
          <Toggle
            label={t("settings.chat.tasks_pill.toggle")}
            on={tasksPill}
            onChange={onTasksPill}
          />
        </Row>
        <Row
          id="experimental-animations"
          label={t("settings.chat.experimental_animations.label")}
          description={t("settings.chat.experimental_animations.description")}
        >
          <Toggle
            label={t("settings.chat.experimental_animations.toggle")}
            on={experimentalAnimations}
            onChange={onExperimentalAnimations}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.composer.title")}
        description={t("settings.chat.composer.description")}
      >
        <Row
          id="follow-up"
          label={t("settings.chat.follow_up.label")}
          description={t("settings.chat.follow_up.description")}
        >
          <Segmented
            label={t("settings.chat.follow_up.selector")}
            value={followUpBehavior}
            options={[
              {
                value: "queue",
                label: t("settings.chat.follow_up.queue"),
              },
              {
                value: "steer",
                label: t("settings.chat.follow_up.steer"),
              },
            ]}
            onChange={onFollowUpBehavior}
          />
        </Row>
        <Row
          id="next-steps"
          label={t("settings.chat.next_steps.label")}
          description={t("settings.chat.next_steps.description")}
        >
          <div className="flex items-center gap-3">
            <Toggle
              label={t("settings.chat.next_steps.toggle")}
              on={nextStepsEnabled}
              onChange={onNextStepsEnabled}
            />
            {nextStepsEnabled ? (
              <Segmented
                label={t("settings.chat.next_steps.selector")}
                value={nextStepsCount}
                options={[
                  {
                    value: 2,
                    label: t("settings.chat.next_steps.two"),
                  },
                  {
                    value: 3,
                    label: t("settings.chat.next_steps.three"),
                  },
                ]}
                onChange={onNextStepsCount}
              />
            ) : null}
          </div>
        </Row>
        <Row
          id="model-controls"
          label={t("settings.chat.model_controls.label")}
          description={t("settings.chat.model_controls.description")}
        >
          <Segmented
            label={t("settings.chat.model_controls.selector")}
            value={modelControls}
            options={[
              {
                value: "menu",
                label: t("settings.chat.model_controls.menu"),
              },
              {
                value: "beside",
                label: t("settings.chat.model_controls.beside"),
              },
            ]}
            onChange={onModelControls}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.code_review.title")}
        description={t("settings.chat.code_review.description")}
      >
        <Row
          id="diff-view"
          label={t("settings.chat.diff_view.label")}
          description={t("settings.chat.diff_view.description")}
        >
          <Segmented
            label={t("settings.chat.diff_view.selector")}
            value={diffViewer}
            options={[
              {
                value: "editor",
                label: t("settings.chat.diff_view.editor"),
              },
              {
                value: "unified",
                label: t("settings.chat.diff_view.unified"),
              },
            ]}
            onChange={onDiffViewer}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.chat.extras.title")}
        description={t("settings.chat.extras.description")}
      >
        <Row
          id="composer-mascot"
          label={t("settings.chat.composer_mascot.label")}
          description={t("settings.chat.composer_mascot.description")}
        >
          <Toggle
            label={t("settings.chat.composer_mascot.toggle")}
            on={composerRunner}
            onChange={onComposerRunner}
          />
        </Row>
        <Row
          id="empty-session-games"
          label={t("settings.chat.empty_session_games.label")}
          description={t("settings.chat.empty_session_games.description")}
        >
          <Toggle
            label={t("settings.chat.empty_session_games.toggle")}
            on={gridArcadeEnabled}
            onChange={onGridArcadeEnabled}
          />
        </Row>
      </Group>
    </>
  );
}
