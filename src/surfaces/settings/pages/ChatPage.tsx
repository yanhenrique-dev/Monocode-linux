import { useEffect, useState } from "react";
import {
  loadTranscriptLayout,
  loadTranscriptAnchor,
  loadTasksPill,
  saveTranscriptLayout,
  saveTranscriptAnchor,
  saveTasksPill,
  TRANSCRIPT_ANCHOR_CHANGE_EVENT,
  type TranscriptLayout,
} from "../../../lib/appearance";
import { useLocale } from "../../../lib/locale";
import {
  loadDiffViewer,
  loadFollowUpBehavior,
  loadModelControls,
  saveDiffViewer,
  saveFollowUpBehavior,
  saveModelControls,
  type DiffViewer,
  type FollowUpBehavior,
  type ModelControls,
} from "../../../lib/settings";
import { Group, Row } from "../../settings/SettingsChrome";
import { Segmented, Toggle } from "../../settings/SettingsControls";

export function ChatPage() {
  const [transcriptLayout, setTranscriptLayout] =
    useState<TranscriptLayout>(loadTranscriptLayout);
  const [transcriptAnchor, setTranscriptAnchor] =
    useState(loadTranscriptAnchor);
  const [tasksPill, setTasksPill] = useState(loadTasksPill);
  const [followUpBehavior, setFollowUpBehavior] =
    useState<FollowUpBehavior>(loadFollowUpBehavior);
  const [modelControls, setModelControls] =
    useState<ModelControls>(loadModelControls);
  const [diffViewer, setDiffViewer] = useState<DiffViewer>(loadDiffViewer);
  const { t } = useLocale();

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

  const onFollowUpBehavior = (next: FollowUpBehavior) => {
    saveFollowUpBehavior(next);
    setFollowUpBehavior(next);
  };

  const onModelControls = (next: ModelControls) => {
    saveModelControls(next);
    setModelControls(next);
  };

  const onDiffViewer = (next: DiffViewer) => {
    saveDiffViewer(next);
    setDiffViewer(next);
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
    </>
  );
}
