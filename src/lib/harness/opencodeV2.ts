import type { RuntimeMode } from "../session";
import type { UserQuestion, UserQuestionReply } from "../userQuestion";
import type { OpenCodeMessage, OpenCodeModelRef } from "./opencodeClient";
import {
  asRecord,
  buildOpenCodePermissionRules,
  stringField,
} from "./opencodeProtocol";

/** V2 permission rule: `permission`/`pattern`/`action` renamed for V2. */
type V2PermissionRule = {
  action: string;
  resource: string;
  effect: "allow" | "deny" | "ask";
};

/**
 * V2 transport translation.
 *
 * The V2 server API is an intentional breaking change from V1 (see the
 * migration guide's "Server API and clients" section), and the routes, request
 * bodies, and response shapes here follow the published V2 contract rather
 * than the V1 shapes MonoCode's pipeline grew around. Everything V2 sends or
 * receives is translated here into the V1 vocabulary that `opencode.ts` already
 * consumes, so the session pipeline stays single-generation and the V1
 * transport is untouched.
 */

/** V1 permission action -> V2 action name (V2 renamed three actions). */
const V2_ACTION_BY_V1_ACTION: Record<string, string> = {
  bash: "shell",
  task: "subagent",
  write: "edit",
  patch: "edit",
};

/**
 * V2 action -> V1 action name. Incoming requests are renamed back so titles,
 * tool kinds, and shell-command extraction keep working on the V1 names.
 * `shell` matters most: `permissionTitle` and the shell-command fallback both
 * key on `bash`.
 */
const V1_ACTION_BY_V2_ACTION: Record<string, string> = {
  shell: "bash",
  subagent: "task",
};

/** V2 deny-all, the native shape of `buildOpenCodeDenyAllRules`. */
export function buildV2DenyAllRules(): V2PermissionRule[] {
  return [{ action: "*", resource: "*", effect: "deny" }];
}

function toV2PermissionAction(action: string): string {
  return V2_ACTION_BY_V1_ACTION[action] ?? action;
}

export function toV1PermissionAction(action: string): string {
  return V1_ACTION_BY_V2_ACTION[action] ?? action;
}

/**
 * V2 permission rules for session create/update. Field names are renamed
 * (`permission`->`action`, `pattern`->`resource`, `action`->`effect`) and the
 * renamed tool actions follow. V2 matches the last matching rule and falls back
 * to the agent's base policy for an unknown action, so a stale V1 name would
 * silently fall through to `allow` instead of asking.
 */
export function buildV2PermissionRules(
  runtimeMode: RuntimeMode,
): V2PermissionRule[] {
  return buildOpenCodePermissionRules(runtimeMode).map((rule) => ({
    action: toV2PermissionAction(rule.permission),
    resource: rule.pattern,
    effect: rule.action,
  }));
}

/**
 * V2 scopes a request to a Location object rather than V1's `directory` query
 * parameter. Only `GET /api/session` still takes `directory`; every other
 * documented route takes `location`, so the value is the JSON object.
 */
export function v2LocationQuery(directory: string): string {
  return JSON.stringify({ directory });
}

/**
 * V2 model reference. Note `id`, not V1's `modelID`, and `variant` folded in
 * (V2 joins the two with `#` in config and splits them here).
 */
export function toV2ModelRef(
  model: OpenCodeModelRef,
  variant?: string,
): { id: string; providerID: string; variant?: string } {
  return {
    id: model.modelID,
    providerID: model.providerID,
    ...(variant ? { variant } : {}),
  };
}

type V2PromptPart =
  | { type: "text"; text: string }
  | { type: "file"; mime: string; filename: string; url: string };

/**
 * V2 prompt body. V2 replaced V1's `parts` array with a required `text` string
 * plus typed `files`/`agents`/`skills` arrays, and it takes no model: the model
 * and agent are switched through their own session routes. The route rejects
 * unknown members, so V1's `model`/`agent`/`variant`/`parts` cannot be sent.
 */
