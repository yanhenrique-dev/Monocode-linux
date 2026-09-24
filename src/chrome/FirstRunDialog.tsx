import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { copyText } from "../lib/clipboard";
import { githubStatus } from "../lib/githubTasks";
import {
  probeFirstRunReport,
  type FirstRunReport,
  type GithubProbe,
} from "../lib/firstRun";
import { useLocale } from "../lib/locale";
import {
  formatReleaseDate,
  presentReleaseNotes,
  releaseNotesTitle,
} from "../lib/releaseNotes";
import { HARNESS_TITLE, type HarnessId } from "../lib/session";
import { openExternalBestEffort } from "../lib/openExternal";
import { HarnessIcon } from "./HarnessIcon";
import { Check, Copy, ExternalLink, RefreshCw } from "./icons";
import { Modal } from "./Modal";
import { ProjectMascot } from "./ProjectMascot";
import { SecondaryButton } from "./SecondaryButton";
import { Shimmer } from "../surfaces/Shimmer";
import { useExperimentalAnimations } from "../hooks/useExitAnimation";

const STEP_COUNT = 4;
const STEP_KEYS = [
  "welcome.version.title",
  "welcome.clis.title",
  "welcome.github.title",
  "welcome.providers.title",
] as const;

type Props = {
  onClose: () => void;
  onOpenInbox: () => void;
  onOpenProviders: () => void;
};

