import {
  isProjectMuted,
  NOTIFICATION_MUTE_HOURS,
  type ProjectNotificationPreference,
} from "../lib/notificationPreferences";
import { getIntlLocale, loadLocale, t, type Locale } from "../lib/locale";

/** A single status label for the project rail, menus, and mute controls. */
export function notificationMuteStatus(
  preference: ProjectNotificationPreference | undefined,
  locale: Locale = loadLocale(),
): string | null {
  if (!preference || !isProjectMuted(preference)) return null;
  return preference.mutedUntil === null
    ? t(locale, "settings.inbox.mute.status_resumed")
    : t(locale, "settings.inbox.mute.status_until", {
        date: new Date(preference.mutedUntil!).toLocaleString(
          getIntlLocale(locale),
          { dateStyle: "medium", timeStyle: "short" },
        ),
      });
}

/** The same preset IDs and durations are used by project and Inbox menus. */
function mutePresets(locale: Locale) {
  return [
    ...NOTIFICATION_MUTE_HOURS.map((hours) => ({
      kind: "item" as const,
      id: `mute:${hours}`,
      label: `${hours} ${hours === 1 ? t(locale, "settings.inbox.mute.hour_one") : t(locale, "settings.inbox.mute.hour_other")}`,
      milliseconds: hours * 3_600_000,
    })),
    {
      kind: "item" as const,
      id: "mute:indefinite",
      label: t(locale, "settings.inbox.mute.until_resumed"),
      milliseconds: null,
    },
    {
      kind: "item" as const,
      id: "mute:custom",
      label: t(locale, "settings.inbox.mute.custom"),
    },
  ];
}

export function notificationMuteActions(
  now = new Date(Date.now()),
  locale: Locale = loadLocale(),
) {
  const tomorrow = t(locale, "settings.inbox.mute.tomorrow");
  return mutePresets(locale).map((action) => {
    if (action.milliseconds == null) return action;
    const until = new Date(now.getTime() + action.milliseconds);
    const time = `${until.getHours()}:${String(until.getMinutes()).padStart(2, "0")}`;
    const day = until.toDateString() === now.toDateString() ? "" : tomorrow;
    return { ...action, label: `${action.label} (${day}${time})` };
  });
}

export function notificationMuteDeadline(
  id: string,
): number | null | undefined {
  const action = mutePresets(loadLocale()).find((item) => item.id === id);
  if (!action || action.milliseconds === undefined) return undefined;
  return action.milliseconds === null ? null : Date.now() + action.milliseconds;
}
