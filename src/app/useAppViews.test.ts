// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useAppViews, type AppViewsDeps } from "./useAppViews";

type ViewsApi = ReturnType<typeof useAppViews>;

let container: HTMLDivElement;
let root: Root;
let deps: AppViewsDeps;
let api: { current: ViewsApi | null };

function makeDeps(): AppViewsDeps {
  return {
    history: [],
    sidebarCwd: "/repo",
    sidebarTab: "files",
    sessionsRef: { current: [] },
    searchViewOpen: false,
    inboxViewOpen: false,
    notesViewOpen: false,
    settingsOpen: true,
    dockVisible: true,
    setProjectRailOpen: vi.fn(),
    setSidebarTab: vi.fn(),
    setFilesSearchOpen: vi.fn(),
    setSearchFocusToken: vi.fn(),
    setSearchViewOpen: vi.fn(),
    setSearchViewFocusToken: vi.fn(),
    setInboxViewOpen: vi.fn(),
    setLinkedWorkItemPanels: vi.fn(),
    setNotesViewOpen: vi.fn(),
    setSettingsOpen: vi.fn(),
    setSettingsSection: vi.fn(),
    setSettingsAnchor: vi.fn(),
    setNotificationProjectPath: vi.fn(),
    setNotificationSettingsRequest: vi.fn(),
    setFilePickerOpen: vi.fn(),
    setFilePickerInitialQuery: vi.fn(),
    setFilePickerResetToken: vi.fn(),
    setProjectTerminalFocused: vi.fn(),
    onSelectHistorySession: vi.fn(),
    onVisitBack: vi.fn(),
    onVisitForward: vi.fn(),
  };
}

function renderApi() {
  api = { current: null };
  function Probe() {
    api.current = useAppViews(deps);
    return null;
  }
  act(() => root.render(createElement(Probe)));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  deps = makeDeps();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  renderApi();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useAppViews overlay transitions", () => {
  it.each([
    [
      "go to file",
      (views: ViewsApi) => views.onGoToFile(),
      () => deps.setFilePickerOpen,
    ],
    [
      "command palette",
      (views: ViewsApi) => views.onOpenCommandPalette(),
      () => deps.setFilePickerOpen,
    ],
    [
      "find in project",
      (views: ViewsApi) => views.onFindInProject(),
      () => deps.setFilesSearchOpen,
    ],
  ])(
    "closes settings before opening %s",
    (_name, open, getDestination) => {
      const settings = vi.mocked(deps.setSettingsOpen);
      const destination = vi.mocked(getDestination());
      settings.mockClear();
      destination.mockClear();
      act(() => open(api.current!));
      expect(settings).toHaveBeenCalledWith(false);
      expect(destination).toHaveBeenCalledWith(true);
      expect(settings.mock.invocationCallOrder[0]).toBeLessThan(
        destination.mock.invocationCallOrder[0],
      );
    },
  );
});
