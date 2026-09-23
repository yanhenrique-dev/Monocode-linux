import { useState, useRef } from "react";
import { useLocale } from "../../lib/locale";
import { ACCENT_COLOR_DEFAULT } from "../../lib/appearance";
import {
  ColorPickerPopover,
  ColorSwatchRow,
} from "../../chrome/ColorPickerPopover";
import { Popover } from "../../chrome/Popover";

const ACCENT_COLOR_PRESETS = [
  "#4da3f5",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
] as const;

export function AccentColorPicker({
  value,
  onPreview,
  onChange,
  onCancel,
}: {
  value: string | null;
  onPreview?: (value: string | null) => void;
  onChange: (value: string | null) => void;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const colorIndex = value
    ? ACCENT_COLOR_PRESETS.indexOf(
        value as (typeof ACCENT_COLOR_PRESETS)[number],
      )
    : -1;
  const presetIndex = value == null ? 0 : colorIndex >= 0 ? colorIndex + 1 : -1;
  const { t } = useLocale();

  return (
    <div ref={root} className="w-48">
      <ColorSwatchRow
        colors={["var(--color-content)", ...ACCENT_COLOR_PRESETS]}
        labels={[
          t("settings.accent.default"),
          t("settings.accent.blue"),
          t("settings.accent.violet"),
          t("settings.accent.pink"),
          t("settings.accent.red"),
          t("settings.accent.orange"),
          t("settings.accent.green"),
        ]}
        colorIndex={presetIndex >= 0 ? presetIndex : undefined}
        customColor={presetIndex < 0 ? (value ?? undefined) : undefined}
        customPickerOpen={open}
        onPickIndex={(index) => {
          setOpen(false);
          onChange(
            index === 0
              ? ACCENT_COLOR_DEFAULT
              : (ACCENT_COLOR_PRESETS[index - 1] ?? ACCENT_COLOR_PRESETS[0]),
          );
        }}
        onToggleCustom={() => setOpen((current) => !current)}
      />
      {open ? (
        <Popover
          anchor={root}
          side="bottom"
          align="end"
          width={248}
          onDismiss={() => setOpen(false)}
          className="px-2 pb-2"
        >
          <ColorPickerPopover
            value={value ?? ACCENT_COLOR_PRESETS[0]}
            onChange={onChange}
            onPreview={onPreview ? (hex) => onPreview(hex) : undefined}
            onCommit={onChange}
            onCancel={onCancel}
          />
        </Popover>
      ) : null}
    </div>
  );
}
