import { useCallback, useEffect, useState } from "react";
import { useColorScheme } from "../../../hooks/useColorScheme";
import {
  SIDEBAR_BLUR_MAX,
  SIDEBAR_BLUR_MIN,
  SIDEBAR_OPACITY_MAX,
  SIDEBAR_OPACITY_MIN,
  THEME_DARK_LIGHTNESS_MAX,
  THEME_DARK_LIGHTNESS_MIN,
  THEME_HUE_MAX,
  THEME_HUE_MIN,
  THEME_SATURATION_MAX,
  THEME_SATURATION_MIN,
} from "../../../lib/appearance";
import { UI_SCALE_MAX, UI_SCALE_MIN } from "../../../lib/uiScale";
import { useLocale } from "../../../lib/locale";
import { type SettingsSectionId } from "../../../lib/settings";
import {
  loadHardwareAcceleration,
  subscribeHardwareAcceleration,
} from "../../../lib/hardwareAcceleration";
import { PetsSettings } from "../../PetsSettings";
import { AccentColorPicker } from "../../settings/SettingsAccent";
import { Group, Row } from "../../settings/SettingsChrome";
import { Segmented, Toggle } from "../../settings/SettingsControls";
import { Slider } from "../../settings/SettingsSlider";
import { ChatBackgroundCard } from "./ChatBackgroundCard";
import { useAppearanceSettings } from "../useAppearanceSettings";