export function FirstRunDialog({
  onClose,
  onOpenInbox,
  onOpenProviders,
}: Props) {
  const { t } = useLocale();
  const animated = useExperimentalAnimations();
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<FirstRunReport | null>(null);
  const [github, setGithub] = useState<GithubProbe | null>(null);
  const [checking, setChecking] = useState(true);
  const [githubChecking, setGithubChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [copied, setCopied] = useState<HarnessId | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const loadRequest = useRef(0);
  const githubRequest = useRef(0);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  const loadReport = useCallback(async () => {
    const generation = ++loadRequest.current;
    setChecking(true);
    setError(null);
    try {
      const next = await probeFirstRunReport();
      if (generation !== loadRequest.current) return;
      setReport(next);
      setGithub(next.github);
    } catch {
      if (generation === loadRequest.current) {
        setError(tRef.current("welcome.errors.load"));
      }
    } finally {
      if (generation === loadRequest.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
    return () => {
      loadRequest.current += 1;
    };
  }, [loadReport]);

  const retryGithub = useCallback(async () => {
    const generation = ++githubRequest.current;
    setGithubChecking(true);
    setGithubError(null);
    try {
      const next = (await githubStatus()) ?? {
        connected: false,
        installed: false,
        authenticated: false,
      };
      if (generation !== githubRequest.current) return;
      setGithub(next);
      setReport((current) =>
        current ? { ...current, github: next } : current,
      );
    } catch {
      if (generation === githubRequest.current) {
        setGithubError(tRef.current("welcome.errors.github"));
      }
    } finally {
      if (generation === githubRequest.current) setGithubChecking(false);
    }
  }, []);

  useEffect(
    () => () => {
      githubRequest.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!checking) primaryActionRef.current?.focus();
  }, [checking, step]);

  const nextStep = useCallback(() => {
    if (step === STEP_COUNT - 1) {
      onClose();
      return;
    }
    setStep((current) => current + 1);
  }, [onClose, step]);

  const previousStep = useCallback(() => {
    setStep((current) => Math.max(0, current - 1));
  }, []);

  const copyInstall = useCallback(async (id: HarnessId, command: string) => {
    try {
      await copyText(command);
      setCopied(id);
      window.setTimeout(
        () => setCopied((current) => (current === id ? null : current)),
        1500,
      );
    } catch {
      setCopied(null);
    }
  }, []);

  const leaveTo = useCallback(
    (callback: () => void) => {
      onClose();
      callback();
    },
    [onClose],
  );

  const currentKey = STEP_KEYS[step];
  const title = t("welcome.dialog.step", {
    step: step + 1,
    total: STEP_COUNT,
    title: t(currentKey),
  });

  return (
    <Modal
      onClose={onClose}
      title={title}
      description={t("welcome.description")}
      size="md"
      className="h-[min(72vh,640px)]"
      dismissible={false}
      hideClose
    >
      <div className="flex min-h-full flex-col">
        <Stepper current={step} />
        <div aria-live="polite" className="sr-only">
          {title}
        </div>
        <main
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
          aria-busy={checking}
          inert={checking ? true : undefined}
        >
          {!report ? (
            error ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-sm text-red-300">
                <span>{error}</span>
                <SecondaryButton onClick={() => void loadReport()}>
                  {t("welcome.actions.retry")}
                </SecondaryButton>
              </div>
            ) : (
              <div className="flex min-h-52 items-center justify-center text-sm text-content/55">
                <Shimmer>{t("welcome.loading")}</Shimmer>
              </div>
            )
          ) : (
            <div key={step} className={animated ? "zen-step-in" : undefined}>
              {step === 0 ? <VersionStep report={report} /> : null}
              {step === 1 ? (
                <ClisStep
                  report={report}
                  copied={copied}
                  onCopy={copyInstall}
                />
              ) : null}
              {step === 2 ? (
                <GithubStep
                  github={github}
                  checking={githubChecking}
                  error={githubError}
                  onRetry={retryGithub}
                  onOpenInbox={() => leaveTo(onOpenInbox)}
                  onOpenProviders={() => leaveTo(onOpenProviders)}
                />
              ) : null}
              {step === 3 ? <ProvidersStep report={report} /> : null}
            </div>
          )}
          {error && report ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-300">
              <span>{error}</span>
              <SecondaryButton onClick={() => void loadReport()}>
                {t("welcome.actions.retry")}
              </SecondaryButton>
            </div>
          ) : null}
        </main>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-content/10 px-5 py-3">
          <SecondaryButton disabled={step === 0} onClick={previousStep}>
            {t("welcome.actions.back")}
          </SecondaryButton>
          <div className="flex items-center gap-2">
            {step < STEP_COUNT - 1 ? (
              <SecondaryButton onClick={onClose}>
                {t("welcome.actions.skip")}
              </SecondaryButton>
            ) : null}
            <Button
              ref={primaryActionRef}
              autoFocus
              disabled={checking || !report}
              onClick={nextStep}
            >
              {step === STEP_COUNT - 1
                ? t("welcome.actions.start")
                : t("welcome.actions.continue")}
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

function Stepper({ current }: { current: number }) {
  const { t } = useLocale();
  return (
    <nav
      aria-label={t("welcome.progress")}
      className="shrink-0 border-b border-content/10 px-5 py-3"
    >
      <ol className="flex items-center gap-2">
        {STEP_KEYS.map((key, index) => {
          const active = index === current;
          return (
            <li key={key} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-medium ${
                  active
                    ? "bg-content text-background-base"
                    : index < current
                      ? "bg-content/15 text-content/70"
                      : "bg-content/5 text-content/35"
                }`}
              >
                {index < current ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={`truncate text-[11px] ${
                  active ? "text-content" : "text-content/45"
                }`}
              >
                {t(key)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function VersionStep({ report }: { report: FirstRunReport }) {
  const { t } = useLocale();
  const notes = presentReleaseNotes(report.system.version);
  const date = notes?.date ? formatReleaseDate(notes.date) : null;
  return (
    <section className="flex min-h-full flex-col items-center justify-center text-center">
      <ProjectMascot project="first-run" className="size-16 text-content" />
      <h3 className="mt-5 text-xl font-semibold text-content">
        {t("welcome.title")}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-content/60">
        {t("welcome.version.body")}
      </p>
      <div className="mt-6 rounded-xl border border-content/10 bg-content/[0.03] px-6 py-4">
        <p className="text-xs uppercase tracking-[0.12em] text-content/40">
          {t("welcome.version.current")}
        </p>
        <p className="mt-1 font-mono text-2xl text-content">
          v{report.system.version}
        </p>
      </div>
      {notes ? (
        <div className="mt-4 text-xs text-content/50">
          {t("welcome.version.release_notes", {
            title: releaseNotesTitle(report.system.version),
          })}
          {date ? ` · ${date}` : ""}
        </div>
      ) : null}
      {report.system.flatpak ? (
        <p className="mt-2 text-xs text-content/50">
          {t("welcome.version.flatpak")}
        </p>
      ) : null}
    </section>
  );
}

function ClisStep({
  report,
  copied,
  onCopy,
}: {
  report: FirstRunReport;
  copied: HarnessId | null;
  onCopy: (id: HarnessId, command: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const animated = useExperimentalAnimations();
  const ready = report.clis.filter((cli) => cli.available).length;
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-content">
            {t("welcome.clis.title")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-content/55">
            {t("welcome.clis.body")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-content/55">
          {t("welcome.clis.ready_count", {
            count: ready,
            total: report.clis.length,
          })}
        </span>
      </div>
      <ul className="mt-4 divide-y divide-content/10 rounded-xl border border-content/10">
        {report.clis.map((cli, index) => (
          <li
            key={cli.id}
            className={`flex items-center gap-3 px-3 py-2.5 ${animated ? "zen-step-in" : ""}`}
            style={
              animated
                ? { animationDelay: `${Math.min(index * 45, 300)}ms` }
                : undefined
            }
          >
            <HarnessIcon harness={cli.id} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-content">
                {HARNESS_TITLE[cli.id]}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-content/45">
                {cli.available ? t("welcome.clis.ready") : cli.hint}
              </span>
            </span>
            {cli.install && !cli.available ? (
              <SecondaryButton
                aria-label={t("welcome.clis.copy", {
                  name: HARNESS_TITLE[cli.id],
                })}
                onClick={() => {
                  if (cli.install) void onCopy(cli.id, cli.install);
                }}
              >
                {copied === cli.id ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === cli.id
                  ? t("welcome.clis.copied")
                  : t("welcome.clis.copy_short")}
              </SecondaryButton>
            ) : (
              <StatusDot available={cli.available} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GithubStep({
  github,
  checking,
  error,
  onRetry,
  onOpenInbox,
  onOpenProviders,
}: {
  github: GithubProbe | null;
  checking: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  onOpenInbox: () => void;
  onOpenProviders: () => void;
}) {
  const { t } = useLocale();
  if (!github) return <Shimmer>{t("welcome.github.checking")}</Shimmer>;
  const connected = github.connected && github.authenticated;
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-content/5 text-content/70">
          <ExternalLink className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-content">
            {t("welcome.github.title")}
          </h3>
          <p className="mt-1 text-xs text-content/50">
            {t("welcome.github.body")}
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-content/10 bg-content/[0.03] p-4">
        <div className="flex items-start gap-3">
          <StatusDot available={connected || github.installed} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-content">
              {connected
                ? t("welcome.github.connected")
                : github.installed
                  ? t("welcome.github.auth_needed")
                  : t("welcome.github.not_installed")}
            </p>
            {github.installed && !connected ? (
              <code className="mt-2 block w-fit rounded bg-content/10 px-2 py-1 font-mono text-xs text-content/80">
                gh auth login
              </code>
            ) : null}
          </div>
        </div>
        {github.rateLimited ? (
          <p className="mt-3 text-xs text-amber-300" role="status">
            {github.retryAfterSecs && github.retryAfterSecs > 0
              ? t("welcome.github.rate_limited", {
                  seconds: github.retryAfterSecs,
                })
              : t("welcome.github.rate_limited_unknown")}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button onClick={onOpenInbox}>
              {t("welcome.github.open_inbox")}
            </Button>
            <SecondaryButton onClick={onOpenProviders}>
              {t("welcome.github.open_providers")}
            </SecondaryButton>
          </>
        ) : github.installed ? (
          <Button disabled={checking} onClick={() => void onRetry()}>
            {checking ? <RefreshCw className="size-3.5 animate-spin" /> : null}
            {checking
              ? t("welcome.github.checking_button")
              : t("welcome.github.retry")}
          </Button>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <SecondaryButton
              onClick={() => openExternalBestEffort("https://cli.github.com/")}
            >
              {t("welcome.github.installation_guide")}
            </SecondaryButton>
            <p className="text-[11px] text-content/45">
              {t("welcome.github.docs_hint")}
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-content/45">
        {t("welcome.github.optional")}
      </p>
    </section>
  );
}

function ProvidersStep({ report }: { report: FirstRunReport }) {
  const { t } = useLocale();
  const installed = report.clis.filter((cli) => cli.available);
  const missing = report.clis.filter((cli) => !cli.available);
  const hasReadyCli = installed.length > 0;
  return (
    <section>
      <h3 className="text-lg font-semibold text-content">
        {t("welcome.providers.title")}
      </h3>
      <p className="mt-1 text-xs leading-5 text-content/55">
        {t("welcome.providers.body")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ProviderGroup
          title={t("welcome.providers.installed")}
          clis={installed}
          available
        />
        <ProviderGroup
          title={t("welcome.providers.missing")}
          clis={missing}
          available={false}
        />
      </div>
      <ul className="mt-5 space-y-2 rounded-xl border border-content/10 p-4 text-xs text-content/65">
        <li
          className={`flex gap-2 ${hasReadyCli ? "" : "text-amber-300"}`}
        >
          {hasReadyCli ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
          ) : (
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-current"
            />
          )}
          {t(
            hasReadyCli
              ? "welcome.providers.checklist_cli"
              : "welcome.providers.no_cli_ready",
          )}
        </li>
        <li className="flex gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
          {t("welcome.providers.checklist_github")}
        </li>
        <li className="flex gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
          {t("welcome.providers.checklist_settings")}
        </li>
      </ul>
    </section>
  );
}

function ProviderGroup({
  title,
  clis,
  available,
}: {
  title: string;
  clis: FirstRunReport["clis"];
  available: boolean;
}) {
  return (
    <div className="rounded-xl border border-content/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-content/45">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {clis.length === 0 ? (
          <li className="text-xs text-content/40">—</li>
        ) : (
          clis.map((cli) => (
            <li
              key={cli.id}
              className="flex items-center gap-2 text-xs text-content/70"
            >
              <HarnessIcon harness={cli.id} className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {HARNESS_TITLE[cli.id]}
              </span>
              <StatusDot available={available} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function StatusDot({ available }: { available: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-full ${available ? "bg-accent" : "bg-content/20"}`}
    />
  );
}
