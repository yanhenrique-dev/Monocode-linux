import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COMPOSER_RUNNER_DEFAULT,
  searchSettings,
  SETTINGS_INDEX,
  settingsSectionsByGroup,
  MODEL_CONTROLS_DEFAULT,
  DIFF_VIEWER_DEFAULT,
  FOLLOW_UP_BEHAVIOR_DEFAULT,
  GRID_ARCADE_ENABLED_DEFAULT,
  KEYBINDINGS,
  LIVE_AGENTS_ENABLED_DEFAULT,
  keybindingWhenLabel,
  loadComposerRunner,
  loadDiffViewer,
  loadFollowUpBehavior,
  loadGridArcadeEnabled,
  loadLiveAgentsEnabled,
  loadModelControls,
  loadNotesEnabled,
  loadTerminalGpu,
  NOTES_ENABLED_DEFAULT,
  saveComposerRunner,
  saveModelControls,
  saveDiffViewer,
  saveFollowUpBehavior,
  saveGridArcadeEnabled,
  saveLiveAgentsEnabled,
  saveNotesEnabled,
  saveTerminalGpu,
  subscribeTerminalGpu,
  TERMINAL_GPU_DEFAULT,
} from "./settings";
import { MOD, SHIFT } from "./platform";
import { t } from "./locale";

const KEY = "monocode.composerRunner";
const MODEL_CONTROLS_KEY = "monocode.modelControls";
const LEGACY_EFFORT_VISIBLE_KEY = "monocode.composerEffortVisible";
const NOTES_KEY = "monocode.notesEnabled";
const LIVE_AGENTS_KEY = "monocode.liveAgentsEnabled";
const GRID_ARCADE_KEY = "monocode.gridArcadeEnabled";
const DIFF_VIEWER_KEY = "monocode.diffViewer";
const FOLLOW_UP_BEHAVIOR_KEY = "monocode.followUpBehavior";
const TERMINAL_GPU_KEY = "monocode.terminalGpu";

describe("follow-up behavior setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(FOLLOW_UP_BEHAVIOR_KEY);
  });

  it("defaults to queue", () => {
    expect(FOLLOW_UP_BEHAVIOR_DEFAULT).toBe("queue");
    expect(loadFollowUpBehavior()).toBe("queue");
  });

  it("persists queue behavior", () => {
    saveFollowUpBehavior("queue");
    expect(loadFollowUpBehavior()).toBe("queue");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(FOLLOW_UP_BEHAVIOR_KEY, "interrupt");
    expect(loadFollowUpBehavior()).toBe("queue");
  });
});

function mockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("composer runner setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(KEY);
  });

  it("defaults to on", () => {
    expect(COMPOSER_RUNNER_DEFAULT).toBe(true);
    expect(loadComposerRunner()).toBe(true);
  });

  it("persists an off switch", () => {
    saveComposerRunner(false);
    expect(localStorage.getItem(KEY)).toBe("0");
    expect(loadComposerRunner()).toBe(false);
    saveComposerRunner(true);
    expect(loadComposerRunner()).toBe(true);
  });
});

describe("model controls setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(MODEL_CONTROLS_KEY);
    localStorage.removeItem(LEGACY_EFFORT_VISIBLE_KEY);
  });

  it("keeps options in the model menu by default", () => {
    expect(MODEL_CONTROLS_DEFAULT).toBe("menu");
    expect(loadModelControls()).toBe("menu");
  });

  it("persists the beside-picker preference", () => {
    saveModelControls("beside");
    expect(localStorage.getItem(MODEL_CONTROLS_KEY)).toBe("beside");
    expect(loadModelControls()).toBe("beside");
    saveModelControls("menu");
    expect(loadModelControls()).toBe("menu");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(MODEL_CONTROLS_KEY, "everywhere");
    expect(loadModelControls()).toBe("menu");
  });

  it("migrates the previous effort-control toggle", () => {
    localStorage.setItem(LEGACY_EFFORT_VISIBLE_KEY, "1");
    expect(loadModelControls()).toBe("beside");
    localStorage.setItem(LEGACY_EFFORT_VISIBLE_KEY, "0");
    localStorage.removeItem(MODEL_CONTROLS_KEY);
    expect(loadModelControls()).toBe("menu");
  });
});

describe("notes enabled setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(NOTES_KEY);
  });

  it("defaults to on", () => {
    expect(NOTES_ENABLED_DEFAULT).toBe(true);
    expect(loadNotesEnabled()).toBe(true);
  });

  it("persists an off switch", () => {
    saveNotesEnabled(false);
    expect(localStorage.getItem(NOTES_KEY)).toBe("0");
    expect(loadNotesEnabled()).toBe(false);
    saveNotesEnabled(true);
    expect(loadNotesEnabled()).toBe(true);
  });
});

