import { useEffect, useRef, useState } from "react";
import { useProjectBranchesState } from "../hooks/useProjectBranches";
import { useProjectWorktrees } from "../hooks/useProjectWorktrees";
import { pathKey, prettyCwd } from "../lib/paths";
import { type Worktree } from "../lib/worktrees";
import { useLocale } from "../lib/locale";
import { BranchPicker } from "./BranchPicker";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";
import { GitPickerTrigger } from "./GitPickerTrigger";
import { Popover } from "./Popover";
import {
  Check,
  FolderTree,
  GitBranch,
  Loader,
  Plus,
  Search,
  Settings,
} from "./icons";

export function WorktreePicker({
  cwd,
  executionCwd,
  enabled = true,
  opensNewSession = false,
  worktreeRemoved = false,
  onSelect,
  onBranchChange,
  onManage,
  onClose,
}: {
  cwd: string;
  executionCwd: string;
  enabled?: boolean;
  opensNewSession?: boolean;
  worktreeRemoved?: boolean;
  onSelect: (tree: Worktree) => Promise<void>;
  onBranchChange?: () => void;
  onManage?: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [branchPicker, setBranchPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState<string>();
  const anchor = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const { t } = useLocale();
  const { branches, settled } = useProjectBranchesState(
    worktreeRemoved ? cwd : executionCwd,
    !!cwd && cwd !== "~",
  );
  const inWorktree = pathKey(cwd) !== pathKey(executionCwd);
  const {
    data,
    error: loadError,
    refresh,
  } = useProjectWorktrees(
    cwd,
    enabled && (worktreeRemoved || !!branches?.current || inWorktree),
  );
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setCreating(false);
      setBranchPicker(false);
    }
  }, [enabled]);
  const dismiss = () => {
    setOpen(false);
    setQuery("");
    setActivePath(undefined);
    onClose?.();
  };
  const select = async (tree: Worktree) => {
    if (busy || tree.missing) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSelect(tree);
      dismiss();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const rows =
    data?.worktrees.filter((tree) =>
      `${tree.branch ?? "detached"} ${tree.path}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  // Default to the current working copy, including when rows arrive after open.
  // Track navigation by path so background refreshes cannot move the highlight.
  const active = Math.max(
    0,
    rows.findIndex(
      (tree) => pathKey(tree.path) === pathKey(activePath ?? executionCwd),
    ),
  );
  const activeRowPath = rows[active]?.path;
  useEffect(() => {
    if (open) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [open, active, activeRowPath]);
  if (branchPicker)
    return (
      <BranchPicker
        cwd={executionCwd}
        enabled={enabled}
        worktree={inWorktree}
        initialOpen
        onDismiss={() => setBranchPicker(false)}
        onChange={onBranchChange}
        onClose={() => {
          setBranchPicker(false);
          onClose?.();
        }}
      />
    );
  return (
    <div ref={anchor} className="relative flex min-w-0 shrink-0">
      <GitPickerTrigger
        disabled={
          !enabled || (!worktreeRemoved && !branches?.current && !inWorktree)
        }
        title={
          worktreeRemoved
            ? t("settings.worktrees.picker_continue")
            : t("settings.worktrees.picker_working_copy", {
                path: prettyCwd(executionCwd),
              })
        }
        aria-label={t("settings.worktrees.picker_choose")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setError(undefined);
          setQuery("");
          setActivePath(undefined);
          if (!open) refresh();
          setOpen(!open);
        }}
        label={
          worktreeRemoved
            ? t("settings.worktrees.picker_no_branch")
            : branches?.current
              ? branches.detached
                ? t("settings.worktrees.picker_detached", {
                    ref: branches.current,
                  })
                : branches.current
              : settled
                ? inWorktree
                  ? t("settings.worktrees.picker_unavailable")
                  : t("settings.worktrees.picker_no_repo")
                : t("settings.worktrees.picker_loading_short")
        }
        worktree={!worktreeRemoved && inWorktree}
      />
      {open && (
        <Popover
          anchor={anchor}
          side="top"
          width={320}
          maxHeight={400}
          onDismiss={() => {
            if (!busy) dismiss();
          }}
          role="dialog"
          aria-label={t("settings.worktrees.picker_title")}
          data-branch-picker
          className="flex flex-col overflow-hidden"
        >
          <label className="flex shrink-0 items-center gap-2 border-b border-stroke px-3 py-2">
            <Search className="size-3.5 text-content/40" />
            <input
              ref={search}
              aria-label={t("settings.worktrees.picker_search_aria")}
              placeholder={t("settings.worktrees.picker_search")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActivePath(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      active + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  );
                  setActivePath(rows[next]?.path);
                }
                if (e.key === "Enter" && rows[active]) {
                  e.preventDefault();
                  void select(rows[active]);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
            />
          </label>
          {worktreeRemoved && (
            <p className="shrink-0 px-3 pt-2 pb-1 text-[11px] text-content/50">
              {t("settings.worktrees.picker_removed")}
            </p>
          )}
          {opensNewSession && !worktreeRemoved && (
            <p className="shrink-0 px-3 pt-2 pb-1 text-[11px] text-content/50">
              {t("settings.worktrees.picker_new_session")}
            </p>
          )}
          <div
            className="min-h-0 overflow-y-auto p-1"
            role="listbox"
            aria-label={t("settings.worktrees.picker_title")}
          >
            {!data && !loadError && (
              <div className="flex items-center gap-2 p-2 text-[12px] text-content/50">
                <Loader className="size-3.5 animate-spin" />
                {t("settings.worktrees.picker_loading")}
              </div>
            )}
            {rows.map((tree, index) => (
              <button
                key={tree.path}
                ref={index === active ? activeOption : undefined}
                type="button"
                role="option"
                aria-selected={
                  !worktreeRemoved &&
                  pathKey(tree.path) === pathKey(executionCwd)
                }
                disabled={busy || tree.missing}
                onMouseEnter={() => setActivePath(tree.path)}
                onClick={() => void select(tree)}
                title={tree.path}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left disabled:opacity-40 ${active === index ? "bg-selection" : "hover:bg-content/5"}`}
              >
                {tree.isMain ? (
                  <GitBranch className="size-3.5 shrink-0 text-content/50" />
                ) : (
                  <FolderTree className="size-3.5 shrink-0 text-content/50" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">
                    {tree.branch ??
                      t("settings.worktrees.picker_detached_row", {
                        hash: tree.head.slice(0, 7),
                      })}
                  </span>
                  <span className="block truncate text-[10px] text-content/40">
                    {tree.isMain
                      ? t("settings.worktrees.picker_project_folder")
                      : prettyCwd(tree.path)}
                    {tree.missing
                      ? ` · ${t("settings.worktrees.picker_missing")}`
                      : ""}
                  </span>
                </span>
                {!worktreeRemoved &&
                  pathKey(tree.path) === pathKey(executionCwd) && (
                    <Check className="size-3.5" />
                  )}
              </button>
            ))}
            {data && !rows.length && (
              <p className="p-2 text-[12px] text-content/45">
                {t("settings.worktrees.picker_no_match")}
              </p>
            )}
            {(error || loadError) && (
              <p role="alert" className="px-2 py-2 text-[11px] text-red-400">
                {error || loadError}
              </p>
            )}
          </div>
          <div className="shrink-0 border-t border-stroke p-1 text-[12px]">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-content/8"
            >
              <Plus className="size-3.5" />
              {t("settings.worktrees.picker_create")}
            </button>
            <button
              type="button"
              disabled={busy || worktreeRemoved}
              onClick={() => {
                setOpen(false);
                setBranchPicker(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-content/55 hover:bg-content/8 disabled:opacity-40"
            >
              <GitBranch className="size-3.5" />
              {t("settings.worktrees.picker_switch")}
            </button>
            {onManage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  dismiss();
                  onManage();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-content/55 hover:bg-content/8"
              >
                <Settings className="size-3.5" />
                {t("settings.worktrees.picker_manage")}
              </button>
            )}
          </div>
        </Popover>
      )}
      {creating && (
        <CreateWorktreeDialog
          cwd={cwd}
          baseCwd={worktreeRemoved ? cwd : executionCwd}
          defaultRoot={data?.defaultRoot}
          onCreated={async (tree) => {
            setCreating(false);
            setOpen(true);
            await select(tree);
          }}
          onCancel={() => {
            setCreating(false);
            onClose?.();
          }}
        />
      )}
    </div>
  );
}