export function buildV2PromptBody(input: {
  parts: V2PromptPart[];
  agent?: string;
  /** `steer` injects into a running turn, matching V1 `prompt_async`. */
  delivery?: "steer" | "queue";
  resume?: boolean;
  /** Durable admission id; must satisfy V2's `^msg_` pattern. */
  id?: string;
}): Record<string, unknown> {
  const text: string[] = [];
  const files: Array<{ uri: string; name?: string }> = [];
  for (const part of input.parts) {
    if (part.type === "text") {
      if (part.text) text.push(part.text);
      continue;
    }
    files.push({ uri: part.url, ...(part.filename ? { name: part.filename } : {}) });
  }
  return {
    text: text.join("\n\n"),
    ...(files.length > 0 ? { files } : {}),
    ...(input.agent ? { agents: [{ name: input.agent }] } : {}),
    ...(input.delivery ? { delivery: input.delivery } : {}),
    ...(input.resume !== undefined ? { resume: input.resume } : {}),
    ...(input.id ? { id: input.id } : {}),
  };
}

/** V2 create body: `permissions` is plural and Location is an object. */
export function buildV2SessionCreateBody(input: {
  title?: string;
  permission?: unknown;
  directory: string;
}): Record<string, unknown> {
  return {
    ...(input.title ? { title: input.title } : {}),
    location: { directory: input.directory },
    ...(input.permission ? { permissions: input.permission } : {}),
  };
}

/**
 * Session update body. Callers pass V1's `permission` key; V2 rejects unknown
 * members and spells it `permissions`.
 */
