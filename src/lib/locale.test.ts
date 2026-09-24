// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyLocale,
  getIntlLocale,
  initLocale,
  loadLocale,
  LocaleProvider,
  saveLocale,
  STRINGS,
  t,
  useLocale,
} from "./locale";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  vi.unstubAllGlobals();
});

describe("locale dictionaries", () => {
  it("keeps full key parity between en and pt-BR", () => {
    expect(new Set(Object.keys(STRINGS["pt-BR"]))).toEqual(
      new Set(Object.keys(STRINGS.en)),
    );
  });

  it("translates a known key", () => {
    expect(t("pt-BR", "settings.general.sounds.label")).toBe("Sons");
    expect(t("en", "settings.general.sounds.label")).toBe("Sounds");
  });

  it("translates shell labels outside Settings", () => {
    expect(t("pt-BR", "shell.menu.file")).toBe("Arquivo");
    expect(t("pt-BR", "shell.title.new_session")).toBe("Nova sessão");
    expect(t("pt-BR", "shell.filters.needs_approval")).toBe("Requer aprovação");
    expect(t("pt-BR", "shell.usage.refresh")).toBe("Atualizar uso");
  });

  it("interpolates {vars} and keeps unknown placeholders", () => {
    expect(
      t("en", "settings.general.update.available", {
        availableVersion: "1.2.3",
      }),
    ).toBe("Version 1.2.3 is available.");
    expect(t("en", "settings.general.update.available")).toBe(
      "Version {availableVersion} is available.",
    );
  });
});

describe("locale store", () => {
  it("re-renders translated consumers when locale changes", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.setItem("monocode.locale", "en");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    function Probe() {
      const { t: translate } = useLocale();
      return createElement("span", null, translate("shell.menu.file"));
    }

    await act(async () => {
      root.render(
        createElement(LocaleProvider, null, createElement(Probe)),
      );
    });
    expect(container.textContent).toBe("File");

    await act(async () => {
      saveLocale("pt-BR");
      applyLocale("pt-BR");
    });
    expect(container.textContent).toBe("Arquivo");

    await act(async () => root.unmount());
    container.remove();
  });

  it("round-trips through localStorage", () => {
    saveLocale("pt-BR");
    expect(loadLocale()).toBe("pt-BR");
  });

  it("falls back to en for unknown stored values", () => {
    localStorage.setItem("monocode.locale", "fr");
    expect(loadLocale()).toBe("en");
  });

  it("detects pt from the OS language on first run", () => {
    vi.stubGlobal("navigator", { language: "pt-BR" });
    expect(loadLocale()).toBe("pt-BR");
  });

  it("applies document.lang for assistive tech", () => {
    applyLocale("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    applyLocale("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("boots through initLocale", () => {
    vi.stubGlobal("navigator", { language: "pt-PT" });
    expect(initLocale()).toBe("pt-BR");
    expect(localStorage.getItem("monocode.locale")).toBe("pt-BR");
  });
});

describe("getIntlLocale", () => {
  it("maps app locales to BCP 47 tags", () => {
    expect(getIntlLocale("pt-BR")).toBe("pt-BR");
    expect(getIntlLocale("en")).toBe("en-US");
  });
});
