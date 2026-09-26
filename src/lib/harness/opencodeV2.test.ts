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
  it("takes the type from the SSE frame when the payload omits it", () => {
    expect(normalizeV2Event({ foo: 1 }, "session.idle")).toMatchObject({
      type: "session.idle",
    });
  });

  it("prefers the payload's own type over the frame name", () => {
    expect(
      normalizeV2Event({ type: "message.updated", properties: {} }, "other"),
    ).toMatchObject({ type: "message.updated" });
  });

  it("renames a permission request onto the V1 vocabulary", () => {
    const event = normalizeV2Event({
      type: "permission.asked",
      properties: {
        id: "per_1",
        action: "shell",
        resources: ["git push *"],
        metadata: {},
      },
    });
    expect(event!.properties).toMatchObject({
      id: "per_1",
      // V2's `shell` maps back so the title and command extraction still fire.
      permission: "bash",
      patterns: ["git push *"],
    });
  });

  it("translates a V2 message event onto the V1 envelope", () => {
    const event = normalizeV2Event({
      type: "message.updated",
      properties: {
        info: {
          id: "msg_1",
          type: "assistant",
          agent: "build",
          time: { created: 10 },
          tokens: { input: 5, output: 7 },
          content: [{ type: "text", text: "hello" }],
        },
      },
    });

    // The pipeline meters usage off `info.role` and renders `parts`.
    const info = event!.properties.info as Record<string, unknown>;
    expect(info.role).toBe("assistant");
    expect(info).not.toHaveProperty("type");
    expect(info).not.toHaveProperty("content");
    const parts = event!.properties.parts as Array<Record<string, unknown>>;
    expect(parts[0]).toMatchObject({ type: "text", text: "hello" });
  });

  it("leaves a message event alone when the payload is already V1", () => {
    const event = normalizeV2Event({
      type: "message.updated",
      properties: { info: { id: "msg_1", role: "assistant" } },
    });
    expect(event!.properties.info).toEqual({ id: "msg_1", role: "assistant" });
  });

  it("routes a pending form onto the question pipeline", () => {
    const event = normalizeV2Event({
      type: "form.requested",
      properties: {
        form: {
          id: "frm_1",
          sessionID: "ses_1",
          title: "Pick a mode",
          fields: [
            {
              key: "mode",
              type: "multiselect",
              title: "Mode",
              options: [{ value: "fast", label: "Fast" }],
            },
          ],
        },
      },
    });

    expect(event!.type).toBe("question.asked");
    expect(event!.properties).toMatchObject({ id: "frm_1" });
    const questions = event!.properties.questions as Array<
      Record<string, unknown>
    >;
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: "mode",
      multiSelect: true,
      options: [{ id: "fast", label: "Fast" }],
    });
  });

  it("drops a frameless payload", () => {
    expect(normalizeV2Event({ properties: {} })).toBeNull();
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
