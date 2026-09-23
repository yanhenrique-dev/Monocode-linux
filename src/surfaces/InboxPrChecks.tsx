import { useEffect, useState, type ReactNode } from "react";
import { openExternalBestEffort } from "../lib/openExternal";
import {
  formatRelativeTime,
  githubPrChecks,
  githubPrMergeConflicting,
  githubPrMergeInfo,
  groupGithubPrChecks,
  type GithubPrCheck,
  type GithubPrChecks,
  type GithubPrMergeInfo,
} from "../lib/githubTasks";
import { Check, CircleX, ExternalLink, LoaderCircle } from "../chrome/icons";
import { Tooltip } from "../components/ui/tooltip";

/** Check runs on the pull request head, grouped like github.com shows them:
 * in-progress checks with a spinner, successful checks, failures, and the
 * mergeable note. Unknown/empty states stay quiet instead of hiding. */
export function GithubPrChecks({
  projectPath,
  repo,
  number,
  revision = 0,
}: {
  projectPath: string;
  repo: string;
  number: number;
  /** Bumped by explicit refreshes/actions: reloads checks past the cache. */
  revision?: number;
}) {
  const [checks, setChecks] = useState<GithubPrChecks | null>(null);
  const [mergeInfo, setMergeInfo] = useState<GithubPrMergeInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChecks(null);
    setMergeInfo(null);
    const force = revision > 0 ? { force: true } : undefined;
    void githubPrChecks(projectPath, repo, number, force).then((next) => {
      if (!cancelled) setChecks(next);
    });
    void githubPrMergeInfo(projectPath, repo, number, force).then((next) => {
      if (!cancelled) setMergeInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [projectPath, repo, number, revision]);

  if (!checks) return null;
  const { running, successful, failed } = groupGithubPrChecks(checks.checks);
  const mergeNote = mergeNoteFor(mergeInfo);
  if (
    running.length === 0 &&
    successful.length === 0 &&
    failed.length === 0 &&
    !mergeNote
  ) {
    return (
      <p className="pt-0.5 text-[12px] text-content/40">No checks reported</p>
    );
  }
  return (
    <section aria-label="Checks" className="flex min-w-0 flex-col gap-1 pt-1">
      {running.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="text-[11px] font-medium text-content/45">
            In progress checks
          </h4>
          {running.map((check) => (
            <CheckRow
              key={`running:${check.name}:${check.url}`}
              check={check}
              icon={
                <LoaderCircle
                  aria-label="Loading"
                  className="size-3.5 shrink-0 animate-spin text-content/50"
                />
              }
            />
          ))}
        </div>
      ) : null}
      {successful.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="text-[11px] font-medium text-content/45">
            Successful checks
          </h4>
          {successful.map((check) => (
            <CheckRow
              key={`ok:${check.name}:${check.url}`}
              check={check}
              icon={
                <Check
                  aria-label="Successful"
                  className="size-3.5 shrink-0 text-emerald-400/90"
                  strokeWidth={2.25}
                />
              }
            />
          ))}
        </div>
      ) : null}
      {failed.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="text-[11px] font-medium text-content/45">
            Failed checks
          </h4>
          {failed.map((check) => (
            <CheckRow
              key={`failed:${check.name}:${check.url}`}
              check={check}
              icon={
                <CircleX
                  aria-label="Failed"
                  className="size-3.5 shrink-0 text-rose-400/90"
                  strokeWidth={1.75}
                />
              }
            />
          ))}
        </div>
      ) : null}
      {mergeNote ? (
        <p className={`pt-0.5 text-[12px] ${mergeNote.className}`}>
          {mergeNote.text}
        </p>
      ) : null}
    </section>
  );
}

function mergeNoteFor(
  info: GithubPrMergeInfo | null,
): { text: string; className: string } | null {
  if (!info) return null;
  if (githubPrMergeConflicting(info)) {
    return {
      text: "This pull request has merge conflicts",
      className: "text-rose-400/90",
    };
  }
  const mergeable = info.mergeable?.trim().toUpperCase();
  const state = info.mergeStateStatus?.trim().toUpperCase();
  if (state === "BLOCKED") {
    return { text: "Merging is blocked", className: "text-amber-400/90" };
  }
  if (mergeable === "MERGEABLE" || state === "CLEAN" || state === "BEHIND") {
    return {
      text: "No conflicts with base branch",
      className: "text-content/55",
    };
  }
  return null;
}

function CheckRow({ check, icon }: { check: GithubPrCheck; icon: ReactNode }) {
  const when = check.startedAt.trim()
    ? formatRelativeTime(check.startedAt)
    : "";
  const row = (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-content/70">
      {icon}
      <span className="min-w-0 flex-1 truncate">{check.name}</span>
      {when ? (
        <span className="shrink-0 text-[11px] text-content/40">{when}</span>
      ) : null}
    </span>
  );
  if (!check.url) return row;
  return (
    <Tooltip content={`Open ${check.name}`}>
      <button
        type="button"
        onClick={() => openExternalBestEffort(check.url)}
        className="group flex min-w-0 items-center gap-1 text-left hover:underline"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{row}</span>
        <ExternalLink className="size-3 shrink-0 text-content/30 group-hover:text-content/60" />
      </button>
    </Tooltip>
  );
}
