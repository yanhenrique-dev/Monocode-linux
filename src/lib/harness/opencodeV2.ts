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
  const parts =
    type === "user" ? v2UserParts(rec, id) : v2AssistantParts(rec, id);
  for (const key of ["content", "text", "files", "agents", "skills", "type"]) {
    delete info[key];
  }
  return { info, parts };
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
 * V2 event -> V1 event, or null to drop it.
 *
 * V2 frames the discriminator as an SSE `event:` name alongside an opaque
 * `V2EventEncoded` payload, so `type` may arrive on either; the client passes
 * the frame name as `frameType` and this prefers the payload's own field.
 *
 * V2's event catalog is still beta and not enumerated in the published
 * contract, so unknown types pass through untouched: `opencode.ts` ignores
 * what it does not know, and a future rename is a logging change rather than a
 * rewrite. Only the renames the contract does pin down are applied here.
 */
export function normalizeV2Event(
  event: Record<string, unknown>,
  frameType?: string,
): Record<string, unknown> | null {
  const own = stringField(event, "type");
  const type = own ?? frameType;
  if (!type) return null;
  const properties = asRecord(event.properties) ?? {};

  // V2 replaced the question routes with Forms, so a pending form is what a V1
  // question ask means. The event name for it is not part of the published
  // contract, so detect it by the Form.Info shape instead of by name.
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

  if (type === "message.updated") {
    // V2 puts the role in `type` and the turn body in `content`; the pipeline
    // reads V1's `role` and `parts`. Applied by shape so it holds whatever the
    // event ends up being called.
    const info = asRecord(properties.info);
    const message = info ? fromV2Message(info) : null;
    if (message) {
      return {
        ...event,
        type,
        properties: { ...properties, info: message.info, parts: message.parts },
      };
    }
  }

  if (type === "permission.asked") {
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
  if (type === "question.asked") {
    // V2 has no question route to reply on, so a bare V1-shaped ask is dropped
    // rather than routed at a form endpoint it does not belong to.
    return null;
  }
  return { ...event, type, properties };
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
