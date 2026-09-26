import {
  closeHarnessSse,
  harnessHttp,
  openHarnessSse,
  watchSse,
} from "./child";
import {
  asRecord,
  buildOpenCodeDenyAllRules,
  buildOpenCodePermissionRules,
} from "./opencodeProtocol";
import type { OpenCodeProtocol } from "./opencodeProtocol";
import { SERVE_PASSWORD } from "./harnessContract";
import {
  buildV2DenyAllRules,
  buildV2FormAnswer,
  buildV2PermissionRules,
  buildV2PromptBody,
  buildV2SessionCreateBody,
  buildV2SessionPatchBody,
  fromV2MessageList,
  normalizeV2Event,
  toV2ModelRef,
  v2LocationQuery,
} from "./opencodeV2";
import { selectedAnswerLabels } from "../userQuestion";
import type { UserQuestion, UserQuestionReply } from "../userQuestion";
import type { RuntimeMode } from "../session";

export class OpenCodeHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = status === 404 ? "NotFoundError" : "OpenCodeHttpError";
    this.status = status;
    this.body = body;
  }
}

export type OpenCodeSession = {
  id: string;
  parentID?: string;
  directory?: string;
  /** V2 reports the owning directory as a Location object. */
  location?: { directory?: string };
  title?: string;
};

export type OpenCodePromptPart =
  | { type: "text"; text: string }
  | { type: "file"; mime: string; filename: string; url: string };

export type OpenCodeMessage = {
  info?: Record<string, unknown>;
  parts?: unknown[];
};

export type OpenCodeModelRef = {
  providerID: string;
  modelID: string;
};

/**
 * Transport contract shared by both protocol generations. Method names and
 * shapes are MonoCode's; each implementation maps them onto its server API.
 */
export interface OpenCodeClient {
  /** Permission rules in the generation's native shape for session create/update. */
  sessionPermissionRules(runtimeMode: RuntimeMode): unknown;
  /** Deny-everything rules in the generation's native shape. */
  denyAllPermissionRules(): unknown;
  getSession(sessionID: string): Promise<OpenCodeSession>;
  getMessages(sessionID: string): Promise<OpenCodeMessage[]>;
  createSession(input: {
    title?: string;
    permission?: unknown;
  }): Promise<OpenCodeSession>;
  updateSession(
    sessionID: string,
    body: Record<string, unknown>,
  ): Promise<OpenCodeSession>;
  forkSession(sessionID: string, directory: string): Promise<OpenCodeSession>;
  deleteSession(sessionID: string): Promise<void>;
  abortSession(sessionID: string): Promise<void>;
  revertSession(sessionID: string, messageID: string): Promise<void>;
  summarizeSession(sessionID: string, model: OpenCodeModelRef): Promise<void>;
  promptAsync(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
  }): Promise<void>;
  prompt(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
    timeoutMs?: number;
  }): Promise<{ info?: Record<string, unknown>; parts?: unknown[] }>;
  replyPermission(
    sessionID: string,
    requestID: string,
    decision: "once" | "always" | "reject",
  ): Promise<void>;
  /**
   * Answer a blocking question. The reply stays structured so each transport
   * can encode it natively: V1 sends positional label rows, V2 a form answer
   * keyed by field.
   */
  replyQuestion(input: {
    sessionID: string;
    requestID: string;
    questions: UserQuestion[];
    reply: UserQuestionReply;
  }): Promise<void>;
  rejectQuestion(sessionID: string, requestID: string): Promise<void>;
  subscribeEvents(
    sessionId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onEnd?: (error?: string) => void,
  ): Promise<void>;
  closeEvents(sessionId: string): Promise<void>;
}

export type OpenCodeClientOptions = {
  /** Per-process `server password` printed by `opencode serve` (V2 requires
   * HTTP Basic auth on every request; V1 servers have no password). */
  password?: string;
};

export function createOpenCodeClient(
  baseUrl: string,
  directory: string,
  protocol: OpenCodeProtocol,
  options?: OpenCodeClientOptions,
): OpenCodeClient {
  return protocol === "v2"
    ? new OpenCodeClientV2(baseUrl, directory, options?.password)
    : new OpenCodeClientV1(baseUrl, directory, options?.password);
}