describe("live agents enabled setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(LIVE_AGENTS_KEY);
  });

  it("defaults to on", () => {
    expect(LIVE_AGENTS_ENABLED_DEFAULT).toBe(true);
    expect(loadLiveAgentsEnabled()).toBe(true);
  });

  it("persists an off switch", () => {
    saveLiveAgentsEnabled(false);
    expect(localStorage.getItem(LIVE_AGENTS_KEY)).toBe("0");
    expect(loadLiveAgentsEnabled()).toBe(false);
    saveLiveAgentsEnabled(true);
    expect(loadLiveAgentsEnabled()).toBe(true);
  });
});

describe("grid arcade enabled setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(GRID_ARCADE_KEY);
  });

  it("defaults to on", () => {
    expect(GRID_ARCADE_ENABLED_DEFAULT).toBe(true);
    expect(loadGridArcadeEnabled()).toBe(true);
  });

  it("persists an off switch", () => {
    saveGridArcadeEnabled(false);
    expect(localStorage.getItem(GRID_ARCADE_KEY)).toBe("0");
    expect(loadGridArcadeEnabled()).toBe(false);
    saveGridArcadeEnabled(true);
    expect(loadGridArcadeEnabled()).toBe(true);
  });
});

describe("terminal gpu setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(TERMINAL_GPU_KEY);
  });

  it("defaults to on", () => {
    expect(TERMINAL_GPU_DEFAULT).toBe(true);
    expect(loadTerminalGpu()).toBe(true);
  });

  it("persists an off switch", () => {
    saveTerminalGpu(false);
    expect(localStorage.getItem(TERMINAL_GPU_KEY)).toBe("0");
    expect(loadTerminalGpu()).toBe(false);
    saveTerminalGpu(true);
    expect(loadTerminalGpu()).toBe(true);
  });

  it("notifies subscribers with the saved value even when storage fails", () => {
    const seen: boolean[] = [];
    const scope = globalThis as unknown as { window?: EventTarget };
    const previousWindow = scope.window;
    scope.window = new EventTarget();
    const failingStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: failingStore,
      configurable: true,
    });
    try {
      const unsubscribe = subscribeTerminalGpu((enabled) =>
        seen.push(enabled),
      );
      saveTerminalGpu(false);
      unsubscribe();
    } finally {
      if (previousWindow === undefined) delete scope.window;
      else scope.window = previousWindow;
      mockLocalStorage();
    }
    expect(seen).toEqual([false]);
    // A re-read here falls back to the enabled default, which is exactly
    // why subscribers must trust the event value instead.
    expect(loadTerminalGpu()).toBe(true);
  });
});

describe("workspace navigation keybindings", () => {
  it("documents the command palette and reload shortcuts", () => {
    expect(
      KEYBINDINGS.filter((row) =>
        [
          "settings.keybindings.cmd.app_command_palette",
          "settings.keybindings.cmd.view_reload",
        ].includes(row.command),
      ),
    ).toEqual([
      {
        command: "settings.keybindings.cmd.app_command_palette",
        keys: `${MOD}${SHIFT}P`,
        when: "Always",
      },
      {
        command: "settings.keybindings.cmd.view_reload",
        keys: `${MOD}${SHIFT}R`,
        when: "Always",
      },
    ]);
  });
  it("documents session and project cycling in the shortcut list", () => {
    const rows = KEYBINDINGS.filter((row) =>
      [
        "settings.keybindings.cmd.session_previous",
        "settings.keybindings.cmd.session_next",
        "settings.keybindings.cmd.project_previous",
        "settings.keybindings.cmd.project_next",
      ].includes(row.command),
    );
    expect(rows.map((row) => row.command)).toEqual([
      "settings.keybindings.cmd.session_previous",
      "settings.keybindings.cmd.session_next",
      "settings.keybindings.cmd.project_previous",
      "settings.keybindings.cmd.project_next",
    ]);
    expect(
      rows.every(
        (row) => row.when === "!overlay && (!textFocus || emptyComposer)",
      ),
    ).toBe(true);
  });
  it("resolves English command names through the dictionary", () => {
    expect(t("en", "settings.keybindings.cmd.session_previous")).toBe(
      "Session: Previous",
    );
    expect(keybindingWhenLabel("Always", "en")).toBe("Always");
    expect(keybindingWhenLabel("Always", "pt-BR")).toBe("Sempre");
  });
  it("humanizes technical when guards instead of echoing expressions", () => {
    expect(keybindingWhenLabel("sessionFocus && !overlay", "en")).toBe(
      "In session",
    );
    expect(keybindingWhenLabel("sessionFocus && !overlay", "pt-BR")).toBe(
      "Na sessão",
    );
    expect(
      keybindingWhenLabel("!overlay && (!textFocus || emptyComposer)", "en"),
    ).toBe("When not typing");
    expect(keybindingWhenLabel("!editorFocus", "en")).toBe(
      "Outside the editor",
    );
    expect(keybindingWhenLabel("Draft session composer", "pt-BR")).toBe(
      "Composer de rascunho",
    );
    expect(keybindingWhenLabel("something-new", "en")).toBe("something-new");
  });
});