export function buildV2SessionPatchBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "permission") {
      if (value !== undefined) out.permissions = value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * V2 message list. V1 returned `[{ info, parts }]` envelopes; V2 returns a flat
 * array of message objects that carry their own `type` and, for assistant
 * turns, a `content` array instead of `parts`. Rebuild the V1 envelope so the
 * transcript loader, the rewind lookup, and the token meters read unchanged.
 */
export function fromV2MessageList(value: unknown): OpenCodeMessage[] {
  if (!Array.isArray(value)) return [];
  const messages = value.flatMap((item) => {
    const message = fromV2Message(item);
    return message ? [message] : [];
  });
  return messages;
}

function fromV2Message(value: unknown): OpenCodeMessage | null {
  const rec = asRecord(value);
  const id = stringField(rec, "id");
  const type = stringField(rec, "type");
  if (!rec || !id || !type) return null;
  const info = { ...rec };
  // `role` is V1's discriminator; V2 spells the same axis `type`.
  if (type === "user" || type === "assistant") info.role = type;
  if (type === "compaction") {
    // V1 flagged these by agent name so usage meters ignore them; a V2
    // compaction message reports the summarization call's tokens, which would
    // otherwise be read as post-compaction context.
    info.role = "assistant";
    info.agent = "compaction";
  }
  // V2 reports agent, model, and location switches as their own messages, and
  // the server narrates them in its own turn. They carry no content, so
  // without this they render as nothing and the turn looks like it started
  // already on the right agent and model.
  const notice = v2SystemNotice(rec);
  if (notice) {
    // A subagent's own model switch has to reach the row that shows it, and
    // that path already reads `modelID` for V1. Keyed off the presence of a
    // model reference rather than off an event name, because the name that
    // reaches here has changed once already and the row must not depend on it.
    const label = v2ModelLabel(asRecord(rec.model));
    if (label) {
      info.modelID = label;
      info.role = "assistant";
    }
    for (const key of ["content", "text", "files", "agents", "skills", "type"]) {
      delete info[key];
    }
    return { info: { ...info, systemNotice: notice }, parts: [] };
  }
  const parts =
    type === "user" ? v2UserParts(rec, id) : v2AssistantParts(rec, id);
  for (const key of ["content", "text", "files", "agents", "skills", "type"]) {
    delete info[key];
  }
  return { info, parts };
}

/**
 * The human-readable line a V2 message contributes to the turn, or undefined
 * when it is ordinary user or assistant content.
 */
function v2SystemNotice(rec: Record<string, unknown>): string | undefined {
  switch (stringField(rec, "type")) {
    case "agent-switched": {
      const agent = stringField(rec, "agent");
      return agent ? `Switched agent to ${agent}` : undefined;
    }
    case "model-switched": {
      const label = v2ModelLabel(asRecord(rec.model));
      return label ? `Switched model to ${label}` : undefined;
    }
    case "location-switched": {
      const directory = asRecord(rec.location)?.directory;
      return typeof directory === "string" && directory
        ? `Switched to ${directory}`
        : undefined;
    }
    case "system":
    case "synthetic":
      return stringField(rec, "text");
    default:
      return undefined;
  }
}

/** `Model.Ref` is `providerID` plus `id`; the TUI shows the model name alone. */
function v2ModelLabel(model: Record<string, unknown> | null): string | undefined {
  const id = stringField(model, "id");
  if (!id) return undefined;
  // `id` is the model on its own, but a server that echoes the catalog's
  // `provider/model` slug would otherwise print the provider twice.
  const name = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id;
  const variant = stringField(model, "variant");
  return variant ? `${name} ${variant}` : name;
}

function v2UserParts(
  rec: Record<string, unknown>,
  messageID: string,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  const text = stringField(rec, "text");
  if (text) {
    parts.push({ id: `${messageID}-text`, type: "text", text, messageID });
  }
  const files = Array.isArray(rec.files) ? rec.files : [];
  files.forEach((item, index) => {
    const file = asRecord(item);
    if (!file) return;
    const mime = stringField(file, "mime") ?? "";
    const name = stringField(file, "name") ?? "";
    // `repairUnsupportedFileTurn` matches a rejected attachment on the file
    // part's mime, so keep it even when the source has no name.
    parts.push({
      id: `${messageID}-file-${index}`,
      type: "file",
      messageID,
      mime,
      filename: name,
      url: v2FileUri(file),
    });
  });
  return parts;
}

function v2FileUri(file: Record<string, unknown>): string {
  const source = asRecord(file.source);
  return (
    stringField(source, "uri") ??
    stringField(file, "uri") ??
    stringField(source, "path") ??
    ""
  );
}

function v2AssistantParts(
  rec: Record<string, unknown>,
  messageID: string,
): Array<Record<string, unknown>> {
  const content = Array.isArray(rec.content) ? rec.content : [];
  const created = asRecord(rec.time)?.created;
  const parts: Array<Record<string, unknown>> = [];
  content.forEach((item, index) => {
    const part = asRecord(item);
    const type = stringField(part, "type");
    if (!part || !type) return;
    if (type === "tool") {
      const id = stringField(part, "id") ?? `${messageID}-tool-${index}`;
      parts.push({
        id,
        type: "tool",
        messageID,
        // V2 renamed the tool part's `tool` to `name`.
        tool: stringField(part, "name") ?? "tool",
        callID: id,
        time: v2PartTime(part),
        state: v2ToolState(part.state),
      });
      return;
    }
    if (type !== "text" && type !== "reasoning") return;
    parts.push({
      // V2 text/reasoning content items carry no id; the pipeline keys part
      // state by it, so derive a stable one from the message and position.
      id: `${messageID}-${type}-${index}`,
      type,
      messageID,
      text: typeof part.text === "string" ? part.text : undefined,
      time: v2PartTime(part) ?? (typeof created === "number" ? { start: created } : undefined),
    });
  });
  return parts;
}

/** V1 part times are `{ start, end }`; V2 reports `{ created, ran, completed }`. */
function v2PartTime(part: Record<string, unknown>): unknown {
  const time = asRecord(part.time);
  if (!time) return undefined;
  const start = time.created;
  const end = time.completed;
  return {
    ...(typeof start === "number" ? { start } : {}),
    ...(typeof end === "number" ? { end } : {}),
  };
}

/**
 * V2 tool state: a `content` array of text/file items where V1 had a single
 * `output` string, and a structured `error` object where V1 had a loose value.
 */
function v2ToolState(value: unknown): Record<string, unknown> | undefined {
  const state = asRecord(value);
  if (!state) return undefined;
  const status = stringField(state, "status");
  const metadata = asRecord(state.metadata);
  const input = state.input;
  const base = {
    ...(input !== undefined ? { input } : {}),
    ...(metadata ? { metadata } : {}),
  };
  if (status === "completed" || status === "error") {
    return {
      ...base,
      status,
      ...(typeof state.output === "string" ? { output: state.output } : {}),
      ...(status === "completed" && !state.output
        ? { output: v2ToolContentText(state.content) }
        : {}),
      ...(status === "error" ? { error: v2ToolError(state.error) } : {}),
    };
  }
  // V1 had no streaming state; treat it as running so the row stays live.
  return { ...base, status: status === "streaming" ? "running" : status };
}

function v2ToolContentText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((item) => {
      const rec = asRecord(item);
      const type = stringField(rec, "type");
      if (type === "text") return [stringField(rec, "text") ?? ""];
      if (type === "file") {
        return [`${stringField(rec, "name") ?? "file"} (${stringField(rec, "uri") ?? ""})`];
      }
      return [];
    })
    .filter(Boolean)
    .join("\n");
}

