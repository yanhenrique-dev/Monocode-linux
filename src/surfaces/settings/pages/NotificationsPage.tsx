import { useContext, useEffect, useState } from "react";
import { type RecentProject } from "../../../lib/recents";
import { useLocale } from "../../../lib/locale";
import {
  CUSTOMIZABLE_CUES,
  loadSoundPrefs,
  loadSoundsEnabled,
  saveSoundsEnabled,
  saveSoundPrefs,
  SOUNDS_PREFS_EVENT,
  type CustomizableCue,
  type SoundPref,
} from "../../../lib/sounds";
import {
  cachedNotificationPermission,
  loadNotificationsEnabled,
  probeNotificationPermission,
  requestNotificationPermission,
  saveNotificationsEnabled,
  type NotificationPermission,
} from "../../../lib/notifications";
import { ProjectNotificationSettings } from "../../ProjectNotificationSettings";
import {
  Group,
  RevealedSetting,
  Row,
  settingDomId,
} from "../../settings/SettingsChrome";
import { Toggle } from "../../settings/SettingsControls";
import {
  AudioEngineState,
  NotificationsBlocked,
  SoundCueRow,
} from "../../settings/SettingsSounds";

export function NotificationsPage({
  cwd,
  recents,
  notificationProjectPath,
  notificationSettingsRequest,
}: {
  cwd: string;
  recents?: RecentProject[];
  notificationProjectPath?: string | null;
  notificationSettingsRequest?: number;
}) {
  const [soundsEnabled, setSoundsEnabled] = useState(loadSoundsEnabled);
  const [soundPrefs, setSoundPrefs] = useState(loadSoundPrefs);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    loadNotificationsEnabled,
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(cachedNotificationPermission);
  const revealed = useContext(RevealedSetting);
  const { t } = useLocale();

  // The user may flip the switch in System Settings and come back: re-read
  // the OS state on open and whenever the window regains focus. Probe even
  // while the toggle is off so the pre-opt-in state is accurate.
  useEffect(() => {
    const refresh = () => {
      void probeNotificationPermission().then(setNotificationPermission);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [notificationsEnabled]);

  const onSoundsEnabled = (next: boolean) => {
    saveSoundsEnabled(next);
    setSoundsEnabled(next);
  };

  useEffect(() => {
    const sync = () => setSoundPrefs(loadSoundPrefs());
    window.addEventListener(SOUNDS_PREFS_EVENT, sync);
    return () => window.removeEventListener(SOUNDS_PREFS_EVENT, sync);
  }, []);

  const onSoundPref = (cue: CustomizableCue, pref: SoundPref) => {
    saveSoundPrefs({ [cue]: pref });
    setSoundPrefs(loadSoundPrefs());
  };

  const onNotificationsEnabled = (next: boolean) => {
    saveNotificationsEnabled(next);
    setNotificationsEnabled(next);
    if (!next) return;
    void requestNotificationPermission().then(setNotificationPermission);
  };

  return (
    <>
      <Group
        title={t("settings.general.alerts.title")}
        description={t("settings.general.alerts.description")}
      >
        <Row
          id="sounds"
          label={t("settings.general.sounds.label")}
          description={t("settings.general.sounds.description")}
        >
          <Toggle
            label={t("settings.general.sounds.toggle")}
            on={soundsEnabled}
            onChange={onSoundsEnabled}
          />
          <AudioEngineState />
        </Row>
        <Row
          id="notifications"
          label={t("settings.general.notifications.label")}
          description={t("settings.general.notifications.description")}
        >
          {notificationsEnabled && notificationPermission === "denied" ? (
            <NotificationsBlocked />
          ) : null}
          {notificationsEnabled && notificationPermission === "unsupported" ? (
            <span className="text-[12px] text-content/60">
              {t("settings.general.notifications.unsupported")}
            </span>
          ) : null}
          <Toggle
            label={t("settings.general.notifications.toggle")}
            on={
              notificationsEnabled && notificationPermission !== "unsupported"
            }
            onChange={onNotificationsEnabled}
            disabled={notificationPermission === "unsupported"}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.general.sounds.custom.title")}
        description={t("settings.general.sounds.custom.description")}
      >
        {CUSTOMIZABLE_CUES.map((cue) => (
          <SoundCueRow
            key={cue}
            cue={cue}
            pref={soundPrefs[cue] ?? "preset"}
            onPref={onSoundPref}
          />
        ))}
      </Group>

      <div
        id={settingDomId("project-notifications")}
        data-setting-id="project-notifications"
        // Focus target for search reveals: programmatic focus only, never Tab.
        tabIndex={-1}
      >
        <ProjectNotificationSettings
          cwd={cwd}
          recents={recents}
          notificationProjectPath={notificationProjectPath}
          notificationSettingsRequest={notificationSettingsRequest}
          highlighted={revealed === "project-notifications"}
        />
      </div>
    </>
  );
}
