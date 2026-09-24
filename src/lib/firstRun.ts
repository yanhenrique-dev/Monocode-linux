import { githubStatus, type GithubStatus } from "./githubTasks";
import {
  harnessInstallHint,
  harnessUnavailableHint,
  isHarnessAvailable,
  probeHarnessAvailability,
} from "./harness/availability";
import { HARNESSES, type HarnessId } from "./session";
import { audioPlaybackState, type AudioPlaybackState } from "./soundFiles";
import {
  probeNotificationPermission,
  type NotificationPermission,
} from "./notifications";
import { isFlatpakSandbox, readAppVersion } from "./updater";

export const FIRST_RUN_KEY = "monocode.firstRunDone";

export type FirstRunStore = Pick<Storage, "getItem" | "setItem">;

export type CliProbe = {
  id: HarnessId;
  available: boolean;
  hint: string;
  install?: string;
};

export type GithubProbe = {
  connected: boolean;
  installed: boolean;
  authenticated: boolean;
  rateLimited?: boolean;
  retryAfterSecs?: number;
};

export type SystemProbe = {
  version: string;
  flatpak: boolean;
  notifications: NotificationPermission;
  audio: AudioPlaybackState;
};

export type FirstRunReport = {
  clis: CliProbe[];
  github: GithubProbe;
  system: SystemProbe;
};

export function loadFirstRunDone(store?: FirstRunStore): boolean {
  try {
    return (store ?? window.localStorage).getItem(FIRST_RUN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveFirstRunDone(store?: FirstRunStore): void {
  try {
    (store ?? window.localStorage).setItem(FIRST_RUN_KEY, "1");
  } catch {
    return;
  }
}

export function shouldBlockAppAction(firstRunOpen: boolean): boolean {
  return firstRunOpen;
}

export async function probeFirstRunReport(): Promise<FirstRunReport> {
  const [version, , github, flatpak, notifications, audio] = await Promise.all([
    readAppVersion(),
    probeHarnessAvailability({ force: true }),
    githubStatus(),
    isFlatpakSandbox(),
    probeNotificationPermission(),
    audioPlaybackState(),
  ]);

  const clis = HARNESSES.map((id) => {
    const available = isHarnessAvailable(id);
    const install = harnessInstallHint(id) ?? undefined;
    return {
      id,
      available,
      hint: available ? "" : harnessUnavailableHint(id),
      ...(install ? { install } : {}),
    } satisfies CliProbe;
  });

  return {
    clis,
    github: toGithubProbe(github),
    system: { version, flatpak, notifications, audio },
  };
}

function unavailableGithubStatus(): GithubStatus {
  return {
    connected: false,
    installed: false,
    authenticated: false,
  };
}

function toGithubProbe(status: GithubStatus | null | undefined): GithubProbe {
  const value =
    status && typeof status === "object" ? status : unavailableGithubStatus();
  return {
    connected: value.connected === true,
    installed: value.installed === true,
    authenticated: value.authenticated === true,
    ...(typeof value.rateLimited === "boolean"
      ? { rateLimited: value.rateLimited }
      : {}),
    ...(typeof value.retryAfterSecs === "number" &&
    Number.isFinite(value.retryAfterSecs)
      ? { retryAfterSecs: value.retryAfterSecs }
      : {}),
  };
}
