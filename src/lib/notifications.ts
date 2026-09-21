import { invoke } from "@tauri-apps/api/core";
import { HARNESS_TITLE, sessionDisplayTitle, type Session } from "./session";
import { IS_LINUX } from "./platform";
import { loadSoundsEnabled, playCue } from "./sounds";
import {
  allowsProjectNotification,
  type NotificationSubject,
} from "./notificationPreferences";
import {
  knownNotificationProject,
  type NotificationProject,
} from "./notificationProjects";

const KEY = "monocode.notifications";

/** Off until the user opts in; enabling asks the OS for permission. */
export const NOTIFICATIONS_DEFAULT = false;

export const NOTIFICATIONS_CHANGE_EVENT = "monocode:notifications-change";

/** Rust emits this with the session id when a notification is clicked. */
export const NOTIFICATION_CLICK_EVENT = "monocode:notification-click";

export type NotificationPermission =
  "prompt" | "granted" | "denied" | "unsupported";

export function loadNotificationsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return NOTIFICATIONS_DEFAULT;
    return raw === "1" || raw === "true";
  } catch {
    return NOTIFICATIONS_DEFAULT;
  }
}

export function saveNotificationsEnabled(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // private mode / quota
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<boolean>(NOTIFICATIONS_CHANGE_EVENT, { detail: value }),
  );
}

let permission: NotificationPermission = "prompt";

/** Last permission the OS reported; refreshed by the probes below. */
export function cachedNotificationPermission(): NotificationPermission {
  return permission;
}

export async function probeNotificationPermission(): Promise<NotificationPermission> {
  try {
    permission = await invoke<NotificationPermission>(
      "notification_permission",
    );
  } catch {
    permission = "unsupported";
  }
  return permission;
}

/** Shows the OS prompt when undecided; otherwise reports the current state. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    permission = await invoke<NotificationPermission>(
      "request_notification_permission",
    );
  } catch {
    permission = "unsupported";
  }
  return permission;
}

export function openNotificationSettings(): Promise<void> {
  return invoke<void>("open_notification_settings");
}

/**
 * Tracked from Tauri's focus event rather than `document.hasFocus()`, which
 * WKWebView keeps reporting true after the window drops to the background.
 */
let windowFocused =
  typeof document !== "undefined" ? document.hasFocus() : true;

export function setWindowFocused(focused: boolean) {
  windowFocused = focused;
}

/**
 * A banner only earns its place while the user is looking elsewhere: another
 * app, or another session. The transcript already shows the change on the
 * session that is on screen.
 */
export function shouldNotify({
  enabled,
  permission,
  windowFocused,
  sessionVisible,
}: {
  enabled: boolean;
  permission: NotificationPermission;
  windowFocused: boolean;
  sessionVisible: boolean;
}): boolean {
  if (!enabled || (windowFocused && sessionVisible)) return false;
  return permission === "granted" || permission === "prompt";
}

export type InputNotificationEvent = {
  kind: "approval" | "question";
  requestId: number;
};
export type NotificationEvent = "finished" | InputNotificationEvent;

type PendingInputNotification = {
  session: Session;
  event: InputNotificationEvent;
};

/** Track each request, including a new request in an already-waiting session. */
export function pendingInputNotifications(
  sessions: Session[],
): Map<string, PendingInputNotification> {
  const pending = new Map<string, PendingInputNotification>();
  for (const session of sessions) {
    if (session.inboxAsk) continue;
    for (const block of session.blocks) {
      if (block.approval && !block.approval.decided) {
        pending.set(
          JSON.stringify([session.id, "approval", block.approval.requestId]),
          {
            session,
            event: { kind: "approval", requestId: block.approval.requestId },
          },
        );
      }
    }
    if (session.pendingQuestion) {
      pending.set(
        JSON.stringify([
          session.id,
          "question",
          session.pendingQuestion.requestId,
        ]),
        {
          session,
          event: {
            kind: "question",
            requestId: session.pendingQuestion.requestId,
          },
        },
      );
    }
  }
  return pending;
}

/** App name, then the session title, then the reply itself. */
export type NotificationText = {
  title: string;
  subtitle: string;
  body: string;
};

const BODY_MAX = 240;

export function notificationText(
  session: Session,
  event: NotificationEvent,
): NotificationText {
  const title = "MonoCode";
  const subtitle = sessionDisplayTitle(session.title, session.harness);
  const harness = HARNESS_TITLE[session.harness];
  if (event !== "finished") {
    if (event.kind === "question") {
      const question =
        session.pendingQuestion?.requestId === event.requestId
          ? session.pendingQuestion
          : undefined;
      const prompt = question?.title || question?.questions[0]?.prompt;
      return {
        title,
        subtitle,
        body: clip(prompt || `${harness} has a question for you`),
      };
    }
    const pending = session.blocks.find(
      (block) =>
        block.approval?.requestId === event.requestId &&
        !block.approval.decided,
    );
    const what = pending?.tool?.title || pending?.text;
    return {
      title,
      subtitle,
      body: clip(what ? `Approve: ${what}` : `${harness} needs your approval`),
    };
  }
  const reply = [...session.blocks]
    .reverse()
    .find((block) => block.role === "assistant" && block.text.trim());
  return {
    title,
    subtitle,
    body: clip(reply?.text || `${harness} finished`),
  };
}

