import type { ExplorerMenuItem } from "./ExplorerMenu";
import { type Translate } from "../lib/locale";
import { reminderTime } from "../lib/sessionReminders";

export function sessionReminderPresets(t: Translate, now = new Date()) {
  const timeInHours = (hours: 1 | 3) => {
    const date = new Date(reminderTime(`reminder:${hours}h`, now)!);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  return [
    {
      kind: "item",
      id: "reminder:1h",
      label: t("shell.reminder.one_hour", { time: timeInHours(1) }),
    },
    {
      kind: "item",
      id: "reminder:3h",
      label: t("shell.reminder.three_hours", { time: timeInHours(3) }),
    },
    {
      kind: "item",
      id: "reminder:evening",
      label: t("shell.reminder.evening"),
      disabled: reminderTime("reminder:evening", now) == null,
    },
    { kind: "item", id: "reminder:tomorrow", label: t("shell.reminder.tomorrow") },
    {
      kind: "item",
      id: "reminder:next-week",
      label: t("shell.reminder.next_week"),
    },
  ] satisfies ExplorerMenuItem[];
}