export function AppearancePage({
  onRestoreReady,
  onOpenSection,
}: {
  onRestoreReady?: (restore: () => void) => void;
  onOpenSection?: (section: SettingsSectionId) => void;
}) {
  const appearance = useAppearanceSettings();
  const { restoreDefaults, revertAppearanceDrafts } = appearance;
  // A drag preview paints without persisting: leaving the page must not
  // keep the abandoned look.
  useEffect(() => () => revertAppearanceDrafts(), [revertAppearanceDrafts]);
  // The master hardware switch overrides every blur control: while it is
  // off, `html.hw-reduced` kills the sampling the toggle below would flip.
  const [hardwareOn, setHardwareOn] = useState(loadHardwareAcceleration);
  useEffect(() => subscribeHardwareAcceleration(setHardwareOn), []);
  useEffect(() => {
    onRestoreReady?.(restoreDefaults);
  }, [onRestoreReady, restoreDefaults]);
  const percent = Math.round(appearance.opacity * 100);
  const glassDisabled = useColorScheme() === "light";
  // Stable per-value identities: without these, the inline arrows below
  // would defeat memo(Slider) and re-render the sibling row on every tick.
  const onHuePreview = useCallback(
    (value: number) =>
      appearance.previewTint(value, appearance.themeSaturation),
    [appearance.previewTint, appearance.themeSaturation],
  );
  const onHueCommit = useCallback(
    (value: number) => appearance.onTint(value, appearance.themeSaturation),
    [appearance.onTint, appearance.themeSaturation],
  );
  const onSaturationPreview = useCallback(
    (value: number) => appearance.previewTint(appearance.themeHue, value),
    [appearance.previewTint, appearance.themeHue],
  );
  const onSaturationCommit = useCallback(
    (value: number) => appearance.onTint(appearance.themeHue, value),
    [appearance.onTint, appearance.themeHue],
  );
  const { t } = useLocale();

  return (
    <>
      <Group
        title={t("settings.appearance.theme_group.title")}
        description={t("settings.appearance.theme_group.description")}
      >
        <Row
          id="theme"
          label={t("settings.appearance.theme.label")}
          description={t("settings.appearance.theme.description")}
        >
          <Segmented
            label={t("settings.appearance.theme.selector")}
            value={appearance.themePreference}
            options={[
              {
                value: "system",
                label: t("settings.appearance.theme.system"),
              },
              { value: "dark", label: t("settings.appearance.theme.dark") },
              {
                value: "light",
                label: t("settings.appearance.theme.light"),
              },
            ]}
            onChange={appearance.onThemePreference}
          />
        </Row>
        <Row
          id="accent-color"
          label={t("settings.appearance.accent.label")}
          description={t("settings.appearance.accent.description")}
        >
          <AccentColorPicker
            value={appearance.accentColor}
            onPreview={appearance.previewAccentColor}
            onChange={appearance.onAccentColor}
            onCancel={appearance.revertAppearanceDrafts}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.appearance.color_group.title")}
        description={t("settings.appearance.color_group.description")}
      >
        <Row
          id="hue"
          label={t("settings.appearance.hue.label")}
          description={t("settings.appearance.hue.description")}
        >
          <Slider
            label={t("settings.appearance.hue.slider")}
            value={appearance.themeHue}
            display={`${appearance.themeHue}°`}
            min={THEME_HUE_MIN}
            max={THEME_HUE_MAX}
            onPreview={onHuePreview}
            onCommit={onHueCommit}
            onCancel={appearance.revertAppearanceDrafts}
          />
        </Row>
        <Row
          id="saturation"
          label={t("settings.appearance.saturation.label")}
          description={t("settings.appearance.saturation.description")}
        >
          <Slider
            label={t("settings.appearance.saturation.slider")}
            value={appearance.themeSaturation}
            display={`${appearance.themeSaturation}%`}
            min={THEME_SATURATION_MIN}
            max={THEME_SATURATION_MAX}
            onPreview={onSaturationPreview}
            onCommit={onSaturationCommit}
            onCancel={appearance.revertAppearanceDrafts}
          />
        </Row>
        <Row
          id="dark-lightness"
          label={t("settings.appearance.dark_lightness.label")}
          description={
            glassDisabled
              ? t("settings.appearance.dark_lightness.disabled")
              : t("settings.appearance.dark_lightness.description")
          }
        >
          <Slider
            label={t("settings.appearance.dark_lightness.slider")}
            value={appearance.themeDarkLightness}
            display={`${appearance.themeDarkLightness}%`}
            min={THEME_DARK_LIGHTNESS_MIN}
            max={THEME_DARK_LIGHTNESS_MAX}
            onPreview={appearance.previewDarkLightness}
            onCommit={appearance.onDarkLightness}
            onCancel={appearance.revertAppearanceDrafts}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.appearance.translucency_group.title")}
        description={
          glassDisabled
            ? t("settings.appearance.translucency_group.disabled")
            : t("settings.appearance.translucency_group.description")
        }
      >
        <Row
          id="sidebar-opacity"
          label={t("settings.appearance.sidebar_opacity.label")}
          description={t("settings.appearance.sidebar_opacity.description")}
        >
          <Slider
            label={t("settings.appearance.sidebar_opacity.slider")}
            value={percent}
            display={`${percent}%`}
            min={Math.round(SIDEBAR_OPACITY_MIN * 100)}
            max={Math.round(SIDEBAR_OPACITY_MAX * 100)}
            onPreview={appearance.previewOpacity}
            onCommit={appearance.onOpacity}
            onCancel={appearance.revertAppearanceDrafts}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="blur"
          label={t("settings.appearance.blur.label")}
          description={t("settings.appearance.blur.description")}
        >
          <Slider
            label={t("settings.appearance.blur.slider")}
            value={appearance.blur}
            display={String(appearance.blur)}
            min={SIDEBAR_BLUR_MIN}
            max={SIDEBAR_BLUR_MAX}
            onPreview={appearance.previewBlur}
            onCommit={appearance.onBlur}
            onCancel={appearance.revertAppearanceDrafts}
            disabled={glassDisabled}
          />
        </Row>
        <Row
          id="interface-blur"
          label={t("settings.appearance.interface_blur.label")}
          description={
            hardwareOn ? (
              t("settings.appearance.interface_blur.description")
            ) : (
              <>
                {t("settings.appearance.interface_blur.description_disabled")}{" "}
                <button
                  type="button"
                  onClick={() => onOpenSection?.("performance")}
                  className="underline underline-offset-2 hover:text-content"
                >
                  {t("settings.appearance.interface_blur.open_performance")}
                </button>
              </>
            )
          }
        >
          <Toggle
            label={t("settings.appearance.interface_blur.toggle")}
            on={appearance.uiBlur}
            onChange={appearance.onUiBlur}
            disabled={!hardwareOn}
          />
        </Row>
        <Row
          id="main-pane-glass"
          label={t("settings.appearance.main_pane_glass.label")}
          description={t("settings.appearance.main_pane_glass.description")}
        >
          <Toggle
            label={t("settings.appearance.main_pane_glass.toggle")}
            on={appearance.bodyGlass}
            onChange={appearance.onBodyGlass}
            disabled={glassDisabled}
          />
        </Row>
      </Group>

      <ChatBackgroundCard appearance={appearance} />

      <Group
        id="pets"
        title={t("settings.appearance.pets.label")}
        description={t("settings.appearance.pets.description")}
      >
        <PetsSettings />
      </Group>

      <Group title={t("settings.appearance.layout_group.title")}>
        <Row
          id="interface-scale"
          label={t("settings.appearance.interface_scale.label")}
          description={t("settings.appearance.interface_scale.description")}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Slider
              label={t("settings.appearance.interface_scale.slider")}
              value={Math.round(appearance.uiScale * 100)}
              display={`${Math.round(appearance.uiScale * 100)}%`}
              min={Math.round(UI_SCALE_MIN * 100)}
              max={Math.round(UI_SCALE_MAX * 100)}
              step={10}
              onPreview={appearance.previewUiScale}
              onCommit={appearance.onUiScale}
              onCancel={appearance.revertAppearanceDrafts}
            />
            {Math.round(appearance.uiScale * 100) !== 100 ? (
              <button
                type="button"
                title={t("settings.appearance.interface_scale.reset")}
                onClick={() => appearance.onUiScale(100)}
                className="h-7 shrink-0 rounded-md border border-content/12 bg-content/8 px-2 text-[11px] text-content/70 hover:bg-content/12 hover:text-content"
              >
                {t("settings.appearance.interface_scale.reset")}
              </button>
            ) : null}
          </div>
        </Row>
      </Group>
    </>
  );
}
