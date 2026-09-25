import { describe, expect, it } from "vitest";
import { t, type Translate } from "../lib/locale";
import { changesTabAriaLabel } from "./Sidebar";

const english: Translate = (key, vars) => t("en", key, vars);
const portuguese: Translate = (key, vars) => t("pt-BR", key, vars);

describe("Changes tab accessibility label", () => {
  it("keeps the English label and statistics", () => {
    expect(changesTabAriaLabel(3, 2, english)).toBe("Changes +3 -2");
    expect(changesTabAriaLabel(0, 0, english)).toBe("Changes");
  });

  it("localizes the label while preserving statistics", () => {
    expect(changesTabAriaLabel(3, 2, portuguese)).toBe(
      "Alterações +3 -2",
    );
  });
});
