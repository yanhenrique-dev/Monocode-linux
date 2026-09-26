import { useEffect, useState, useSyncExternalStore } from "react";
import { HarnessIcon } from "../../../chrome/HarnessIcon";
import { SecondaryButton } from "../../../chrome/SecondaryButton";
import {
  availableHarnessIds,
  getHarnessAvailabilitySnapshot,
  hasProbedHarnessAvailability,
  harnessUnavailableHint,
  isHarnessAvailable,
  probeHarnessAvailability,
  subscribeHarnessAvailability,
} from "../../../lib/harness/availability";
import { refreshHarnessCatalogs } from "../../../lib/harness/registry";
import {
  defaultSessionChoice,
  getModelSnapshot,
  isPickerProviderVisible,
  loadDefaultModels,
  loadLastModelChoice,
  modelsFor,
  preferredModelId,
  resolveModel,
  saveDefaultModel,
  saveLastModelChoice,
  savePickerProviderVisible,
  subscribeModels,
} from "../../../lib/models";
import { HARNESSES, HARNESS_TITLE, type HarnessId } from "../../../lib/session";
import { useLocale } from "../../../lib/locale";
import { loadClaudeHooks, saveClaudeHooks } from "../../../lib/settings";
import { Group, Row } from "../../settings/SettingsChrome";
import { Toggle } from "../../settings/SettingsControls";
import { Select } from "../../settings/SettingsSelect";

export function ProvidersPage() {
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  useSyncExternalStore(
    subscribeHarnessAvailability,
    getHarnessAvailabilitySnapshot,
    getHarnessAvailabilitySnapshot,
  );
  const [choice, setChoice] = useState(loadLastModelChoice);
  // Setter only re-renders; the displayed model always reads the store
  // through preferredModelId so it can never drift from new sessions.
  const [, setDefaultModels] = useState(loadDefaultModels);
  const [claudeHooks, setClaudeHooks] = useState(loadClaudeHooks);
  const { t } = useLocale();
  const effectiveChoice = hasProbedHarnessAvailability()
    ? defaultSessionChoice(availableHarnessIds())
    : choice;

  useEffect(() => {
    void probeHarnessAvailability();
  }, []);

  const onClaudeHooks = (next: boolean) => {
    saveClaudeHooks(next);
    setClaudeHooks(next);
  };

  const onModelChange = (harness: HarnessId, model: string) => {
    saveDefaultModel(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    if (choice?.harness === harness) {
      saveLastModelChoice(harness, model);
      setChoice({ harness, model });
    }
  };

  const onDefault = (harness: HarnessId, model: string) => {
    saveLastModelChoice(harness, model);
    setDefaultModels((prev) => ({ ...prev, [harness]: model }));
    setChoice({ harness, model });
  };

  return (
    <>
      <Group
        title={t("settings.providers.group.title")}
        description={t("settings.providers.group.description")}
      >
        {HARNESSES.map((harness) => (
          <ProviderRow
            key={harness}
            harness={harness}
            // Always the effective default: new sessions resolve the same way.
            selectedModel={preferredModelId(harness)}
            isDefault={effectiveChoice?.harness === harness}
            onDefault={onDefault}
            onModelChange={onModelChange}
          />
        ))}
      </Group>

      <p className="px-1 pt-2 text-[12px] text-content/45">
        {t("settings.providers.default_hint")}
      </p>

      <Group title={t("settings.providers.advanced.title")}>
        <Row
          id="claude-hooks"
          label={t("settings.providers.claude_hooks.label")}
          description={t("settings.providers.claude_hooks.description")}
        >
          <Toggle
            label={t("settings.providers.claude_hooks.toggle")}
            on={claudeHooks}
            onChange={onClaudeHooks}
          />
        </Row>
      </Group>
    </>
  );
}

function ProviderRow({
  harness,
  selectedModel,
  isDefault,
  onDefault,
  onModelChange,
}: {
  harness: HarnessId;
  selectedModel: string;
  isDefault: boolean;
  onDefault: (harness: HarnessId, model: string) => void;
  onModelChange: (harness: HarnessId, model: string) => void;
}) {
  const models = modelsFor(harness);
  const available = isHarnessAvailable(harness);
  const current =
    models.length > 0 ? resolveModel(harness, selectedModel) : null;
  const [inPicker, setInPicker] = useState(() =>
    isPickerProviderVisible(harness),
  );

  useEffect(() => {
    if (!available || models.length > 0) return;
    void refreshHarnessCatalogs([harness]);
  }, [available, harness, models.length]);

  const onPickerVisible = (visible: boolean) => {
    savePickerProviderVisible(harness, visible);
    setInPicker(visible);
  };
  const { locale, t } = useLocale();

  return (
    <Row
      label={
        <span className="flex items-center gap-2">
          <HarnessIcon harness={harness} className="size-4 shrink-0" />
          {HARNESS_TITLE[harness]}
          {isDefault ? (
            <span className="rounded-full bg-content/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-content/60">
              {t("settings.providers.row.badge_default")}
            </span>
          ) : null}
        </span>
      }
      description={
        available
          ? models.length === 1
            ? t("settings.providers.row.models_available_one")
            : t("settings.providers.row.models_available_other", {
                count: models.length,
              })
          : harnessUnavailableHint(harness, locale)
      }
    >
      {current ? (
        <Select
          label={t("settings.providers.row.model_selector", {
            harness: HARNESS_TITLE[harness],
          })}
          value={current.id}
          onChange={(next) => onModelChange(harness, next)}
          options={models.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ) : null}
      <SecondaryButton
        onClick={() => current && onDefault(harness, current.id)}
        disabled={isDefault || !available || !current}
      >
        {isDefault
          ? t("settings.providers.row.default_active")
          : t("settings.providers.row.use_default")}
      </SecondaryButton>
      {available ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-content/50">
            {t("settings.providers.row.show_in_picker")}
          </span>
          <Toggle
            label={t("settings.providers.row.show_in_picker_toggle", {
              harness: HARNESS_TITLE[harness],
            })}
            on={inPicker}
            onChange={onPickerVisible}
          />
        </div>
      ) : null}
    </Row>
  );
}
