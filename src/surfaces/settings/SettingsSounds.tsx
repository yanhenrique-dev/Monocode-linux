import { memo, useEffect, useState } from "react";
import {
  File as FileIcon,
  Play as PlayIcon,
  RotateCcw,
} from "../../chrome/icons";
import { useLocale, type LocaleKey } from "../../lib/locale";
import {
  cueLabelKey,
  previewCue,
  type CustomizableCue,
  type SoundPref,
} from "../../lib/sounds";
import {
  audioPlaybackState,
  pickSoundFile,
  playSoundFile,
  type AudioPlaybackState,
  type SoundFileReason,
} from "../../lib/soundFiles";
import { Row } from "./SettingsChrome";

const ERROR_HINT: Record<SoundFileReason, LocaleKey> = {
  missing: "settings.general.sounds.error.missing",
  decode: "settings.general.sounds.error.decode",
  unavailable: "settings.general.sounds.error.unavailable",
};

/** Live Web Audio state so a silent AppImage explains itself instead of
 * failing quietly (host WebKitGTK without an audio sink stays here).
 * Only renders the states the locale catalog provides (see locale.ts). */
export const AudioEngineState = memo(function AudioEngineState() {
  const { t } = useLocale();
  const [state, setState] = useState<AudioPlaybackState>(() =>
    audioPlaybackState(),
  );
  useEffect(() => {
    const sync = () => setState(audioPlaybackState());
    const timer = window.setInterval(() => {
      sync();
      if (audioPlaybackState() !== "suspended") {
        window.clearInterval(timer);
      }
    }, 500);
    window.addEventListener("pointerdown", sync);
    window.addEventListener("keydown", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("keydown", sync);
    };
  }, []);
  if (state !== "unavailable") return null;
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-content/60">
      <span aria-hidden className="size-1.5 rounded-full bg-rose-400" />
      <span role="status">
        {t("settings.general.sounds.engine.unavailable")}
      </span>
    </span>
  );
});

export const SoundCueRow = memo(function SoundCueRow({
  cue,
  pref,
  onPref,
}: {
  cue: CustomizableCue;
  pref: SoundPref;
  onPref: (cue: CustomizableCue, pref: SoundPref) => void;
}) {
  const { t } = useLocale();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<SoundFileReason | null>(null);
  const [engineBlocked, setEngineBlocked] = useState(false);
  const custom = pref !== "preset";

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setEngineBlocked(false);
    try {
      if (custom) {
        const result = await playSoundFile(pref);
        if (!result.ok) setError(result.reason);
        return;
      }
      previewCue(cue);
      // The preset engine reports nothing on failure: re-read the shared
      // context after resume had a chance, and say so when still blocked.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (audioPlaybackState() !== "running") setEngineBlocked(true);
    } finally {
      setTesting(false);
    }
  };

  const pick = async () => {
    const path = await pickSoundFile();
    if (!path) return;
    setError(null);
    onPref(cue, path);
  };

  const reset = () => {
    setError(null);
    onPref(cue, "preset");
  };

  return (
    <Row
      id={`sounds-${cue}`}
      label={t(cueLabelKey(cue))}
      description={
        custom
          ? pref.split(/[\\/]/).pop() || pref
          : undefined
      }
    >
      <button
        type="button"
        aria-label={t("settings.general.sounds.test")}
        title={`${t("settings.general.sounds.test")} — ${t("settings.general.sounds.preview_ignores_mute")}`}
        disabled={testing}
        onClick={() => void runTest()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-content/15 text-content/60 hover:text-content disabled:opacity-50"
      >
        <PlayIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void pick()}
        title={custom ? pref : undefined}
        className={`flex h-8 min-w-0 shrink-0 items-center gap-2 rounded-md border px-2 text-[12px] ${
          custom
            ? "border-accent/40 bg-accent/10 text-content"
            : "border-content/10 text-content/60 hover:text-content"
        }`}
      >
        <FileIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-48 truncate">
          {custom
            ? t("settings.general.sounds.custom.file")
            : t("settings.general.sounds.custom.pick")}
        </span>
      </button>
      {custom ? (
        <button
          type="button"
          aria-label={t("settings.general.sounds.reset")}
          title={t("settings.general.sounds.reset")}
          onClick={reset}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-content/15 text-content/60 hover:text-content"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="w-full text-right text-[12px] text-red-400/90"
        >
          {t(ERROR_HINT[error])}
        </span>
      ) : null}
      {!custom && engineBlocked ? (
        <span
          role="alert"
          className="w-full text-right text-[12px] text-amber-400/90"
        >
          {t("settings.general.sounds.engine.unavailable")}
        </span>
      ) : null}
    </Row>
  );
});

export function NotificationsBlocked() {
  const { t } = useLocale();
  return (
    <span className="flex flex-wrap items-center gap-2 text-[12px] text-content/60">
      {t("settings.general.notifications.permission_needed")}
      <span className="basis-full">
        {t("settings.general.notifications.linux_denied_hint")}
      </span>
    </span>
  );
}
