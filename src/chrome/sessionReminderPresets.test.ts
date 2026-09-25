import { describe, expect, it } from "vitest";
import { t, type Translate } from "../lib/locale";
import { sessionReminderPresets } from "./sessionReminderPresets";

const english: Translate = (key, vars) => t("en", key, vars);
const portuguese: Translate = (key, vars) => t("pt-BR", key, vars);
const now = new Date(2026, 8, 11, 10);

describe("reminder preset labels", () => {
  it("keeps stable IDs and English labels", () => {
    const presets = sessionReminderPresets(english, now);

    expect(presets.map((preset) => preset.id)).toEqual([
      "reminder:1h",
      "reminder:3h",
      "reminder:evening",
      "reminder:tomorrow",
      "reminder:next-week",
    ]);
    expect(presets.map((preset) => preset.label)).toEqual([
      "In 1 hour (11:00)",
      "In 3 hours (13:00)",
      "This evening (18:00)",
      "Tomorrow (9:00)",
      "Next week (Mon 9:00)",
    ]);
  });

  it("translates labels without changing IDs", () => {
    const presets = sessionReminderPresets(portuguese, now);

    expect(presets.map((preset) => preset.id)).toEqual([
      "reminder:1h",
      "reminder:3h",
      "reminder:evening",
      "reminder:tomorrow",
      "reminder:next-week",
    ]);
    expect(presets.map((preset) => preset.label)).toEqual([
      "Em 1 hora (11:00)",
      "Em 3 horas (13:00)",
      "Esta noite (18:00)",
      "Amanhã (9:00)",
      "Semana que vem (seg. 9:00)",
    ]);
  });
});