function v2ToolError(value: unknown): string {
  const rec = asRecord(value);
  return (
    stringField(rec, "message") ??
    (typeof value === "string" ? value : "Tool failed")
  );
}

/**
 * Stable id for a streamed block.
 *
 * V2 names a text or reasoning block by position -- `(assistantMessageID,
 * ordinal)` -- and a tool by its call id, where V1 carried a `partID` for both.
 * The synthesised id is what the pipeline keys per-block state on, so it has to
 * be the same for a block's `started`, `delta` and `ended`; hence one function
 * and one fallback rather than a per-branch literal.
 */
function v2PartId(data: Record<string, unknown>, kind: string): string {
  const messageID = stringField(data, "assistantMessageID");
  const ordinal = data.ordinal;
  if (messageID != null && typeof ordinal === "number") {
    return `${messageID}:${ordinal}`;
  }
  const id = stringField(data, "id");
  // The fallback is the block kind, never something branch-specific: a delta
  // and the `ended` that closes it have to land on the same id.
  return `${messageID ?? "part"}:${id ?? kind}`;
}

/**
 * The `content` array of a V2 message, as V1 parts.
 *
 * The array is ordered and each item is a tagged union, so the index is the
 * ordinal a streamed block would have used. That is what keeps a text block
 * here and the same block arriving later as `session.text.ended` on one id,
 * instead of the two rendering as separate blocks.
 */
function v2ContentToParts(
  messageID: string,
  value: unknown,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const parts: Array<Record<string, unknown>> = [];
  value.forEach((item, index) => {
    const rec = asRecord(item);
    if (!rec) return;
    const type = stringField(rec, "type");
    if (type === "text" || type === "reasoning") {
      parts.push({
        id: `${messageID}:${index}`,
        type,
        messageID,
        text: stringField(rec, "text") ?? "",
      });
      return;
    }
    if (type === "tool") {
      const callID = stringField(rec, "id");
      parts.push({
        id: `${messageID}:${callID ?? index}`,
        type: "tool",
        messageID,
        tool: stringField(rec, "name"),
        callID,
        state: asRecord(rec.state) ?? { status: "pending" },
      });
    }
  });
  return parts;
}

/** A tool's argument stream arrives as serialised JSON; recover the object. */
function v2JsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    // A provider may send a partial or non-JSON argument stream. The structured
    // arguments arrive on `called`, so losing this costs a preview and nothing
    // else -- which is why a parse failure is not worth surfacing.
    return null;
  }
}

/**
 * A streamed block, as the `message.part.*` events V1 used. `*.delta` is
 * ephemeral and live-only; `*.ended` and the tool terminals are durable and
 * replay on resume, so a resumed turn is rebuilt from those alone.
 */
