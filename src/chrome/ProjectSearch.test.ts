import { describe, expect, it } from "vitest";
import { t, type Translate } from "../lib/locale";
import { projectSearchResultLabel } from "./ProjectSearch";

const english: Translate = (key, vars) => t("en", key, vars);
const portuguese: Translate = (key, vars) => t("pt-BR", key, vars);

describe("project search result labels", () => {
  it("uses singular file wording for multiple matches in one file", () => {
    expect(projectSearchResultLabel(2, 1, english)).toBe(
      "2 results in 1 file",
    );
    expect(projectSearchResultLabel(2, 1, portuguese)).toBe(
      "2 resultados em 1 arquivo",
    );
  });

  it("keeps singular and multi-file wording correct", () => {
    expect(projectSearchResultLabel(1, 1, english)).toBe(
      "1 result in 1 file",
    );
    expect(projectSearchResultLabel(1, 2, portuguese)).toBe(
      "1 resultado em 2 arquivos",
    );
    expect(projectSearchResultLabel(2, 2, english)).toBe(
      "2 results in 2 files",
    );
  });
});
