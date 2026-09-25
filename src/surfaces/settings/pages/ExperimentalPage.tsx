import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEBUG_SCOPES_DEFAULT,
  loadDebugScopesRaw,
  saveDebugScopes,
  subscribeDebugScopes,
} from "../../../lib/debugScopes";
import { useLocale } from "../../../lib/locale";
import {
  loadExperimentalAnimations,
  saveExperimentalAnimations,
} from "../../../lib/appearance";
import {
  loadComposerRunner,
  loadGridArcadeEnabled,
  loadNextStepsCount,
  loadNextStepsEnabled,
  saveComposerRunner,
  saveGridArcadeEnabled,
  saveNextStepsCount,
  saveNextStepsEnabled,
  subscribeNextSteps,
  type NextStepsCount,
} from "../../../lib/settings";
import { Group, Row } from "../SettingsChrome";
import { Segmented, Toggle } from "../SettingsControls";

/**
 * Unstable features. Nothing here is a stable surface: a flag can change
 * behaviour, move, or disappear between releases without a migration.
 */
export function ExperimentalPage() {
  const { t } = useLocale();

  const [experimentalAnimations, setExperimentalAnimations] = useState(
    loadExperimentalAnimations,
  );
  const onExperimentalAnimations = useCallback((next: boolean) => {
    saveExperimentalAnimations(next);
    setExperimentalAnimations(next);
  }, []);

  const [nextStepsEnabled, setNextStepsEnabled] =
    useState(loadNextStepsEnabled);
  const onNextStepsEnabled = useCallback((next: boolean) => {
    saveNextStepsEnabled(next);
    setNextStepsEnabled(next);
  }, []);

  const nextStepsCount = useSyncExternalStore<NextStepsCount>(
    subscribeNextSteps,
    loadNextStepsCount,
    () => 2,
  );
  const onNextStepsCount = useCallback((next: NextStepsCount) => {
    saveNextStepsCount(next);
  }, []);

  const [composerRunner, setComposerRunner] = useState(loadComposerRunner);
  const onComposerRunner = useCallback((next: boolean) => {
    saveComposerRunner(next);
    setComposerRunner(next);
  }, []);

  const [gridArcadeEnabled, setGridArcadeEnabled] = useState(
    loadGridArcadeEnabled,
  );
  const onGridArcadeEnabled = useCallback((next: boolean) => {
    saveGridArcadeEnabled(next);
    setGridArcadeEnabled(next);
  }, []);

  return (
    <>
      <Group
        title={t("settings.experimental.features.title")}
        description={t("settings.experimental.features.description")}
      >
        <Row
          id="experimental-animations"
          label={t("settings.experimental.experimental_animations.label")}
          description={t(
            "settings.experimental.experimental_animations.description",
          )}
        >
          <Toggle
            label={t("settings.experimental.experimental_animations.toggle")}
            on={experimentalAnimations}
            onChange={onExperimentalAnimations}
          />
        </Row>
        <Row
          id="next-steps"
          label={t("settings.experimental.next_steps.label")}
          description={t("settings.experimental.next_steps.description")}
        >
          <div className="flex items-center gap-3">
            <Toggle
              label={t("settings.experimental.next_steps.toggle")}
              on={nextStepsEnabled}
              onChange={onNextStepsEnabled}
            />
            <Segmented
              label={t("settings.experimental.next_steps.selector")}
              value={nextStepsCount}
              options={[
                { value: 2, label: t("settings.experimental.next_steps.two") },
                {
                  value: 3,
                  label: t("settings.experimental.next_steps.three"),
                },
              ]}
              onChange={onNextStepsCount}
            />
          </div>
        </Row>
        <Row
          id="composer-mascot"
          label={t("settings.experimental.composer_mascot.label")}
          description={t("settings.experimental.composer_mascot.description")}
        >
          <Toggle
            label={t("settings.experimental.composer_mascot.toggle")}
            on={composerRunner}
            onChange={onComposerRunner}
          />
        </Row>
        <Row
          id="empty-session-games"
          label={t("settings.experimental.empty_session_games.label")}
          description={t(
            "settings.experimental.empty_session_games.description",
          )}
        >
          <Toggle
            label={t("settings.experimental.empty_session_games.toggle")}
            on={gridArcadeEnabled}
            onChange={onGridArcadeEnabled}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.experimental.diagnostics.title")}
        description={t("settings.experimental.diagnostics.description")}
      >
        <Row
          id="debug-logging"
          label={t("settings.experimental.diagnostics.debug_scopes.label")}
          description={t(
            "settings.experimental.diagnostics.debug_scopes.description",
          )}
        >
          <DebugScopesField />
        </Row>
      </Group>
    </>
  );
}

/**
 * Comma-separated scopes, or `*`. A text field rather than a toggle on
 * purpose: the list is the setting, and a switch that turned on *everything*
 * would flood DevTools on the first typo.
 *
 * Uncontrolled while focused, so a re-render cannot fight the caret.
 */
function DebugScopesField() {
  const { t } = useLocale();
  // The snapshot is the raw string, not a parsed array: useSyncExternalStore
  // compares with Object.is, so a fresh array every read renders forever.
  const raw = useSyncExternalStore(
    subscribeDebugScopes,
    loadDebugScopesRaw,
    () => "",
  );
  const [draft, setDraft] = useState<string | null>(null);
  const value = useMemo(() => draft ?? raw, [draft, raw]);

  const commit = useCallback((next: string) => {
    setDraft(null);
    const parts = next
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    saveDebugScopes(parts);
  }, []);

  return (
    <label className="flex h-8 w-56 max-w-full shrink-0 items-center rounded-md border border-content/15 px-2 focus-within:border-content/20">
      <input
        type="text"
        value={value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
        placeholder={DEBUG_SCOPES_DEFAULT}
        aria-label={t("settings.experimental.diagnostics.debug_scopes.aria")}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
      />
    </label>
  );
}
