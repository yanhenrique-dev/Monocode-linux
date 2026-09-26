import { describe, expect, it } from "vitest";
import {
  buildV2DenyAllRules,
  buildV2FormAnswer,
  buildV2PermissionRules,
  buildV2PromptBody,
  buildV2SessionCreateBody,
  buildV2SessionPatchBody,
  fromV2MessageList,
  normalizeV2Event,
  toV1PermissionAction,
  toV2ModelRef,
  v2FormToQuestions,
  v2LocationQuery,
} from "./opencodeV2";

describe("permission rules", () => {
  it("renames the fields V2 expects", () => {
    expect(buildV2PermissionRules("full-access")).toEqual([
      { action: "*", resource: "*", effect: "allow" },
    ]);
    expect(buildV2PermissionRules("supervised")).toEqual([
      { action: "*", resource: "*", effect: "ask" },
      { action: "question", resource: "*", effect: "allow" },
    ]);
  });

  it("renames the actions V2 changed, so a rule still matches", () => {
    // V2 renamed bash->shell and task->subagent. An unmatched action falls
    // through to the base `*` allow policy instead of asking, so a stale name
    // would silently widen access.
    expect(toV1PermissionAction("shell")).toBe("bash");
    expect(toV1PermissionAction("subagent")).toBe("task");
    expect(toV1PermissionAction("edit")).toBe("edit");
    expect(buildV2DenyAllRules()).toEqual([
      { action: "*", resource: "*", effect: "deny" },
    ]);
  });
});

describe("v2LocationQuery", () => {
  it("encodes a Location object, not a bare directory", () => {
    expect(JSON.parse(v2LocationQuery("/repo"))).toEqual({ directory: "/repo" });
  });
});

describe("toV2ModelRef", () => {
  it("spells the model id as `id` and folds in the variant", () => {
    expect(
      toV2ModelRef({ providerID: "openai", modelID: "gpt-5.4" }, "high"),
    ).toEqual({ id: "gpt-5.4", providerID: "openai", variant: "high" });
  });

  it("omits an absent variant", () => {
    expect(toV2ModelRef({ providerID: "openai", modelID: "gpt-5.4" })).toEqual({
      id: "gpt-5.4",
      providerID: "openai",
    });
  });
});

describe("buildV2PromptBody", () => {
  it("replaces V1 parts with text plus typed attachments", () => {
    const body = buildV2PromptBody({
      parts: [
        { type: "text", text: "look at this" },
        {
          type: "file",
          mime: "text/plain",
          filename: "a.txt",
          url: "file:///a.txt",
        },
      ],
      agent: "build",
      delivery: "steer",
      resume: true,
      id: "msg_1",
    });

    expect(body).toEqual({
      text: "look at this",
      files: [{ uri: "file:///a.txt", name: "a.txt" }],
      agents: [{ name: "build" }],
      delivery: "steer",
      resume: true,
      id: "msg_1",
    });
    // The route rejects unknown members, so V1's keys must not survive.
    expect(body).not.toHaveProperty("parts");
    expect(body).not.toHaveProperty("model");
  });

  it("joins multiple text parts and omits an empty files array", () => {
    const body = buildV2PromptBody({
      parts: [
        { type: "text", text: "one" },
        { type: "text", text: "two" },
      ],
    });
    expect(body.text).toBe("one\n\ntwo");
    expect(body).not.toHaveProperty("files");
    expect(body).not.toHaveProperty("agents");
  });
});

describe("session bodies", () => {
  it("sends create permissions under the plural key with a Location", () => {
    expect(
      buildV2SessionCreateBody({
        title: "t",
        permission: [{ action: "*", resource: "*", effect: "deny" }],
        directory: "/repo",
      }),
    ).toEqual({
      title: "t",
      location: { directory: "/repo" },
      permissions: [{ action: "*", resource: "*", effect: "deny" }],
    });
  });

  it("renames a patch body's permission key", () => {
    expect(
      buildV2SessionPatchBody({
        title: "t",
        permission: [{ action: "*", resource: "*", effect: "ask" }],
      }),
    ).toEqual({
      title: "t",
      permissions: [{ action: "*", resource: "*", effect: "ask" }],
    });
  });

  it("leaves other patch members alone", () => {
    expect(buildV2SessionPatchBody({ metadata: { a: 1 } })).toEqual({
      metadata: { a: 1 },
    });
  });
});

