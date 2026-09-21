import {
  closeHarnessSse,
  harnessHttp,
  openHarnessSse,
  watchSse,
} from "./child";
import {
  asRecord,
  buildOpenCodePermissionRules,
  buildOpenCodePermissionRulesV2,
  stringField,
} from "./opencodeProtocol";
import type { OpenCodeProtocol } from "./opencodeProtocol";
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
    reply: "once" | "always" | "reject",
  ): Promise<void>;
  replyQuestion(
    sessionID: string,
    requestID: string,
    answers: string[][],
  ): Promise<void>;
  rejectQuestion(sessionID: string, requestID: string): Promise<void>;
  /**
   * V2-only: the prompt route carries no model/agent (they live on the
   * session). V1 carries both per prompt, so it leaves these unimplemented
   * and callers must use optional chaining.
   */
  setModel?(
    sessionID: string,
    model: OpenCodeModelRef,
    variant?: string,
  ): Promise<void>;
  setAgent?(sessionID: string, agent: string): Promise<void>;
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

class OpenCodeClientBase {
  /** Route prefix: "" for V1, "/api" for V2. Paths stay concatenated (never
   * `new URL(absolutePath, base)`) so a base carrying a path prefix keeps it.
   * See opencode#46498: the official V2 client drops such prefixes. */
  protected readonly apiPrefix: string = "";

  constructor(
    readonly baseUrl: string,
    readonly directory: string,
    readonly password?: string,
  ) {}

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
    url.searchParams.set("directory", this.directory);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  protected headers(json = false): Record<string, string> {
    const password = this.password?.trim();
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      "x-opencode-directory": encodeURIComponent(this.directory),
      ...(password ? { Authorization: openCodeBasicAuth(password) } : {}),
    };
  }
}

export function openCodeBasicAuth(password: string): string {
  return `Basic ${toBase64(`opencode:${password}`)}`;
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const globalScope = globalThis as Record<string, unknown>;
  const btoaFn = globalScope.btoa;
  if (typeof btoaFn === "function") {
    return (btoaFn as (input: string) => string)(binary);
  }
  const bufferCtor = globalScope.Buffer as
    | { from(input: string, encoding: string): { toString(encoding: string): string } }
    | undefined;
  if (bufferCtor) return bufferCtor.from(value, "utf8").toString("base64");
  throw new Error("No base64 encoder available for OpenCode auth");
}