/** First paragraph, whitespace collapsed; macOS wraps and truncates the rest. */
function clip(text: string): string {
  const paragraph =
    text
      .split(/\n\s*\n/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .find((part) => part.length > 0) ?? "";
  return paragraph.length > BODY_MAX
    ? `${paragraph.slice(0, BODY_MAX - 1)}…`
    : paragraph;
}

/**
 * Project + policy subject for a session, or null when it can never
 * notify (inbox-ask threads and non-project paths). Single source for the
 * preamble shared by banners, finish announcements, and their sound
 * fallbacks.
 */
export type SessionNotificationEntry = {
  project: NotificationProject;
  subject: NotificationSubject;
};

export function sessionNotificationSubject(
  session: Session,
  category: NotificationSubject["category"],
  occurredAt = Date.now(),
): SessionNotificationEntry | null {
  if (session.inboxAsk) return null;
  const project = knownNotificationProject(session.cwd);
  if (!project) return null;
  return {
    project,
    subject: { projectId: project.id, category, occurredAt },
  };
}

/**
 * What the Rust `show_notification` command reports. `osSound` tells whether
 * the platform itself played a sound: Linux only sets a sound-name hint the
 * server may ignore, so callers must still play the in-app cue there.
 */
export type ShowNotificationResult = {
  osSound: boolean;
};

type NotifyOutcome = {
  sent: boolean;
  osSound: boolean;
};

function readShowResult(raw: unknown, soundRequested: boolean): ShowNotificationResult {
  if (raw && typeof raw === "object" && "osSound" in raw) {
    return { osSound: Boolean((raw as { osSound: unknown }).osSound) };
  }
  // Backwards compatibility with backends that resolve void: every platform
  // except Linux guarantees its requested sound, so only Linux assumes mute.
  return { osSound: IS_LINUX ? false : soundRequested };
}

/**
 * Sends the banner when policy allows. Resolves true once the OS accepted it.
 * Input requests have no in-app sound of their own: the banner (plus the
 * in-app approval toast) is the signal, so the OS sound hint is left to the
 * server.
 */
export async function notifySession(
  session: Session,
  event: NotificationEvent,
  sessionVisible: boolean,
): Promise<boolean> {
  const entry = sessionNotificationSubject(
    session,
    event === "finished" ? "agentFinished" : "agentInput",
  );
  if (!entry) {
    console.debug(
      "[notifications] skip: no notifiable subject",
      session.id,
      sessionVisible ? "visible" : "hidden",
    );
    return false;
  }
  const outcome = await notifyProjectSession(
    session,
    event,
    sessionVisible,
    entry.subject,
  );
  return outcome.sent;
}

/** One policy decision covers both the OS banner and its in-app sound fallback. */
export async function announceSessionFinished(
  session: Session,
  sessionVisible: boolean,
): Promise<void> {
  const entry = sessionNotificationSubject(session, "agentFinished");
  if (!entry) {
    console.debug(
      "[notifications] skip: no notifiable subject",
      session.id,
      sessionVisible ? "visible" : "hidden",
    );
    return;
  }
  const outcome = await notifyProjectSession(
    session,
    "finished",
    sessionVisible,
    entry.subject,
  );
  // On Linux the banner carries no guaranteed sound, so the in-app cue
  // always stands in when sounds are on — even when the banner showed.
  if (!outcome.sent || !outcome.osSound) playCue("turnFinished", entry.subject);
}

async function notifyProjectSession(
  session: Session,
  event: NotificationEvent,
  sessionVisible: boolean,
  subject: NotificationSubject,
): Promise<NotifyOutcome> {
  if (!allowsProjectNotification(subject)) {
    console.debug(
      "[notifications] skip: project policy blocks",
      session.id,
      subject.projectId,
      subject.category,
    );
    return { sent: false, osSound: false };
  }
  const enabled = loadNotificationsEnabled();
  const decision = shouldNotify({
    enabled,
    permission,
    windowFocused,
    sessionVisible,
  });
  if (!decision) {
    console.debug("[notifications] skip: not eligible", {
      sessionId: session.id,
      projectId: subject.projectId,
      category: subject.category,
      enabled,
      permission,
      windowFocused,
      sessionVisible,
    });
    return { sent: false, osSound: false };
  }
  const { title, subtitle, body } = notificationText(session, event);
  const soundRequested = loadSoundsEnabled();
  try {
    const raw = await invoke<ShowNotificationResult | void>(
      "show_notification",
      {
        sessionId: session.id,
        title,
        subtitle,
        body,
        sound: soundRequested,
      },
    );
    const { osSound } = readShowResult(raw, soundRequested);
    console.debug("[notifications] banner shown", {
      sessionId: session.id,
      category: subject.category,
      soundRequested,
      osSound,
    });
    return { sent: true, osSound };
  } catch (error) {
    // Swallowed by design (the in-app cue stands in), but loud in DevTools:
    // a rejected dispatch is the only signal when the OS side fails.
    console.warn("[notifications] show_notification rejected:", session.id, error);
    return { sent: false, osSound: false };
  }
}