/** V2's Basic auth user is the fixed literal `opencode`. */
export function openCodeBasicAuth(password: string): string {
  // The scheme and username come from the contract, because both are the
  // server's requirement rather than this client's preference, and getting
  // either wrong is a 401 on every route including the read-only catalog.
  return `${SERVE_PASSWORD.scheme} ${toBase64(`${SERVE_PASSWORD.user}:${password}`)}`;
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

class OpenCodeClientBase {
  /** Route prefix: "" for V1, "/api" for V2. Paths stay concatenated (never
   * `new URL(absolutePath, base)`) so a base carrying a path prefix keeps it.
   * See opencode#46498: the official V2 client drops such prefixes. */
  protected readonly apiPrefix: string = "";

  constructor(
    readonly baseUrl: string,
    readonly directory: string,
    /** V2 serve password, sent as HTTP Basic auth. Absent for V1. */
    readonly password?: string,
  ) {}

  /** Query parameters that scope the request to this session's directory. */
  protected scopeQuery(): Record<string, string> {
    return { directory: this.directory };
  }

  protected async request<T>(
    method: string,
    path: string,
    opts?: {
      body?: unknown;
      query?: Record<string, string>;
      timeoutMs?: number;
    },
  ): Promise<T> {
    const url = this.url(path, opts?.query);
    const hasBody = opts?.body !== undefined;
    const response = await harnessHttp({
      url,
      method,
      headers: this.headers(hasBody),
      body: hasBody ? JSON.stringify(opts?.body ?? {}) : undefined,
      timeoutMs: opts?.timeoutMs,
    });
    if (response.status === 204 || response.body.trim() === "") {
      if (response.status >= 400) {
        throw this.describeHttpError(
          response.status,
          response.body,
          parseJson(response.body),
        );
      }
      return undefined as T;
    }
    const parsed = parseJson(response.body);
    if (response.status >= 400) {
      throw this.describeHttpError(response.status, response.body, parsed);
    }
    return unwrapData<T>(parsed);
  }

  /** Builds per-generation error values; V2 uses `_tag` envelopes. */
  protected describeHttpError(
    status: number,
    raw: string,
    parsed: unknown,
  ): OpenCodeHttpError {
    return new OpenCodeHttpError(
      status,
      parsed,
      httpErrorMessage(status, raw, parsed),
    );
  }

  protected url(path: string, query?: Record<string, string>): string {
    const base = `${this.baseUrl.replace(/\/$/, "")}/`;
    const url = new URL(
      `${this.apiPrefix}${path}`.replace(/^\//, ""),
      base,
    );
    for (const [key, value] of Object.entries({
      ...this.scopeQuery(),
      ...query,
    })) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  protected headers(json = false): Record<string, string> {
    const password = this.password?.trim();
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      // V2 answers 401 on every route without these credentials.
      ...(password ? { Authorization: openCodeBasicAuth(password) } : {}),
      "x-opencode-directory": encodeURIComponent(this.directory),
    };
  }
}

/** V1 transport: routes and envelopes exactly as before. */
export class OpenCodeClientV1 extends OpenCodeClientBase implements OpenCodeClient {
  sessionPermissionRules(runtimeMode: RuntimeMode): unknown {
    return buildOpenCodePermissionRules(runtimeMode);
  }

  denyAllPermissionRules(): unknown {
    return buildOpenCodeDenyAllRules();
  }

  async getSession(sessionID: string): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>("GET", `/session/${enc(sessionID)}`);
  }

  async getMessages(sessionID: string): Promise<OpenCodeMessage[]> {
    return this.request<OpenCodeMessage[]>(
      "GET",
      `/session/${enc(sessionID)}/message`,
    );
  }

  async createSession(input: {
    title?: string;
    permission?: unknown;
  }): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>("POST", "/session", {
      body: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.permission ? { permission: input.permission } : {}),
      },
    });
  }

  async updateSession(
    sessionID: string,
    body: Record<string, unknown>,
  ): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>(
      "PATCH",
      `/session/${enc(sessionID)}`,
      {
        body,
      },
    );
  }

  async forkSession(
    sessionID: string,
    directory: string,
  ): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>(
      "POST",
      `/session/${enc(sessionID)}/fork`,
      {
        query: { directory },
        body: {},
      },
    );
  }

  async deleteSession(sessionID: string): Promise<void> {
    await this.request<unknown>("DELETE", `/session/${enc(sessionID)}`);
  }

  async abortSession(sessionID: string): Promise<void> {
    await this.request<unknown>("POST", `/session/${enc(sessionID)}/abort`, {
      body: {},
    }).catch(() => undefined);
  }

  async revertSession(sessionID: string, messageID: string): Promise<void> {
    await this.request<unknown>("POST", `/session/${enc(sessionID)}/revert`, {
      body: { messageID },
    });
  }

  async summarizeSession(
    sessionID: string,
    model: OpenCodeModelRef,
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/summarize`,
      {
        body: model,
        timeoutMs: 30 * 60_000,
      },
    );
  }

  async promptAsync(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
  }): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/prompt_async`,
      {
        body: {
          model: input.model,
          ...(input.agent ? { agent: input.agent } : {}),
          ...(input.variant ? { variant: input.variant } : {}),
          parts: input.parts,
        },
      },
    );
  }

  async prompt(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
    timeoutMs?: number;
  }): Promise<{ info?: Record<string, unknown>; parts?: unknown[] }> {
    return this.request("POST", `/session/${enc(input.sessionID)}/message`, {
      body: {
        model: input.model,
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.variant ? { variant: input.variant } : {}),
        parts: input.parts,
      },
      timeoutMs: input.timeoutMs,
    });
  }

  async replyPermission(
    _sessionID: string,
    requestID: string,
    reply: "once" | "always" | "reject",
  ): Promise<void> {
    await this.request<unknown>("POST", `/permission/${enc(requestID)}/reply`, {
      body: { reply },
    });
  }

  async replyQuestion(input: {
    sessionID: string;
    requestID: string;
    questions: UserQuestion[];
    reply: UserQuestionReply;
  }): Promise<void> {
    const { questions, reply } = input;
    // V1 replies with one row of selected labels per question, in order.
    const answers =
      reply.kind === "answered"
        ? questions.map((question) => selectedAnswerLabels(question, reply))
        : [];
    await this.request<unknown>(
      "POST",
      `/question/${enc(input.requestID)}/reply`,
      { body: { answers } },
    );
  }

  async rejectQuestion(
    _sessionID: string,
    requestID: string,
  ): Promise<void> {
    await this.request<unknown>("POST", `/question/${enc(requestID)}/reject`, {
      body: {},
    });
  }

  async subscribeEvents(
    sessionId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onEnd?: (error?: string) => void,
  ): Promise<void> {
    const url = this.url("/event");
    watchSse(
      sessionId,
      (data) => {
        const parsed = parseJson(data);
        const rec = asRecord(parsed);
        if (rec) onEvent(rec);
      },
      onEnd,
    );
    await openHarnessSse(sessionId, url, this.headers());
  }

  async closeEvents(sessionId: string): Promise<void> {
    await closeHarnessSse(sessionId).catch(() => undefined);
  }
}