function v2PartEvent(
  type: string,
  data: Record<string, unknown>,
): { type: string; properties: Record<string, unknown> } | "drop" | null {
  const messageID = stringField(data, "assistantMessageID");

  // V2 splits a tool's argument stream from its result. `input.*` is the live
  // serialisation of the arguments, and `called` carries them parsed, so this
  // stream must never reach the text channel: it printed the arguments as raw
  // JSON in the middle of the assistant's prose.
  if (type.startsWith("session.tool.input.")) {
    if (!type.endsWith(".ended")) return "drop";
    const input = v2JsonObject(data.text);
    if (!input) return "drop";
    return {
      type: "message.part.updated",
      properties: {
        part: {
          id: v2PartId(data, "tool"),
          type: "tool",
          messageID,
          tool: stringField(data, "name"),
          callID: stringField(data, "id"),
          state: { status: "running", input },
        },
      },
    };
  }

  const kind = type.startsWith("session.reasoning.")
    ? "reasoning"
    : type.startsWith("session.text.")
      ? "text"
      : type.startsWith("session.tool.")
        ? "tool"
        : null;
  if (!kind) return null;

  if (type.endsWith(".started")) {
    if (kind === "tool") {
      // A tool has no body to show until `called` arrives with its arguments.
      return "drop";
    }
    // Register the block so its deltas have somewhere to land. A delta is
    // discarded unless its part is already known, so dropping this turned every
    // V2 text block into a single pop-in at the end instead of a stream.
    return {
      type: "message.part.updated",
      properties: { part: { id: v2PartId(data, kind), type: kind, messageID, text: "" } },
    };
  }

  if (type.endsWith(".delta")) {
    return {
      type: "message.part.delta",
      properties: {
        partID: v2PartId(data, kind),
        delta: typeof data.delta === "string" ? data.delta : "",
        ...(messageID ? { messageID } : {}),
      },
    };
  }

  if (type.endsWith(".ended")) {
    return {
      type: "message.part.updated",
      properties: {
        part: {
          id: v2PartId(data, kind),
          type: kind,
          messageID,
          text: typeof data.text === "string" ? data.text : undefined,
        },
      },
    };
  }

  // Tool terminals. V2 splits input from result, so a running tool arrives on
  // `called` and its outcome on `success` or `failed`, each carrying the state
  // the pipeline reads.
  const status =
    type === "session.tool.failed"
      ? "error"
      : type === "session.tool.progress"
        ? "running"
        : type === "session.tool.success"
          ? "completed"
          : "running";
  const part: Record<string, unknown> = {
    id: v2PartId(data, "tool"),
    type: "tool",
    messageID,
    tool: stringField(data, "name"),
    callID: stringField(data, "id"),
    state: {
      status,
      ...(data.input !== undefined ? { input: data.input } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      ...(status === "completed" ? { output: v2ToolContentText(data.content) } : {}),
      ...(status === "error" ? { error: v2ToolError(data.error) } : {}),
    },
  };
  return { type: "message.part.updated", properties: { part } };
}
/**
 * Server narration V2 reports as its own events rather than as content.
 *
 * `extra` rides on the synthesised message info alongside the notice. It exists
 * for one case: a subagent's own model switch has to reach the row that displays
 * it, and that path reads `modelID` off an assistant message. `role` is what
 * admits the event there. The main session path checks `systemNotice` and stops
 * before `role` is read, so a notice can never stream as assistant prose.
 */
function v2NoticeEvent(
  type: string,
  data: Record<string, unknown>,
): { notice: string; extra?: Record<string, unknown> } | undefined {
  if (type === "session.agent.selected") {
    const agent = stringField(data, "agent");
    return agent ? { notice: `Switched agent to ${agent}` } : undefined;
  }
  if (type === "session.model.selected") {
    const label = v2ModelLabel(asRecord(data.model));
    return label
      ? { notice: `Switched model to ${label}`, extra: { role: "assistant", modelID: label } }
      : undefined;
  }
  if (type === "session.synthetic") {
    const text = stringField(data, "text");
    return text ? { notice: text } : undefined;
  }
  if (type === "session.retry.scheduled") {
    const message = stringField(asRecord(data.retry), "message");
    return message ? { notice: message } : undefined;
  }
  if (type === "session.skill.activated") {
    const skill = stringField(data, "skill");
    return skill ? { notice: `Using skill ${skill}` } : undefined;
  }
  return undefined;
}

/**
 * V2 event -> V1 event, or null to drop it.
 *
 * V2's catalog is `session.*`, and the payload sits under `data` rather than
 * V1's `properties`; both are read from the published V2 schema rather than
 * inferred. Each event is translated into the V1 name and shape the session
 * pipeline already routes on, so the pipeline stays single-generation.
 *
 * V2 also splits a streamed block across `*.started` / `*.delta` / `*.ended`
 * and identifies a block by `(assistantMessageID, ordinal)`, where V1 carried
 * a `partID`. The synthesis below is what gives the pipeline a stable id to key
 * its per-block state on.
 *
 * The SSE frame name is a fallback: the payload carries `type` too, and the
 * payload wins when both are present.
 */
export function normalizeV2Event(
  event: Record<string, unknown>,
  frameType?: string,
): Record<string, unknown> | null {
  const own = stringField(event, "type");
  const type = own ?? frameType;
  if (!type) return null;
  // V2 frames the payload under `data`. Anything already shaped like a V1
  // event is passed through so a server that speaks both is not mangled.
  const data = asRecord(event.data) ?? {};
  const properties = asRecord(event.properties) ?? data;

  // V2 replaced the question routes with Forms, so a pending form is what a V1
  // question ask means. Detected by the Form.Info shape, since the event that
  // carries one is not named in the schema.
  const form = v2FormFromProperties(event, properties);
  if (form) {
    return {
      ...event,
      type: "question.asked",
      properties: {
        ...properties,
        id: stringField(form, "id"),
        questions: v2FormToQuestions(form),
      },
    };
  }

  const part = v2PartEvent(type, properties);
  // A `*.started` event opens a block but carries nothing to render. Dropping
  // it is deliberate rather than a fall-through, so it does not reach the
  // pipeline's ignore-and-log path on every block of every turn.
  if (part === "drop") return null;
  if (part) return { ...event, type: part.type, properties: { ...properties, ...part.properties } };

  const notice = v2NoticeEvent(type, properties);
  if (notice) {
    return {
      ...event,
      type: "message.updated",
      properties: { ...properties, info: { systemNotice: notice.notice, ...notice.extra } },
    };
  }

  switch (type) {
    case "session.message.content.updated": {
      // The payload is `{ sessionID, messageID, content }`. There is no `info`
      // object: reading one dropped this event, and with it the only statement
      // of which message the content belongs to. The role is implied -- the
      // schema types the content as assistant content.
      const messageID = stringField(properties, "messageID");
      if (!messageID) return null;
      return {
        ...event,
        type: "message.updated",
        properties: {
          ...properties,
          info: { ...(asRecord(properties.info) ?? {}), id: messageID, role: "assistant" },
          parts: v2ContentToParts(messageID, properties.content),
        },
      };
    }
    case "session.execution.succeeded":
    case "session.execution.interrupted":
      // The turn is over. V1 signalled this with `session.idle`.
      return { ...event, type: "session.idle", properties };
    case "session.execution.failed":
      return {
        ...event,
        type: "session.error",
        properties: { ...properties, error: properties.error },
      };
    case "session.usage.updated":
    case "session.usage.recorded":
      // Usage rides on the message in V1. Forwarded as a message-shaped event
      // so the context and token meters keep reading it where they already do.
      return {
        ...event,
        type: "message.updated",
        properties: {
          ...properties,
          info: {
            id: stringField(properties, "assistantMessageID") ?? "",
            role: "assistant",
            tokens: properties.tokens,
          },
        },
      };
    case "permission.asked": {
      // V2 renamed the request's `permission` to `action` and `patterns` to the
      // `resources` array.
      const action = stringField(properties, "action");
      const resources = Array.isArray(properties.resources)
        ? properties.resources.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined;
      return {
        ...event,
        type,
        properties: {
          ...properties,
          ...(action ? { permission: toV1PermissionAction(action) } : {}),
          ...(resources ? { patterns: resources } : {}),
        },
      };
    }
    case "question.asked":
      // V2 has no question route to reply on, so a bare V1-shaped ask is
      // dropped rather than routed at a form endpoint it does not belong to.
      return null;
    default:
      return { ...event, type, properties };
  }
}

/** Locates a pending Form.Info anywhere in an event's envelope. */
function v2FormFromProperties(
  event: Record<string, unknown>,
  properties: Record<string, unknown>,
): Record<string, unknown> | null {
  const candidates = [
    asRecord(properties.form),
    asRecord(properties.request),
    properties,
    asRecord(event.data),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!Array.isArray(candidate.fields)) continue;
    // Form ids are `frm_`-prefixed; requiring it keeps a session payload that
    // merely carries a `fields` array from being read as a form.
    if (!stringField(candidate, "id")?.startsWith("frm_")) continue;
    return candidate;
  }
  return null;
}

