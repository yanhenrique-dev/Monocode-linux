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
  }): Promise<OpenCodeSession> {
    // VERIFY: permission passthrough shape on V2 (Fase 4 migrates the rules).
    return this.request<OpenCodeSession>("POST", "/session", {
      body: {
        ...(input.title ? { title: input.title } : {}),
        location: { directory: this.directory },
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
    // VERIFY: abort route carried under the prefix.
    await this.request<unknown>("POST", `/session/${enc(sessionID)}/abort`, {
      body: {},
    }).catch(() => undefined);
  }

  async revertSession(sessionID: string, messageID: string): Promise<void> {
    // VERIFY: revert shape carried under the prefix.
    await this.request<unknown>("POST", `/session/${enc(sessionID)}/revert`, {
      body: { messageID },
    });
  }

  async summarizeSession(
    sessionID: string,
    model: OpenCodeModelRef,
  ): Promise<void> {
    // VERIFY: summarize body carried under the prefix.
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
    // Durable admission: the id makes retries safe, resume schedules the run.
    // `delivery` is left to the server default (immediate); steer/queue
    // overrides arrive with the follow-up work.
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/prompt`,
      {
        body: {
          id: crypto.randomUUID(),
          model: input.model,
          ...(input.agent ? { agent: input.agent } : {}),
          ...(input.variant ? { variant: input.variant } : {}),
          parts: input.parts,
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
    // V1 answers inline; V2 admits and runs async, so admit, wait for idle,
    // then read the fresh messages.
    await this.promptAsync(input);
    await this.request<unknown>(
      "POST",
      `/session/${enc(input.sessionID)}/wait`,
      {
        body: {},
        timeoutMs: input.timeoutMs,
      },
    );
    const messages = await this.getMessages(input.sessionID);
    const last = [...messages]
      .reverse()
      .find((message) => (message.parts as unknown[])?.length);
    if (!last) throw new Error("OpenCode V2 returned no message parts");
    return last;
  }

  async replyPermission(
    sessionID: string,
    requestID: string,
    reply: "once" | "always" | "reject",
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/permission/${enc(requestID)}/reply`,
      {
        body: { reply },
      },
    );
  }

  async replyQuestion(
    sessionID: string,
    requestID: string,
    answers: string[][],
  ): Promise<void> {
    // VERIFY: V2 ordered-answers shape against the QuestionV2 route.
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/question/request/${enc(requestID)}/reply`,
      {
        body: { answers },
      },
    );
  }

  async rejectQuestion(
    sessionID: string,
    requestID: string,
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/session/${enc(sessionID)}/question/request/${enc(requestID)}/reject`,
      {
        body: {},
      },
    );
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