describe("diff viewer setting", () => {
  beforeEach(mockLocalStorage);
  afterEach(() => {
    localStorage.removeItem(DIFF_VIEWER_KEY);
  });

  it("defaults to the editor layout", () => {
    expect(DIFF_VIEWER_DEFAULT).toBe("editor");
    expect(loadDiffViewer()).toBe("editor");
  });

  it("persists the unified layout", () => {
    saveDiffViewer("unified");
    expect(localStorage.getItem(DIFF_VIEWER_KEY)).toBe("unified");
    expect(loadDiffViewer()).toBe("unified");
    saveDiffViewer("editor");
    expect(loadDiffViewer()).toBe("editor");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(DIFF_VIEWER_KEY, "split");
    expect(loadDiffViewer()).toBe("editor");
  });
});

describe("settings navigation", () => {
  it("lists every section under exactly one rail group", () => {
    const groups = settingsSectionsByGroup();
    expect(groups.map((group) => group.label)).toEqual([
      "settings.group.app",
      "settings.group.agents",
      "settings.group.workspace",
    ]);
    expect(groups.flatMap((group) => group.sections.map((s) => s.id))).toEqual([
      "general",
      "notifications",
      "performance",
      "appearance",
      "keybindings",
      "chat",
      "providers",
      "skills",
      "inbox",
      "archive",
      "worktrees",
    ]);
  });

  it("points every indexed setting at a real section", () => {
    const sections = new Set(
      settingsSectionsByGroup().flatMap((group) =>
        group.sections.map((section) => section.id),
      ),
    );
    for (const entry of SETTINGS_INDEX) {
      expect(sections.has(entry.section), entry.id).toBe(true);
    }
  });

  it("documents the draft workspace toggle", () => {
    expect(
      KEYBINDINGS.find(
        (row) =>
          row.command === "settings.keybindings.cmd.composer_toggle_workspace",
      ),
    ).toEqual({
      command: "settings.keybindings.cmd.composer_toggle_workspace",
      keys: `${MOD}${SHIFT}G`,
      when: "Draft session composer",
    });
  });
});

describe("settings search", () => {
  it("returns nothing for an empty query", () => {
    expect(searchSettings("   ")).toEqual([]);
  });

  it("ranks label matches over keyword matches, and pages last", () => {
    expect(
      searchSettings("glass", 8, "en").map((result) => result.label),
    ).toEqual([
      "Main pane glass",
      "Blur radius",
      "Interface blur",
      "Sidebar opacity",
      "Appearance",
    ]);
  });

  it("finds a setting by a word that is not in its label", () => {
    expect(searchSettings("steer", 8, "en")[0]).toMatchObject({
      section: "chat",
      sectionLabel: "Chat",
      settingId: "follow-up",
      label: "Follow-up behavior",
    });
  });

  it("folds accents so unaccented queries match accented labels", () => {
    expect(
      searchSettings("notificacoes", 8, "pt-BR").map((result) => result.label),
    ).toContain("Notificações");
    expect(
      searchSettings("transcricao", 8, "pt-BR").map((result) => result.label),
    ).toContain("Layout da transcrição");
    expect(
      searchSettings("NOTIFICACOES", 8, "pt-BR").map(
        (result) => result.label,
      ),
    ).toContain("Notificações");
  });

  it("searches in Portuguese when pt-BR is active", () => {
    expect(
      searchSettings("desfoque", 8, "pt-BR").map((result) => result.label),
    ).toContain("Desfoque da interface");
    expect(searchSettings("idioma", 8, "pt-BR")[0]).toMatchObject({
      section: "general",
      settingId: "language",
      label: "Idioma",
    });
  });

  it("returns a whole page with no setting id", () => {
    expect(searchSettings("skills", 8, "en")).toEqual([
      {
        section: "skills",
        sectionLabel: "Skills",
        settingId: null,
        label: "Skills",
      },
    ]);
  });

  it("caps the result list", () => {
    expect(searchSettings("e", 4, "en")).toHaveLength(4);
  });
});
