import {
  ArrowDownCircle,
  LoaderCircle,
  RefreshCw,
} from "../../../chrome/icons";
import { useEffect, useState } from "react";
import { SecondaryButton } from "../../../chrome/SecondaryButton";
import {
  applyLocale,
  getIntlLocale,
  saveLocale,
  useLocale,
  type Locale,
} from "../../../lib/locale";
import {
  loadLiveAgentsEnabled,
  loadNotesEnabled,
  loadReviewAdoptShell,
  saveLiveAgentsEnabled,
  saveNotesEnabled,
  saveReviewAdoptShell,
} from "../../../lib/settings";
import {
  installPendingUpdate,
  isFlatpakSandbox,
  readAppVersion,
  runUpdateFlow,
  type UpdaterSnapshot,
} from "../../../lib/updater";
import { Group, Row } from "../../settings/SettingsChrome";
import { Toggle } from "../../settings/SettingsControls";
import { Select } from "../../settings/SettingsSelect";

export function GeneralPage({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const [notesEnabled, setNotesEnabled] = useState(loadNotesEnabled);
  const [reviewAdoptShell, setReviewAdoptShell] =
    useState(loadReviewAdoptShell);
  const [liveAgentsEnabled, setLiveAgentsEnabled] = useState(
    loadLiveAgentsEnabled,
  );
  const { locale, t } = useLocale();

  const onNotesEnabled = (next: boolean) => {
    saveNotesEnabled(next);
    setNotesEnabled(next);
  };

  const onReviewAdoptShell = (next: boolean) => {
    saveReviewAdoptShell(next);
    setReviewAdoptShell(next);
  };

  const onLiveAgentsEnabled = (next: boolean) => {
    saveLiveAgentsEnabled(next);
    setLiveAgentsEnabled(next);
  };

  const onLanguage = (value: string) => {
    const next: Locale = value === "pt-BR" ? "pt-BR" : "en";
    saveLocale(next);
    applyLocale(next);
  };

  return (
    <>
      <Group
        title={t("settings.general.workspace.title")}
        description={t("settings.general.workspace.description")}
      >
        <Row
          id="notes"
          label={t("settings.general.notes.label")}
          description={t("settings.general.notes.description")}
        >
          <Toggle
            label={t("settings.general.notes.toggle")}
            on={notesEnabled}
            onChange={onNotesEnabled}
          />
        </Row>
        <Row
          id="working-agents"
          label={t("settings.general.working_agents.label")}
          description={t("settings.general.working_agents.description")}
        >
          <Toggle
            label={t("settings.general.working_agents.toggle")}
            on={liveAgentsEnabled}
            onChange={onLiveAgentsEnabled}
          />
        </Row>
        <Row
          id="session-review-shell"
          label={t("settings.general.session_review_shell.label")}
          description={t("settings.general.session_review_shell.description")}
        >
          <Toggle
            label={t("settings.general.session_review_shell.toggle")}
            on={reviewAdoptShell}
            onChange={onReviewAdoptShell}
          />
        </Row>
      </Group>

      <Group title={t("settings.general.about.title")}>
        <UpdateRow onOpenWhatsNew={onOpenWhatsNew} />
        <Row
          id="language"
          label={t("settings.general.language.label")}
          description={t("settings.general.language.description")}
        >
          <Select
            label={t("settings.general.language.label")}
            value={locale}
            options={[
              {
                value: "en",
                label: t("settings.general.language.option.english"),
              },
              {
                value: "pt-BR",
                label: t("settings.general.language.option.portuguese"),
              },
            ]}
            onChange={onLanguage}
          />
        </Row>
      </Group>
    </>
  );
}

function UpdateRow({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: (version: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });
  const { locale, t } = useLocale();
  const [holding, setHolding] = useState(false);
  const [isFlatpak, setIsFlatpak] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readAppVersion().then((currentVersion) => {
      if (cancelled) return;
      setSnapshot((current) => ({ ...current, currentVersion }));
    });
    void isFlatpakSandbox().then((sandboxed) => {
      if (cancelled) return;
      setIsFlatpak(sandboxed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy =
    snapshot.phase === "checking" ||
    snapshot.phase === "downloading" ||
    holding;
  const hasUpdate = snapshot.phase === "available";

  const onClick = async () => {
    if (busy) return;
    // Guarantee a beat of spinner: fast checks (cached "latest version" or
    // instant errors) would otherwise never paint the busy state.
    const startedAt = Date.now();
    setHolding(true);
    try {
      if (hasUpdate) {
        await installPendingUpdate(setSnapshot, { showDialog: false });
        return;
      }
      await runUpdateFlow(true, setSnapshot, { showDialog: false });
      setLastChecked(Date.now());
    } finally {
      const remaining = MIN_BUSY_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setHolding(false);
    }
  };

  // Sandboxed (Flatpak) builds have no self-updater: Flathub owns updates.
  const checkedSuffix =
    lastChecked == null ||
    snapshot.phase === "checking" ||
    snapshot.phase === "downloading" ||
    snapshot.phase === "available"
      ? ""
      : ` · ${t("settings.general.update.last_checked", {
          time: new Intl.DateTimeFormat(getIntlLocale(locale), {
            hour: "2-digit",
            minute: "2-digit",
          }).format(lastChecked),
        })}`;
  const status = isFlatpak
    ? t("settings.general.update.flatpak")
    : snapshot.phase === "available"
      ? t("settings.general.update.available", {
          availableVersion: snapshot.availableVersion ?? "",
        })
      : snapshot.phase === "downloading"
        ? snapshot.progress != null
          ? t("settings.general.update.downloading", {
              progress: snapshot.progress,
            })
          : t("settings.general.update.downloading_pending")
        : snapshot.phase === "checking"
          ? t("settings.general.update.checking")
          : snapshot.phase === "current"
            ? `${t("settings.general.update.current")}${checkedSuffix}`
            : snapshot.phase === "error"
              ? `${t("settings.general.update.failed_detail", {
                  error: snapshot.error ?? t("settings.general.update.failed"),
                })}${checkedSuffix}`
              : `${t("settings.general.update.idle")}${checkedSuffix}`;

  return (
    <Row
      id="update"
      label={
        <span className="flex items-baseline gap-2">
          {t("settings.general.update.label")}
          <span className="font-mono text-[12px] text-content/60">
            {snapshot.currentVersion}
          </span>
        </span>
      }
      description={status}
    >
      <div className="flex items-center gap-2">
        <SecondaryButton
          onClick={() =>
            onOpenWhatsNew(snapshot.availableVersion ?? snapshot.currentVersion)
          }
          disabled={snapshot.currentVersion === "…"}
        >
          {t("settings.general.update.whats_new")}
        </SecondaryButton>
        {!isFlatpak && (
          <SecondaryButton onClick={() => void onClick()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : hasUpdate ? (
              <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
            )}
            {t("settings.general.update.check")}
            {hasUpdate && !busy && snapshot.availableVersion ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                {snapshot.availableVersion}
              </span>
            ) : null}
          </SecondaryButton>
        )}
      </div>
    </Row>
  );
}

/** Minimum spinner time so instant results still paint the busy state. */
const MIN_BUSY_MS = 500;
