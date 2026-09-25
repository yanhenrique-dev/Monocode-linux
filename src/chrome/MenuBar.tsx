import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExplorerMenu, type ExplorerMenuItem } from "./ExplorerMenu";
import { ALT, MOD, SHIFT } from "../lib/platform";
import { runUpdateFlow } from "../lib/updater";
import { useLocale } from "../lib/locale";

type MenuKey = "file" | "view" | "terminal";

type Props = {
  onNew: () => void;
  onNewTerminal?: () => void;
  onToggleTerminal?: () => void;
  onGoToFile?: () => void;
  onOpenCommandPalette?: () => void;
  onReload?: () => void;
  onToggleSidebar: () => void;
  onShowSourceControl?: () => void;
  onCloseCurrentTab?: () => void;
  onCloseOtherTabs?: () => void;
  onCloseAllTabs?: () => void;
  onPickProject?: () => void;
  onFindInProject?: () => void;
  onSearch?: () => void;
  onOpenInbox?: () => void;
  onOpenNotes?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
};

export function MenuBar({
  onNew,
  onNewTerminal,
  onToggleTerminal,
  onGoToFile,
  onOpenCommandPalette,
  onReload,
  onToggleSidebar,
  onShowSourceControl,
  onCloseCurrentTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onPickProject,
  onFindInProject,
  onSearch,
  onOpenInbox,
  onOpenNotes,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const barRef = useRef<HTMLDivElement>(null);

  // Toggle with standalone Alt key tap
  useEffect(() => {
    let altPressedAlone = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        altPressedAlone = true;
      } else if (altPressedAlone) {
        altPressedAlone = false;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" && altPressedAlone) {
        setOpen((prev) => {
          if (prev) {
            setActiveMenu(null);
            setMenuAnchor(null);
            return false;
          }
          return true;
        });
        altPressedAlone = false;
      }
    };

    const onBlur = () => {
      altPressedAlone = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const openDropdown = useCallback((key: MenuKey, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setActiveMenu(key);
    setMenuAnchor({ x: rect.left, y: rect.bottom + 2 });
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
    setMenuAnchor(null);
  }, []);

  const handlePick = useCallback(
    (id: string) => {
      closeMenu();
      setOpen(false);

      switch (id) {
        case "new_tab":
          onNew();
          break;
        case "new_terminal":
          onNewTerminal?.();
          break;
        case "toggle_terminal":
          onToggleTerminal?.();
          break;
        case "new_window":
          void invoke("open_new_window").catch(() => {});
          break;
        case "open_project":
          onPickProject?.();
          break;
        case "open_search":
          onSearch?.();
          break;
        case "open_inbox":
          onOpenInbox?.();
          break;
        case "open_notes":
          onOpenNotes?.();
          break;
        case "go_to_file":
          onGoToFile?.();
          break;
        case "open_command_palette":
          onOpenCommandPalette?.();
          break;
        case "reload":
          onReload?.();
          break;
        case "find_in_project":
          onFindInProject?.();
          break;
        case "close_tab":
          onCloseCurrentTab?.();
          break;
        case "close_other_tabs":
          onCloseOtherTabs?.();
          break;
        case "close_all_tabs":
          onCloseAllTabs?.();
          break;
        case "toggle_sidebar":
          onToggleSidebar();
          break;
        case "open_model_picker":
          window.dispatchEvent(new Event("open_model_picker"));
          break;
        case "toggle_diff":
          onShowSourceControl?.();
          break;
        case "check_for_updates":
          void runUpdateFlow(true);
          break;
        case "zoom_in":
          onZoomIn?.();
          break;
        case "zoom_out":
          onZoomOut?.();
          break;
        case "zoom_reset":
          onZoomReset?.();
          break;
      }
    },
    [
      closeMenu,
      onCloseCurrentTab,
      onCloseOtherTabs,
      onCloseAllTabs,
      onFindInProject,
      onGoToFile,
      onOpenCommandPalette,
      onReload,
      onNew,
      onNewTerminal,
      onToggleTerminal,
      onPickProject,
      onSearch,
      onOpenInbox,
      onOpenNotes,
      onShowSourceControl,
      onToggleSidebar,
      onZoomIn,
      onZoomOut,
      onZoomReset,
    ],
  );

  const getMenuItems = (key: MenuKey): ExplorerMenuItem[] => {
    switch (key) {
      case "file":
        return [
          {
            kind: "item",
            id: "new_tab",
            label: t("shell.menu.new_tab"),
            shortcut: `${MOD}T`,
          },
          {
            kind: "item",
            id: "new_terminal",
            label: t("shell.menu.new_terminal"),
            shortcut: `${MOD}\``,
          },
          {
            kind: "item",
            id: "new_window",
            label: t("shell.menu.new_window"),
            shortcut: `${MOD}${SHIFT}N`,
          },
          { kind: "sep" },
          {
            kind: "item",
            id: "open_project",
            label: t("shell.menu.open_project"),
            shortcut: `${MOD}O`,
          },
          {
            kind: "item",
            id: "open_search",
            label: t("shell.menu.search"),
            shortcut: `${MOD}K`,
          },
          {
            kind: "item",
            id: "go_to_file",
            label: t("shell.menu.go_to_file"),
            shortcut: `${MOD}P`,
          },
          {
            kind: "item",
            id: "open_command_palette",
            label: t("shell.menu.command_palette"),
            shortcut: `${MOD}${SHIFT}P`,
          },
          {
            kind: "item",
            id: "find_in_project",
            label: t("shell.menu.find_in_files"),
            shortcut: `${MOD}${SHIFT}F`,
          },
          { kind: "sep" },
          {
            kind: "item",
            id: "close_tab",
            label: t("shell.menu.close_pane"),
            shortcut: `${MOD}W`,
          },
          {
            kind: "item",
            id: "close_other_tabs",
            label: t("shell.menu.close_other_tabs"),
            shortcut: `${MOD}${ALT}T`,
          },
          {
            kind: "item",
            id: "close_all_tabs",
            label: t("shell.menu.close_all_tabs"),
            shortcut: `${MOD}${SHIFT}W`,
          },
          { kind: "sep" },
          {
            kind: "item",
            id: "check_for_updates",
            label: t("shell.menu.check_for_updates"),
          },
        ];
      case "view":
        return [
          {
            kind: "item",
            id: "toggle_sidebar",
            label: t("shell.menu.toggle_sidebar"),
            shortcut: `${MOD}B`,
          },
          { kind: "item", id: "open_inbox", label: t("shell.menu.inbox") },
          ...(onOpenNotes
            ? [
                {
                  kind: "item" as const,
                  id: "open_notes",
                  label: t("shell.menu.notes"),
                },
              ]
            : []),
          {
            kind: "item",
            id: "toggle_terminal",
            label: t("shell.menu.toggle_terminal"),
            shortcut: `${MOD}J`,
          },
          {
            kind: "item",
            id: "open_model_picker",
            label: t("shell.menu.switch_model"),
            shortcut: `${MOD}.`,
          },
          {
            kind: "item",
            id: "toggle_diff",
            label: t("shell.menu.toggle_changes"),
          },
          { kind: "sep" },
          {
            kind: "item",
            id: "zoom_in",
            label: t("shell.menu.zoom_in"),
            shortcut: `${MOD}+`,
          },
          {
            kind: "item",
            id: "zoom_out",
            label: t("shell.menu.zoom_out"),
            shortcut: `${MOD}-`,
          },
          {
            kind: "item",
            id: "zoom_reset",
            label: t("shell.menu.zoom_reset"),
            shortcut: `${MOD}0`,
          },
          {
            kind: "item",
            id: "reload",
            label: t("shell.menu.reload"),
            shortcut: `${MOD}${SHIFT}R`,
          },
        ];
      case "terminal":
        return [
          {
            kind: "item",
            id: "new_terminal",
            label: t("shell.menu.new_terminal"),
            shortcut: `${MOD}\``,
          },
          {
            kind: "item",
            id: "toggle_terminal",
            label: t("shell.menu.toggle_terminal"),
            shortcut: `${MOD}J`,
          },
        ];
    }
  };

  if (!open && !activeMenu) {
    return null;
  }

  const MENUS: { key: MenuKey; label: string }[] = [
    { key: "file", label: t("shell.menu.file") },
    { key: "view", label: t("shell.menu.view") },
    { key: "terminal", label: t("shell.menu.terminal") },
  ];

  return (
    <div
      ref={barRef}
      className="flex h-7 shrink-0 items-center gap-0.5 border-b border-stroke bg-content/5 px-2 text-[12px]"
      data-tauri-drag-region="false"
    >
      {MENUS.map(({ key, label }) => {
        const isActive = activeMenu === key;
        return (
          <button
            key={key}
            type="button"
            data-tauri-drag-region="false"
            onClick={(e) => {
              if (isActive) {
                closeMenu();
              } else {
                openDropdown(key, e.currentTarget);
              }
            }}
            onMouseEnter={(e) => {
              if (activeMenu && activeMenu !== key) {
                openDropdown(key, e.currentTarget);
              }
            }}
            className={`rounded px-2 py-0.5 transition-colors ${
              isActive
                ? "bg-selection-hover text-content"
                : "text-content/70 hover:bg-content/10 hover:text-content"
            }`}
          >
            {label}
          </button>
        );
      })}

      {activeMenu && menuAnchor ? (
        <ExplorerMenu
          x={menuAnchor.x}
          y={menuAnchor.y}
          items={getMenuItems(activeMenu)}
          ariaLabel={
            activeMenu === "file"
              ? t("shell.menu.file_menu")
              : activeMenu === "view"
                ? t("shell.menu.view_menu")
                : t("shell.menu.terminal_menu")
          }

          onPick={handlePick}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}