/**
 * V2 Form -> the shared question model. V2 replaced the question routes with
 * Forms, whose fields map one-to-one onto the question UI: a `key` is the
 * answer key, `multiselect` is a multi-select, and `custom` allows free text.
 * `external` fields render elsewhere in the server, so they are skipped.
 */
export function v2FormToQuestions(
  form: Record<string, unknown>,
): UserQuestion[] {
  const fields = Array.isArray(form.fields) ? form.fields : [];
  const usedIds = new Set<string>();
  return fields.flatMap((item) => {
    const field = asRecord(item);
    const type = stringField(field, "type");
    const key = stringField(field, "key");
    if (!field || !key || !type || type === "external") return [];
    if (field.hidden === true) return [];
    // The question id doubles as the form answer key, so it has to be the
    // field's own key. A repeated key cannot be answered unambiguously
    // against a `{ [key]: value }` map, so the later field is dropped rather
    // than renamed to something the server does not recognise.
    if (usedIds.has(key)) return [];
    usedIds.add(key);
    const title = stringField(field, "title") ?? key;
    const description = stringField(field, "description");
    const options = v2FormOptions(field.options);
    const multiSelect = type === "multiselect";
    // Only a multiselect carries a choice list; a plain field is free text.
    const allowCustom =
      field.custom === true || (multiSelect ? options.length === 0 : true);
    const question: UserQuestion = {
      id: key,
      header: title,
      prompt: description ? `${title}\n${description}` : title,
      multiSelect,
      allowCustom,
      options,
    };
    return [question];
  });
}