describe("fromV2MessageList", () => {
  it("rebuilds the V1 envelope from a V2 assistant message", () => {
    const messages = fromV2MessageList([
      {
        id: "msg_1",
        type: "assistant",
        agent: "build",
        time: { created: 10, completed: 20 },
        tokens: { input: 5, output: 7 },
        content: [
          { type: "reasoning", text: "thinking" },
          { type: "text", text: "hello" },
          {
            type: "tool",
            id: "call_1",
            name: "bash",
            time: { created: 11, completed: 12 },
            state: {
              status: "completed",
              input: { command: "ls" },
              content: [{ type: "text", text: "a.txt" }],
            },
          },
        ],
      },
    ]);

    expect(messages).toHaveLength(1);
    const info = messages[0].info!;
    // `role` is V1's discriminator for the same axis V2 calls `type`.
    expect(info.role).toBe("assistant");
    expect(info.tokens).toEqual({ input: 5, output: 7 });
    // The moved fields must not leak into `info`.
    expect(info).not.toHaveProperty("content");
    expect(info).not.toHaveProperty("type");

    const parts = messages[0].parts as Array<Record<string, unknown>>;
    expect(parts.map((part) => part.type)).toEqual([
      "reasoning",
      "text",
      "tool",
    ]);
    expect(parts.every((part) => part.messageID === "msg_1")).toBe(true);
    // V2 named the tool part's `tool` field `name`.
    expect(parts[2].tool).toBe("bash");
    // V2 returns tool output as a content array, V1 as one string.
    expect(parts[2].state).toMatchObject({
      status: "completed",
      input: { command: "ls" },
      output: "a.txt",
    });
  });

  it("gives text content items a stable id the pipeline can key on", () => {
    const [message] = fromV2MessageList([
      {
        id: "msg_1",
        type: "assistant",
        time: { created: 10 },
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      },
    ]);
    const ids = (message.parts as Array<{ id: string }>).map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith("msg_1"))).toBe(true);
  });

  it("flattens a V2 user message into text and file parts", () => {
    const [message] = fromV2MessageList([
      {
        id: "msg_2",
        type: "user",
        time: { created: 5 },
        text: "check this",
        files: [
          {
            mime: "application/pdf",
            name: "spec.pdf",
            source: { type: "file", uri: "file:///spec.pdf" },
          },
        ],
      },
    ]);

    expect(message.info!.role).toBe("user");
    const parts = message.parts as Array<Record<string, unknown>>;
    expect(parts[0]).toMatchObject({ type: "text", text: "check this" });
    // The rejected-attachment repair matches a file part on its mime.
    expect(parts[1]).toMatchObject({
      type: "file",
      mime: "application/pdf",
      filename: "spec.pdf",
      url: "file:///spec.pdf",
    });
  });

  it("marks a compaction message as a hidden assistant", () => {
    // A compaction turn reports the summarization call's tokens; reading it as
    // post-compaction context would inflate the usage meter.
    const [message] = fromV2MessageList([
      { id: "msg_3", type: "compaction", time: { created: 1 } },
    ]);
    expect(message.info).toMatchObject({ role: "assistant", agent: "compaction" });
  });

  it("skips entries that are not messages", () => {
    expect(fromV2MessageList([null, 7, {}, { type: "user" }])).toEqual([]);
    expect(fromV2MessageList("nope")).toEqual([]);
  });
});

