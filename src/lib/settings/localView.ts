import {
  DEFAULT_SIDEBAR_TAB_ORDER,
  type SidebarTabId,
} from "./schema";

/**
 * The three view-state keys, and who owns them.
 *
 * These are not boot keys -- `index.html` never reads them -- so they never
 * enter the mirror. Their source of truth is localStorage, and the native file
 * is a write-through cache: the store holds a copy purely so that saving some
 * unrelated setting does not write back a stale value and quietly undo a
 * change the user made.
 *
 * That is a deliberate choice, not an unfinished migration. Moving the source
 * of truth to the native file would be tidier, but Rust's `#[serde(default)]`
 * cannot tell "the user never set this" from "the user set it to the
 * default", so every existing install would lose these values on upgrade --
 * the one outcome the boot mirror exists to prevent. The other way out is
 * per-field presence tracking, which is the migration machinery this project
 * declined. Until a schema bump makes absence detectable, localStorage stays
 * the owner and the reversal is a small, local change.
 */
export const PROJECT_RAIL_OPEN_KEY = "monocode.projectRailOpen";
export const SETTINGS_SECTION_KEY = "monocode.settingsSection";
export const SIDEBAR_TAB_ORDER_KEY = "monocode.sidebarTabOrder";

const TAB_IDS: readonly SidebarTabId[] = [
  "files",
  "sessions",
  "changes",
  "inbox",
];

export type LocalViewState = {
  projectRailOpen: boolean;
  settingsSection: string;
  sidebarTabOrder: SidebarTabId[];
};

function readFlag(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : raw === "1";
  } catch {
    return null;
  }
}

/** Mirrors `loadSidebarTabOrder`: repair a partial list rather than trust it. */
function readTabOrder(): SidebarTabId[] | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_TAB_ORDER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const next = parsed.filter((id): id is SidebarTabId =>
      TAB_IDS.includes(id as SidebarTabId),
    );
    for (const id of DEFAULT_SIDEBAR_TAB_ORDER) {
      if (!next.includes(id)) next.push(id);
    }
    return next.length === DEFAULT_SIDEBAR_TAB_ORDER.length
      ? next
      : [...DEFAULT_SIDEBAR_TAB_ORDER];
  } catch {
    return null;
  }
}

/** Read at hydration so the store's cache starts in agreement with the owner. */
export function readLocalView(
  fallback: LocalViewState,
): LocalViewState {
  return {
    projectRailOpen: readFlag(PROJECT_RAIL_OPEN_KEY) ?? fallback.projectRailOpen,
    settingsSection:
      (() => {
        try {
          return (
            localStorage.getItem(SETTINGS_SECTION_KEY) ?? fallback.settingsSection
          );
        } catch {
          return fallback.settingsSection;
        }
      })(),
    sidebarTabOrder: readTabOrder() ?? fallback.sidebarTabOrder,
  };
}
