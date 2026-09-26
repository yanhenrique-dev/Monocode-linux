import { ImagePlus, LoaderCircle } from "../../../chrome/icons";
import { useState } from "react";
import { ConfirmDialog } from "../../../chrome/ConfirmDialog";
import { SecondaryButton } from "../../../chrome/SecondaryButton";
import {
  CHAT_BACKGROUND_BLUR_MAX,
  CHAT_BACKGROUND_BLUR_MIN,
  CHAT_BACKGROUND_OPACITY_MAX,
  CHAT_BACKGROUND_OPACITY_MIN,
  NEW_THREAD_BACKGROUND_EFFECTS,
  chatBackgroundSrc,
} from "../../../lib/appearance";
import { useLocale, type LocaleKey } from "../../../lib/locale";
import { Group, Row } from "../../settings/SettingsChrome";
import { Segmented } from "../../settings/SettingsControls";
import { Slider } from "../../settings/SettingsSlider";
import type { AppearanceSettings } from "../useAppearanceSettings";

export function ChatBackgroundCard({
  appearance,
}: {
  appearance: AppearanceSettings;
}) {
  const src = chatBackgroundSrc(appearance.chatBackgroundPath);
  const hasImage = Boolean(appearance.chatBackgroundPath && src);
  const emptyVisibility = Math.round(
    appearance.chatBackgroundEmptyOpacity * 100,
  );
  const sessionVisibility = Math.round(
    appearance.chatBackgroundSessionOpacity * 100,
  );
  const busy = appearance.chatBackgroundBusy;
  const { t } = useLocale();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <Group
      id="chat-background"
      title={t("settings.appearance.chat_background.title")}
      description={t("settings.appearance.chat_background.description")}
    >
      {confirmingRemove ? (
        <ConfirmDialog
          title={t("settings.appearance.chat_background.remove_title")}
          description={t(
            "settings.appearance.chat_background.remove_description",
          )}
          confirmLabel={t("settings.appearance.chat_background.remove_action")}
          cancelLabel={t("settings.archive.dialog.cancel")}
          danger
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => {
            setConfirmingRemove(false);
            void appearance.onClearChatBackground();
          }}
        />
      ) : null}
      <div className="border-b border-content/10 p-4 last:border-b-0">
        <div className="overflow-hidden rounded-lg border border-content/10">
          {hasImage ? (
            <div className="relative h-36">
              <div
                aria-hidden
                className="size-full bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: "var(--chat-background-image)",
                  opacity: appearance.chatBackgroundEmptyOpacity,
                  filter: `blur(${appearance.chatBackgroundBlur}px)`,
                }}
              />
              <span className="pointer-events-none absolute bottom-2 left-2 text-xs text-content/60">
                {t("settings.appearance.chat_background.preview", {
                  value: emptyVisibility,
                })}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 text-content/60 hover:bg-content/5 hover:text-content/70 disabled:cursor-default disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-[12px]">
                {t("settings.appearance.chat_background.choose")}
              </span>
            </button>
          )}
        </div>
        {hasImage ? (
          <div className="mt-4 flex items-center justify-end gap-2">
            <SecondaryButton
              onClick={() => void appearance.onChooseChatBackground()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              {t("settings.appearance.chat_background.change")}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => setConfirmingRemove(true)}
              disabled={busy}
              danger
            >
              {t("settings.appearance.chat_background.remove")}
            </SecondaryButton>
          </div>
        ) : null}
        {appearance.chatBackgroundError ? (
          <p role="alert" className="mt-2 text-[12px] text-red-400">
            {appearance.chatBackgroundError}
          </p>
        ) : null}
      </div>
      {hasImage ? (
        <>
          <Row
            label={t("settings.appearance.chat_background.effect.label")}
            description={t(
              `settings.appearance.chat_background.effect.description.${appearance.newThreadBackgroundEffect}` as LocaleKey,
            )}
          >
            <Segmented
              label={t("settings.appearance.chat_background.effect.selector")}
              value={appearance.newThreadBackgroundEffect}
              options={NEW_THREAD_BACKGROUND_EFFECTS.map((effect) => ({
                value: effect,
                label: t(
                  `settings.appearance.chat_background.effect.${effect}` as LocaleKey,
                ),
              }))}
              onChange={appearance.onNewThreadBackgroundEffect}
              optionIdPrefix="new-thread-background-effect"
            />
          </Row>
          <Row
            label={t("settings.appearance.chat_background.scope.label")}
            description={t(
              "settings.appearance.chat_background.scope.description",
            )}
          >
            <Segmented
              label={t("settings.appearance.chat_background.scope.selector")}
              value={appearance.chatBackgroundScope}
              options={[
                {
                  value: "empty",
                  label: t("settings.appearance.chat_background.scope.empty"),
                },
                {
                  value: "all",
                  label: t("settings.appearance.chat_background.scope.all"),
                },
              ]}
              onChange={appearance.onChatBackgroundScope}
            />
          </Row>
          <Row
            label={t(
              "settings.appearance.chat_background.empty_visibility.label",
            )}
            description={t(
              "settings.appearance.chat_background.empty_visibility.description",
            )}
          >
            <Slider
              label={t(
                "settings.appearance.chat_background.empty_visibility.slider",
              )}
              value={emptyVisibility}
              display={`${emptyVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onPreview={appearance.previewChatBackgroundEmptyOpacity}
              onCommit={appearance.onChatBackgroundEmptyOpacity}
              onCancel={appearance.revertAppearanceDrafts}
            />
          </Row>
          <Row
            label={t(
              "settings.appearance.chat_background.session_visibility.label",
            )}
            description={t(
              "settings.appearance.chat_background.session_visibility.description",
            )}
          >
            <Slider
              label={t(
                "settings.appearance.chat_background.session_visibility.slider",
              )}
              value={sessionVisibility}
              display={`${sessionVisibility}%`}
              min={Math.round(CHAT_BACKGROUND_OPACITY_MIN * 100)}
              max={Math.round(CHAT_BACKGROUND_OPACITY_MAX * 100)}
              onPreview={appearance.previewChatBackgroundSessionOpacity}
              onCommit={appearance.onChatBackgroundSessionOpacity}
              onCancel={appearance.revertAppearanceDrafts}
            />
          </Row>
          <Row
            label={t("settings.appearance.background_blur.label")}
            description={t("settings.appearance.background_blur.description")}
          >
            <Slider
              label={t("settings.appearance.background_blur.slider")}
              value={appearance.chatBackgroundBlur}
              display={
                appearance.chatBackgroundBlur === 0
                  ? t("settings.appearance.background_blur.off")
                  : `${appearance.chatBackgroundBlur}px`
              }
              min={CHAT_BACKGROUND_BLUR_MIN}
              max={CHAT_BACKGROUND_BLUR_MAX}
              onPreview={appearance.previewChatBackgroundBlur}
              onCommit={appearance.onChatBackgroundBlur}
              onCancel={appearance.revertAppearanceDrafts}
            />
          </Row>
        </>
      ) : null}
    </Group>
  );
}