describe("normalizeV2Event", () => {
  // V2 frames every event as { id, type, created, data, location?, durable? }.
  // The payload lives under `data`; V1 called it `properties`.
  const v2 = (type: string, data: Record<string, unknown>, frameType?: string) =>
    normalizeV2Event({ id: "evt_1", type, created: 1, data }, frameType);

  it("takes the type from the SSE frame when the payload omits it", () => {
    expect(normalizeV2Event({ id: "evt_1", data: {} }, "session.idle")).toMatchObject({
      type: "session.idle",
    });
  });

  it("prefers the payload's own type over the frame name", () => {
    // `session.viewed` is not a type this build translates, so it shows the
    // payload's name winning over the frame's.
    expect(
      normalizeV2Event({ type: "session.viewed", data: {} }, "other"),
    ).toMatchObject({ type: "session.viewed" });
  });

  it("streams text as a part delta keyed by message and ordinal", () => {
    // V2 has no partID: a streamed block is (assistantMessageID, ordinal), so
    // the pipeline needs a stable id synthesised from the pair.
    const event = v2("session.text.delta", {
      sessionID: "ses_1",
      assistantMessageID: "msg_1",
      ordinal: 0,
      delta: "Olá",
    });
    expect(event).toMatchObject({ type: "message.part.delta" });
    expect(event!.properties).toMatchObject({
      partID: "msg_1:0",
      delta: "Olá",
      messageID: "msg_1",
    });
  });

  it("keeps one id for a block whose message id the server omitted", () => {
    // `assistantMessageID` is the id a block is normally named by. When a build
    // omits it the id falls back, and a per-branch fallback would give the delta
    // and the `ended` different names -- so the block would stream nothing and
    // then appear twice.
    const started = v2("session.text.started", { ordinal: 0 })!.properties.part as { id: string };
    const delta = v2("session.text.delta", { ordinal: 0, delta: "a" })!.properties.partID;
    const ended = v2("session.text.ended", { ordinal: 0, text: "a" })!.properties.part as { id: string };
    expect(started.id).toBe(delta);
    expect(ended.id).toBe(delta);
  });

  it("keeps one id across a block's started, delta and ended", () => {
    // The pipeline keys per-block state on this id, and a delta is discarded
    // unless its part is already known. If `started` and `delta` disagree the
    // block streams nothing and then appears twice: once empty, once whole.
    const base = { assistantMessageID: "msg_1", ordinal: 0 };
    const started = v2("session.text.started", base)!.properties.part as { id: string };
    const delta = v2("session.text.delta", { ...base, delta: "a" })!.properties.partID;
    const ended = v2("session.text.ended", { ...base, text: "a" })!.properties.part as { id: string };
    expect(started.id).toBe(delta);
    expect(ended.id).toBe(delta);
  });

  it("keeps one id across a tool's input, called and success", () => {
    const base = { assistantMessageID: "msg_1", id: "call_1", name: "edit" };
    const id = (event: Record<string, unknown> | null) =>
      (event!.properties.part as { id: string }).id;
    expect(id(v2("session.tool.input.ended", { ...base, text: "{}" }))).toBe("msg_1:call_1");
    expect(id(v2("session.tool.called", { ...base, input: {} }))).toBe("msg_1:call_1");
    expect(id(v2("session.tool.success", { ...base, content: [] }))).toBe("msg_1:call_1");
  });

  it("gives two text blocks in one message distinct ids", () => {
    const first = v2("session.text.delta", { assistantMessageID: "msg_1", ordinal: 0, delta: "a" });
    const second = v2("session.text.delta", { assistantMessageID: "msg_1", ordinal: 1, delta: "b" });
    expect(first!.properties.partID).not.toBe(second!.properties.partID);
  });

  it("streams reasoning on the same part channel but as its own kind", () => {
    const event = v2("session.reasoning.delta", {
      assistantMessageID: "msg_1",
      ordinal: 0,
      delta: "thinking",
    });
    expect(event).toMatchObject({ type: "message.part.delta" });
    const ended = v2("session.reasoning.ended", {
      assistantMessageID: "msg_1",
      ordinal: 0,
      text: "thinking",
    });
    expect((ended!.properties.part as { type: string }).type).toBe("reasoning");
  });

  it("closes a text block on the durable ended event", () => {
    const event = v2("session.text.ended", {
      assistantMessageID: "msg_1",
      ordinal: 0,
      text: "Olá!",
    });
    expect(event).toMatchObject({ type: "message.part.updated" });
    expect(event!.properties.part).toMatchObject({
      id: "msg_1:0",
      type: "text",
      text: "Olá!",
    });
  });

  it("registers a started block so its deltas have somewhere to land", () => {
    // A delta is discarded unless its part is already known, so dropping the
    // `started` turned every streamed block into a single pop-in at the end.
    const event = v2("session.text.started", { assistantMessageID: "msg_1", ordinal: 0 });
    expect(event).toMatchObject({ type: "message.part.updated" });
    const part = event!.properties.part as { id: string; type: string; text: string };
    expect(part).toMatchObject({ id: "msg_1:0", type: "text", text: "" });
  });

  it("drops a tool's argument stream until it is parseable", () => {
    // The stream is the serialised arguments; `called` carries them parsed, so
    // nothing is rendered from the fragments.
    const base = { assistantMessageID: "msg_1", id: "call_1", name: "edit" };
    expect(v2("session.tool.input.started", base)).toBeNull();
    expect(v2("session.tool.input.delta", { ...base, delta: '{"path"' })).toBeNull();
    expect(v2("session.tool.input.ended", { ...base, text: '{"path": "not json' })).toBeNull();
    // Whole and parseable, it becomes the tool's arguments.
    const ended = v2("session.tool.input.ended", { ...base, text: '{"path":"a.js"}' });
    expect(ended).toMatchObject({ type: "message.part.updated" });
    expect((ended!.properties.part as { state: { input: unknown } }).state).toMatchObject({
      input: { path: "a.js" },
    });
  });

  it("maps the three tool terminals onto one state machine", () => {
    const called = v2("session.tool.called", {
      assistantMessageID: "msg_1",
      id: "call_1",
      name: "bash",
      input: { command: "ls" },
    });
    expect((called!.properties.part as { state: { status: string } }).state).toMatchObject({
      status: "running",
      input: { command: "ls" },
    });
    expect(called!.properties.part).toMatchObject({ tool: "bash", callID: "call_1" });

    const done = v2("session.tool.success", {
      assistantMessageID: "msg_1",
      id: "call_1",
      name: "bash",
      content: [{ type: "text", text: "a.txt" }],
    });
    expect((done!.properties.part as { state: { status: string; output: string } }).state).toMatchObject({
      status: "completed",
      output: "a.txt",
    });

    const failed = v2("session.tool.failed", {
      assistantMessageID: "msg_1",
      id: "call_1",
      name: "bash",
      error: { type: "ToolError", message: "no such file" },
    });
    expect((failed!.properties.part as { state: Record<string, unknown> }).state).toMatchObject({
      status: "error",
      error: "no such file",
    });
  });

  it("keeps a tool's id stable across its terminals", () => {
    const called = v2("session.tool.called", { assistantMessageID: "msg_1", id: "call_1", name: "bash" });
    const done = v2("session.tool.success", { assistantMessageID: "msg_1", id: "call_1", name: "bash", content: [] });
    expect((called!.properties.part as { id: string }).id).toBe(
      (done!.properties.part as { id: string }).id,
    );
  });

  it("ends the turn on the execution events V1 called idle", () => {
    expect(v2("session.execution.succeeded", { sessionID: "ses_1" })).toMatchObject({
      type: "session.idle",
    });
    expect(v2("session.execution.interrupted", { sessionID: "ses_1", reason: "user" })).toMatchObject({
      type: "session.idle",
    });
  });

  it("surfaces a failed execution as a session error", () => {
    const event = v2("session.execution.failed", {
      sessionID: "ses_1",
      error: { message: "provider exploded" },
    });
    expect(event).toMatchObject({ type: "session.error" });
    expect(event!.properties.error).toMatchObject({ message: "provider exploded" });
  });

  it("feeds usage to the meters that read it off a message", () => {
    const event = v2("session.usage.updated", {
      sessionID: "ses_1",
      assistantMessageID: "msg_1",
      tokens: { input: 10, output: 4, cache: { read: 2, write: 0 } },
    });
    expect(event).toMatchObject({ type: "message.updated" });
    expect(event!.properties.info).toMatchObject({
      role: "assistant",
      tokens: { input: 10, output: 4 },
    });
  });

  it("narrates an agent or model switch", () => {
    // These are real V2 events, and the turn reads as if it began already on
    // the right agent and model without them.
    const agent = v2("session.agent.selected", { sessionID: "ses_1", agent: "Build" });
    expect(agent!.properties.info).toMatchObject({
      systemNotice: "Switched agent to Build",
    });

    const model = v2("session.model.selected", {
      sessionID: "ses_1",
      model: { id: "LongCat 2.5 Preview Free", providerID: "longcat" },
    });
    expect(model!.properties.info).toMatchObject({
      systemNotice: "Switched model to LongCat 2.5 Preview Free",
    });
  });

  it("strips a provider prefix and keeps the variant on a model notice", () => {
    const model = v2("session.model.selected", {
      model: { id: "openai/gpt-5.4", providerID: "openai", variant: "high" },
    });
    expect(model!.properties.info).toMatchObject({
      systemNotice: "Switched model to gpt-5.4 high",
    });
  });

  it("narrows an unknown event rather than mangling it", () => {
    // A V2 type this build has never heard of must not be rewritten into a V1
    // name it does not mean; the pipeline ignores what it cannot route.
    const event = v2("session.viewed", { sessionID: "ses_1" });
    expect(event).toMatchObject({ type: "session.viewed" });
  });

  it("renames a permission request onto the V1 vocabulary", () => {
    // `permission.asked` is a real V2 event, unchanged in name.
    const event = v2("permission.asked", {
      id: "per_1",
      sessionID: "ses_1",
      action: "shell",
      resources: ["git push *"],
      metadata: {},
    });
    expect(event!.properties).toMatchObject({
      id: "per_1",
      // V2's `shell` maps back so the title and command extraction still fire.
      permission: "bash",
      patterns: ["git push *"],
    });
  });

  it("leaves a message event alone when the payload is already V1", () => {
    const event = normalizeV2Event({
      type: "message.updated",
      properties: { info: { id: "msg_1", role: "assistant" } },
    });
    expect(event!.properties.info).toEqual({ id: "msg_1", role: "assistant" });
  });
});