/** V1 transport: routes and envelopes exactly as before. */
export class OpenCodeClientV1 extends OpenCodeClientBase implements OpenCodeClient {
  sessionPermissionRules(runtimeMode: RuntimeMode): unknown {
    return buildOpenCodePermissionRules(runtimeMode);
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

  async replyQuestion(
    _sessionID: string,
    requestID: string,
    answers: string[][],
  ): Promise<void> {
    await this.request<unknown>("POST", `/question/${enc(requestID)}/reply`, {
      body: { answers },
    });
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
 * V2 transport (`/api/...`). Shapes follow the generated V2 API reference;
 * every route marked VERIFY was confirmed in docs but still needs a live
 * round-trip against a V2 `serve` before release.
 */
export class OpenCodeClientV2 extends OpenCodeClientBase implements OpenCodeClient {
  protected override readonly apiPrefix = "/api";

  sessionPermissionRules(runtimeMode: RuntimeMode): unknown {
    return buildOpenCodePermissionRulesV2(runtimeMode);
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
    model?: OpenCodeModelRef;
    agent?: string;
  }): Promise<OpenCodeSession> {
    // V2 names the ruleset `permissions` (not `permission`) and accepts the
    // session model/agent up front. Shapes match the live /openapi.json.
    return this.request<OpenCodeSession>("POST", "/session", {
      body: {
        ...(input.title ? { title: input.title } : {}),
        location: { directory: this.directory },
        ...(input.permission ? { permissions: input.permission } : {}),
        ...(input.model ? { model: toModelRef(input.model) } : {}),
        ...(input.agent ? { agent: input.agent } : {}),
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
    // VERIFY: V2 fork documents a `boundary`; whole-session fork without one
    // must be confirmed live (falls back to the boundary form in Fase 2 work).
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
    // VERIFY: symmetric with V1 (`DELETE /session/:id` exists there).
    await this.request<unknown>("DELETE", `/session/${enc(sessionID)}`);
  }

  async abortSession(sessionID: string): Promise<void> {
    // V2 has no /abort route; cancellation is POST .../interrupt.
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/interrupt`,
      {
        body: {},
      },
    ).catch(() => undefined);
  }

  async revertSession(sessionID: string, messageID: string): Promise<void> {
    // V2 only exposes DELETE .../revert (session.revert.clear) with no
    // per-message target, so rewinding to a message cannot be mapped.
    // Throw loudly instead of 404ing so the UI explains the limitation.
    void sessionID;
    void messageID;
    throw new Error("Rewinding a turn is not supported on OpenCode V2 yet.");
  }

  async summarizeSession(
    sessionID: string,
    model: OpenCodeModelRef,
  ): Promise<void> {
    // V2 compaction is POST .../compact and takes no model: the session
    // keeps whatever model was set via POST .../model.
    void model;
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/compact`,
      {
        body: {},
        timeoutMs: 30 * 60_000,
      },
    );
  }

  async setModel(
    sessionID: string,
    model: OpenCodeModelRef,
    variant?: string,
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/model`,
      {
        body: { model: toModelRef(model, variant) },
      },
    );
  }

  async setAgent(sessionID: string, agent: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/agent`,
      {
        body: { agent },
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
    // V2 admits {id, text, files, ...}: the message id must match ^msg_,
    // the text is a plain string (required), and there is no per-prompt
    // model/agent/variant — those live on the session (see setModel/setAgent,
    // called per turn by the harness). Verified against /openapi.json.
    void input.model;
    void input.agent;
    void input.variant;
    const { text, files } = toPromptInput(input.parts);
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/prompt`,
      {
        body: {
          id: newPromptMessageId(),
          text,
          ...(files.length > 0 ? { files } : {}),
          resume: true,
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
    // V1 answers inline; V2 admits and runs async, so admit, wait for idle
    // on the experimental wait route, then read the fresh messages.
    await this.promptAsync(input);
    await this.request<unknown>(
      "POST",
      `/experimental/session/${enc(input.sessionID)}/wait`,
      {
        body: {},
        timeoutMs: input.timeoutMs,
      },
    );
    const messages = await this.getMessages(input.sessionID);
    // V2 messages are flat (no V1 {info, parts} envelope): synthesize the
    // shape the text pipeline expects from the latest assistant message.
    const last = [...messages].reverse().find(isAssistantMessage);
    if (!last) throw new Error("OpenCode V2 returned no assistant message");
    return {
      info: { id: messageId(last), error: messageError(last) },
      parts: assistantTextParts(last),
    };
  }

  async replyPermission(
    sessionID: string,
    requestID: string,
    reply: "once" | "always" | "reject",
  ): Promise<void> {
    // V2 names the field `decision`; the values match Permission.Reply.
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/permission/${enc(requestID)}/reply`,
      {
        body: { decision: reply },
      },
    );
  }

  async replyQuestion(
    sessionID: string,
    requestID: string,
    answers: string[][],
  ): Promise<void> {
    // V2 replaced questions with forms (POST .../form/{formID}/reply with a
    // Form.Answer body) and its event shapes are still unverified live.
    // Throw loudly instead of 404ing so the UI explains the limitation.
    void sessionID;
    void requestID;
    void answers;
    throw new Error("Answering questions is not supported on OpenCode V2 yet.");
  }

  async rejectQuestion(
    sessionID: string,
    requestID: string,
  ): Promise<void> {
    void sessionID;
    void requestID;
    throw new Error("Answering questions is not supported on OpenCode V2 yet.");
  }

  async subscribeEvents(
    sessionId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onEnd?: (error?: string) => void,
  ): Promise<void> {
    // Transport only; V2Event name mapping lands in Fase 2.
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

function enc(value: string): string {
  return encodeURIComponent(value);
}

/** V2 Model.Ref names the model `id` (not `modelID`). */
export function toModelRef(
  model: OpenCodeModelRef,
  variant?: string,
): { id: string; providerID: string; variant?: string } {
  return {
    id: model.modelID,
    providerID: model.providerID,
    ...(variant ? { variant } : {}),
  };
}

/** V2 prompt ids must match ^msg_ (see /openapi.json). */
export function newPromptMessageId(): string {
  return `msg_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Split harness parts into the V2 prompt input: plain text plus file refs. */
export function toPromptInput(parts: OpenCodePromptPart[]): {
  text: string;
  files: Array<{ uri: string; name: string }>;
} {
  const text = parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("\n\n");
  const files = parts
    .filter((part) => part.type === "file")
    .map((part) => part as { url: string; filename: string })
    .filter((part) => typeof part.url === "string" && part.url.length > 0)
    .map((part) => ({ uri: part.url, name: part.filename ?? "file" }));
  return { text, files };
}

/**
 * Message readers tolerant to both generations: V1 nests everything under
 * `info`/`parts`, V2 messages are flat ({id, type, time, text/content}).
 */
export function messageId(message: OpenCodeMessage): string | undefined {
  const info = asRecord(message.info);
  const direct = (message as Record<string, unknown>).id;
  const id = stringField(info, "id") ?? (typeof direct === "string" ? direct : undefined);
  return id?.trim() ? id : undefined;
}

export function messageRole(message: OpenCodeMessage): string | undefined {
  const info = asRecord(message.info);
  const direct = (message as Record<string, unknown>).type;
  return (
    stringField(info, "role") ?? (typeof direct === "string" ? direct : undefined)
  );
}

export function messageCreated(message: OpenCodeMessage): number | undefined {
  const infoTime = asRecord(asRecord(message.info)?.time);
  const flatTime = asRecord((message as Record<string, unknown>).time);
  for (const rec of [infoTime, flatTime]) {
    const created = rec?.created;
    if (typeof created === "number" && Number.isFinite(created)) return created;
  }
  return undefined;
}

export function messageError(message: OpenCodeMessage): unknown {
  const info = asRecord(message.info);
  return info?.error ?? (message as Record<string, unknown>).error;
}

export function isAssistantMessage(message: OpenCodeMessage): boolean {
  return messageRole(message) === "assistant";
}

/** Assistant text content as V1-ish text parts for the shared pipelines. */
export function assistantTextParts(message: OpenCodeMessage): unknown[] {
  if (Array.isArray(message.parts)) {
    return message.parts.filter(
      (part) => asRecord(part)?.type === "text",
    );
  }
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) return [];
  const out: unknown[] = [];
  for (const item of content) {
    const rec = asRecord(item);
    if (!rec || typeof rec.text !== "string") continue;
    if (rec.type === "text") out.push({ type: "text", text: rec.text });
    else if (rec.type === "reasoning") {
      out.push({ type: "reasoning", text: rec.text });
    }
  }
  return out;
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