/**
 * V2 transport (`/api/...`). Routes, request bodies, and field names follow the
 * published V2 API contract; `opencodeV2` translates everything the session
 * pipeline consumes back into the V1 vocabulary it was written around.
 */
export class OpenCodeClientV2 extends OpenCodeClientBase implements OpenCodeClient {
  protected override readonly apiPrefix = "/api";

  /** Last model/agent applied per session, so a turn only switches on change. */
  private readonly appliedTarget = new Map<
    string,
    { model: string; variant?: string; agent?: string }
  >();

  sessionPermissionRules(runtimeMode: RuntimeMode): unknown {
    return buildV2PermissionRules(runtimeMode);
  }

  denyAllPermissionRules(): unknown {
    return buildV2DenyAllRules();
  }

  /** V2 scopes by Location object; `directory` survives only on session list. */
  protected override scopeQuery(): Record<string, string> {
    return { location: v2LocationQuery(this.directory) };
  }

  protected override describeHttpError(
    status: number,
    raw: string,
    parsed: unknown,
  ): OpenCodeHttpError {
    const rec = asRecord(parsed);
    const tag = typeof rec?._tag === "string" ? rec._tag : undefined;
    const message =
      (typeof rec?.message === "string" && rec.message.trim()) || raw.trim();
    const suffix = tag ? ` [${tag}]` : "";
    return new OpenCodeHttpError(
      status,
      parsed,
      `${message || `OpenCode HTTP ${status}`}${suffix}`,
    );
  }