function v2FormOptions(value: unknown): UserQuestion["options"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const option = asRecord(item);
    const label = stringField(option, "label");
    const optionValue = stringField(option, "value") ?? label;
    if (!option || !label || !optionValue) return [];
    const description = stringField(option, "description");
    return [
      {
        id: optionValue,
        label,
        ...(description ? { description } : {}),
      },
    ];
  });
}

/**
 * Question reply -> a V2 form answer. V1 sent positional `string[][]`; V2 sends
 * `{ answer: { [key]: value } }` where a multi-select is a string array and
 * everything else a single value.
 *
 * The reply is read through `questions` rather than its raw maps because the
 * answer key has to be the form's own field key: free text arrives in
 * `reply.custom` (every non-multiselect field is free text), and a
 * multiselect's selected ids are worth sending only when the field declares
 * them. Unanswered fields are omitted so the server applies its own `required`
 * handling.
 */
export function buildV2FormAnswer(
  reply: UserQuestionReply,
  questions: UserQuestion[],
): { answer: Record<string, unknown> } | null {
  if (reply.kind !== "answered") return null;
  const answer: Record<string, unknown> = {};
  for (const question of questions) {
    const key = question.id;
    const custom = reply.custom?.[key]?.trim();
    if (custom) {
      answer[key] = custom;
      continue;
    }
    const selected = reply.answers[key] ?? [];
    if (selected.length === 0) continue;
    if (question.multiSelect) {
      // Only ids the field actually offers; an "other" placeholder carries the
      // text through `custom` above.
      const allowed = new Set(question.options.map((option) => option.id));
      const values = selected.filter((id) => allowed.has(id));
      if (values.length > 0) answer[key] = values;
      continue;
    }
    answer[key] = selected[0] ?? "";
  }
  return Object.keys(answer).length > 0 ? { answer } : null;
}