describe("v2FormToQuestions", () => {
  it("treats a plain field as free text and a multiselect as choices", () => {
    const questions = v2FormToQuestions({
      id: "frm_1",
      fields: [
        { key: "name", type: "string", title: "Name" },
        {
          key: "tags",
          type: "multiselect",
          title: "Tags",
          options: [{ value: "a", label: "A" }],
        },
      ],
    });

    expect(questions[0]).toMatchObject({
      id: "name",
      multiSelect: false,
      allowCustom: true,
    });
    expect(questions[1]).toMatchObject({
      id: "tags",
      multiSelect: true,
      options: [{ id: "a", label: "A" }],
    });
  });

  it("skips external, hidden, and keyless fields", () => {
    const questions = v2FormToQuestions({
      id: "frm_1",
      fields: [
        { key: "url", type: "external", title: "Docs" },
        { key: "secret", type: "string", title: "Secret", hidden: true },
        { type: "string", title: "No key" },
      ],
    });
    expect(questions).toEqual([]);
  });

  it("drops a repeated field key rather than renaming it", () => {
    // The question id doubles as the form answer key, so a renamed id would
    // post a key the server does not know.
    const questions = v2FormToQuestions({
      id: "frm_1",
      fields: [
        { key: "a", type: "string", title: "One" },
        { key: "a", type: "string", title: "Two" },
      ],
    });
    expect(questions.map((q) => q.id)).toEqual(["a"]);
  });
});