  async getSession(sessionID: string): Promise<OpenCodeSession> {
    const session = await this.request<OpenCodeSession>(
      "GET",
      `/session/${enc(sessionID)}`,
    );
    return withV2SessionDirectory(session);
  }

  async getMessages(sessionID: string): Promise<OpenCodeMessage[]> {
    const data = await this.request<unknown>(
      "GET",
      `/session/${enc(sessionID)}/message`,
    );
    return fromV2MessageList(data);
  }

  async createSession(input: {
    title?: string;
    permission?: unknown;
  }): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>("POST", "/session", {
      body: buildV2SessionCreateBody({
        ...input,
        directory: this.directory,
      }),
    });
  }

  async updateSession(
    sessionID: string,
    body: Record<string, unknown>,
  ): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>(
      "PATCH",
      `/session/${enc(sessionID)}`,
      { body: buildV2SessionPatchBody(body) },
    );
  }

  async forkSession(
    sessionID: string,
    directory: string,
  ): Promise<OpenCodeSession> {
    // Omitting `before` copies the full history into a child session.
    return this.request<OpenCodeSession>(
      "POST",
      `/session/${enc(sessionID)}/fork`,
      { body: {}, query: { location: v2LocationQuery(directory) } },
    );
  }

  async deleteSession(sessionID: string): Promise<void> {
    await this.request<unknown>("DELETE", `/session/${enc(sessionID)}`);
    this.appliedTarget.delete(sessionID);
  }

  async abortSession(sessionID: string): Promise<void> {
    // V2 renamed abort to interrupt; it is a no-op on an idle session, and a
    // 404 here means the session is already gone, which is fine while tearing
    // down. `resume` is deliberately omitted: cancelling must stop execution
    // rather than re-enter pending steering.
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/interrupt`,
      { body: {} },
    ).catch(() => undefined);
  }

  async revertSession(sessionID: string, messageID: string): Promise<void> {
    // V2 split revert: stage the boundary, then commit it. `DELETE /revert`
    // only clears an already-staged revert.
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/revert/stage`,
      { body: { messageID } },
    );
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/revert/commit`,
    );
  }

  async summarizeSession(
    sessionID: string,
    model: OpenCodeModelRef,
  ): Promise<void> {
    // V2 renamed summarize to compact, and takes no model: the session model
    // applies, so switch it first to honour the caller's choice.
    await this.applyTarget(sessionID, { model });
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/compact`,
      { body: {}, timeoutMs: 30 * 60_000 },
    );
  }

  async promptAsync(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
  }): Promise<void> {
    await this.promptV2(input);
  }

  async prompt(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
    timeoutMs?: number;
  }): Promise<{ info?: Record<string, unknown>; parts?: unknown[] }> {
    // V1 answers inline; V2 admits the run and returns immediately, so admit,
    // wait for the loop to go idle, then read the fresh messages back. The
    // wait route is the one V2 still serves under `experimental`.
    await this.promptV2(input);
    await this.request<unknown>(
      "POST",
      `/experimental/session/${enc(input.sessionID)}/wait`,
      { timeoutMs: input.timeoutMs },
    );
    const messages = await this.getMessages(input.sessionID);
    const last = [...messages]
      .reverse()
      .find((message) => (message.parts as unknown[])?.length);
    if (!last) throw new Error("OpenCode V2 returned no message parts");
    return last;
  }

  /**
   * V2 carries no model or agent on the prompt body, so both are switched on
   * the session first. The agent goes first so an explicit model still wins
   * over a model the agent would otherwise impose.
   */
  private async promptV2(input: {
    sessionID: string;
    model: OpenCodeModelRef;
    agent?: string;
    variant?: string;
    parts: OpenCodePromptPart[];
  }): Promise<void> {
    await this.applyTarget(input.sessionID, {
      model: input.model,
      variant: input.variant,
      agent: input.agent,
    });
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/prompt`,
      {
        body: buildV2PromptBody({
          parts: input.parts,
          ...(input.agent ? { agent: input.agent } : {}),
          // V1 `prompt_async` injects into a running turn; V2 spells that
          // `steer` and leaves queued prompts parked.
          delivery: "steer",
          resume: true,
          // Durable admission id, so a retried admit is not a second turn.
          id: `msg_${crypto.randomUUID()}`,
        }),
      },
    );
  }

  private async applyTarget(
    sessionID: string,
    target: { model?: OpenCodeModelRef; variant?: string; agent?: string },
  ): Promise<void> {
    const key = target.model
      ? `${target.model.providerID}/${target.model.modelID}#${target.variant ?? ""}`
      : "";
    const previous = this.appliedTarget.get(sessionID);
    if (previous && previous.model === key && previous.agent === target.agent) {
      return;
    }
    const agentChanged = !!target.agent && previous?.agent !== target.agent;
    if (agentChanged) {
      await this.request<unknown>(
        "POST",
        `/session/${enc(sessionID)}/agent`,
        { body: { agent: target.agent } },
      );
    }
    // Switching the agent can impose that agent's own model, so the caller's
    // explicit choice has to be re-applied after the switch. Without this a
    // `build` -> `plan` change would silently run on a different model.
    if (target.model && (agentChanged || previous?.model !== key)) {
      await this.request<unknown>(
        "POST",
        `/session/${enc(sessionID)}/model`,
        { body: { model: toV2ModelRef(target.model, target.variant) } },
      );
    }
    this.appliedTarget.set(sessionID, {
      model: key,
      ...(target.agent ? { agent: target.agent } : {}),
    });
  }

  async replyPermission(
    sessionID: string,
    requestID: string,
    decision: "once" | "always" | "reject",
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/permission/${enc(requestID)}/reply`,
      { body: { decision } },
    );
  }

  async replyQuestion(input: {
    sessionID: string;
    requestID: string;
    questions: UserQuestion[];
    reply: UserQuestionReply;
  }): Promise<void> {
    const body = buildV2FormAnswer(input.reply, input.questions);
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/form/${enc(input.requestID)}/reply`,
      { body: body ?? { answer: {} } },
    );
  }

  async rejectQuestion(
    sessionID: string,
    requestID: string,
  ): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/session/${enc(sessionID)}/form/${enc(requestID)}`,
    );
  }

  async subscribeEvents(
    sessionId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onEnd?: (error?: string) => void,
  ): Promise<void> {
    const url = this.url("/event");
    watchSse(
      sessionId,
      (data, name) => {
        const rec = asRecord(parseJson(data));
        if (!rec) return;
        // V2 frames the discriminator as the SSE event name next to an opaque
        // payload, so the payload's own `type` wins when it carries one.
        const event = normalizeV2Event(rec, name);
        if (event) onEvent(event);
      },
      onEnd,
    );
    await openHarnessSse(sessionId, url, this.headers());
  }

  async closeEvents(sessionId: string): Promise<void> {
    await closeHarnessSse(sessionId).catch(() => undefined);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * V2 reports a session's directory as a `location` object. Surfacing it as
 * `directory` keeps the resume path's "is this session still in the current
 * project" check working; without it a session opened in another directory
 * would be adopted instead of forked.
 */
function withV2SessionDirectory(session: OpenCodeSession): OpenCodeSession {
  const directory = session.location?.directory;
  if (typeof directory !== "string" || !directory) return session;
  return { ...session, directory };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function unwrapData<T>(value: unknown): T {
  const rec = asRecord(value);
  if (rec && "data" in rec && rec.data !== undefined) return rec.data as T;
  return value as T;
}

function httpErrorMessage(
  status: number,
  raw: string,
  parsed: unknown = parseJson(raw),
): string {
  const rec = asRecord(parsed);
  const nested = asRecord(rec?.error) ?? asRecord(rec?.data);
  const message =
    (typeof rec?.message === "string" && rec.message.trim()) ||
    (typeof nested?.message === "string" && nested.message.trim()) ||
    raw.trim();
  return message || `OpenCode HTTP ${status}`;
}
