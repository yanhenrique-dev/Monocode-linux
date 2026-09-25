import { Search, X } from "../../../chrome/icons";
import { useMemo, useRef, useState } from "react";
import { useLocale } from "../../../lib/locale";
import {
  filterKeybindings,
  KEYBINDINGS,
  keybindingWhenLabel,
} from "../../../lib/settings";
import { Group } from "../../settings/SettingsChrome";

export function KeybindingsPage() {
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const { locale, t } = useLocale();
  const rows = useMemo(
    () => filterKeybindings(KEYBINDINGS, query, locale),
    [query, locale],
  );

  return (
    <Group
      title={t("settings.keybindings.group.title")}
      description={t("settings.keybindings.group.description")}
      action={
        <div className="flex items-center gap-4">
          <span
            aria-live="polite"
            className="shrink-0 text-[12px] text-content/60 tabular-nums"
          >
            {rows.length}{" "}
            {rows.length === 1
              ? t("settings.keybindings.count.singular")
              : t("settings.keybindings.count.plural")}
          </span>
          <label className="flex h-8 w-48 shrink-0 items-center gap-2 rounded-md border border-content/15 px-2 text-content/60 focus-within:border-content/20">
            <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
            <input
              ref={filterRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("settings.keybindings.filter.placeholder")}
              aria-label={t("settings.keybindings.filter.aria")}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("settings.search.clear")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  // Keyboard activation would otherwise strand focus on a
                  // button that unmounts with the cleared query.
                  filterRef.current?.focus();
                }}
                className="grid size-4 shrink-0 place-items-center rounded text-content/45 hover:text-content"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            ) : null}
          </label>
        </div>
      }
    >
      <div className="flex items-center border-b border-stroke bg-content/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-content/60">
        <span className="min-w-0 flex-1">
          {t("settings.keybindings.table.command")}
        </span>
        <span className="w-48 shrink-0">
          {t("settings.keybindings.table.keybinding")}
        </span>
        <span className="w-32 shrink-0">
          {t("settings.keybindings.table.when")}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[12px] text-content/60">
          {t("settings.keybindings.list.empty")}
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={`${row.command}-${row.keys}`}
            className="flex items-center border-b border-content/10 px-4 py-2 text-[12px] last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{t(row.command)}</span>
            <span className="w-48 shrink-0 font-mono text-[12px] text-content/80">
              {row.keys}
            </span>
            <span className="w-32 shrink-0 font-mono text-xs text-content/60">
              {keybindingWhenLabel(row.when, locale)}
            </span>
          </div>
        ))
      )}
    </Group>
  );
}