describe("buildV2FormAnswer", () => {
  const questions = [
    {
      id: "name",
      prompt: "Name",
      multiSelect: false,
      allowCustom: true,
      options: [],
    },
    {
      id: "tags",
      prompt: "Tags",
      multiSelect: true,
      allowCustom: false,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    },
  ];

  it("sends free text from the custom map", () => {
    // A non-multiselect field is free text, so the UI puts the typed value in
    // `custom`; reading only `answers` would post an empty form.
    expect(
      buildV2FormAnswer(
        { kind: "answered", answers: {}, custom: { name: "Ada" } },
        questions,
      ),
    ).toEqual({ answer: { name: "Ada" } });
  });

  it("collapses a single choice and keeps a multi-select as an array", () => {
    expect(
      buildV2FormAnswer(
        { kind: "answered", answers: { name: ["Ada"], tags: ["a", "b"] } },
        questions,
      ),
    ).toEqual({ answer: { name: "Ada", tags: ["a", "b"] } });
  });

  it("sends only ids the field declares", () => {
    // A stale or synthetic id would not match any option on the server.
    expect(
      buildV2FormAnswer(
        { kind: "answered", answers: { tags: ["a", "not-an-option"] } },
        questions,
      ),
    ).toEqual({ answer: { tags: ["a"] } });
  });

  it("omits unanswered fields so the server applies its own required rule", () => {
    expect(
      buildV2FormAnswer({ kind: "answered", answers: {} }, questions),
    ).toBeNull();
    expect(buildV2FormAnswer({ kind: "skipped" }, questions)).toBeNull();
  });
});
