import { describe, expect, it } from "vitest";
import {
  flattenOpenCodeModels,
  openCodeProviderName,
  parseAgentListCliOutput,
  parseModelsCliOutput,
  parsePlainModelSlugs,
  parseV2AgentApiOutput,
  parseV2ModelApiOutput,
} from "./opencodeCatalog";
import {
  buildOpenCodeDenyAllRules,
  buildOpenCodePermissionRules,
  compareSemver,
  contextUsedFromMessageInfo,
  turnMetricsFromMessageInfo,
  detailFromToolPart,
  eventSessionId,
  inferDefaultAgent,
  inferDefaultVariant,
  isOpenCodeDefaultTitle,
  isOpenCodeNotFound,
  isTurnDoneStatusEvent,
  mergeOpenCodeAssistantText,
  normalizeServerEvent,
  openCodeProtocolForRelease,
  openCodeVariantLabel,
  parseOpenCodeModelSlug,
  assertSupportedOpenCodeRelease,
  parseOpenCodeRelease,
  parseOpenCodeVersion,
  parseServerPasswordFromOutput,
  parseServerUrlFromOutput,
  sortOpenCodeVariants,
  toOpenCodePermissionReply,
  toolKindFromName,
} from "./opencodeProtocol";

describe("eventSessionId", () => {
  it.each([
    {
      type: "permission.asked",
      properties: { id: "permission_1", sessionID: "session_1" },
    },
    {
      type: "session.created",
      properties: { info: { id: "session_1", parentID: "session_parent" } },
    },
    {
      type: "message.updated",
      properties: { info: { id: "message_1", sessionID: "session_1" } },
    },
    {
      type: "message.part.updated",
      properties: { part: { id: "part_1", sessionID: "session_1" } },
    },
    {
      type: "message.part.delta",
      properties: { sessionID: "session_1", partID: "part_1" },
    },
  ])("extracts the owning session for $type", (event) => {
    expect(eventSessionId(event)).toBe("session_1");
  });

  it("does not mistake message IDs for session IDs", () => {
    expect(
      eventSessionId({
        type: "message.updated",
        properties: { info: { id: "message_1" } },
      }),
    ).toBeUndefined();
  });
});

describe("parseOpenCodeModelSlug", () => {
  it("splits provider/model", () => {
    expect(parseOpenCodeModelSlug("anthropic/claude-sonnet-4-6")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-6",
    });
  });

  it("rejects bare ids", () => {
    expect(parseOpenCodeModelSlug("glm-5")).toBeNull();
    expect(parseOpenCodeModelSlug("/model")).toBeNull();
    expect(parseOpenCodeModelSlug("provider/")).toBeNull();
  });
});

describe("tool kinds", () => {
  it("classifies todo writes as internal task activity", () => {
    expect(toolKindFromName("todowrite")).toBe("tasks");
  });
});

describe("tool failure details", () => {
  it("extracts nested provider errors instead of dropping them", () => {
    expect(
      detailFromToolPart({
        id: "agent-1",
        type: "tool",
        tool: "task",
        state: {
          status: "error",
          error: { data: { message: "worker disconnected" } },
        },
      }),
    ).toBe("worker disconnected");
  });
});

describe("parseServerUrlFromOutput", () => {
  it("reads the listening URL from server output", () => {
    expect(
      parseServerUrlFromOutput(
        "opencode server listening on http://127.0.0.1:4096",
      ),
    ).toBe("http://127.0.0.1:4096");
  });

  it("reads a bare loopback URL without the listening marker", () => {
    expect(parseServerUrlFromOutput("http://127.0.0.1:4096")).toBe(
      "http://127.0.0.1:4096",
    );
    expect(parseServerUrlFromOutput("Server at http://localhost:4096.")).toBe(
      "http://localhost:4096",
    );
  });

  it("ignores non-loopback URLs without the listening marker", () => {
    expect(parseServerUrlFromOutput("See https://opencode.ai for docs")).toBeNull();
  });
});

describe("V2 catalog API parsers", () => {
  it("reads models from the V2 model route", () => {
    const parsed = parseV2ModelApiOutput(
      JSON.stringify({
        location: { directory: "/repo" },
        data: [
          {
            id: "gpt-5.4",
            modelID: "gpt-5.4",
            providerID: "openai",
            name: "GPT-5.4",
            enabled: true,
            limit: { context: 400_000, output: 128_000 },
            variants: [{ id: "high" }, { id: "low" }],
          },
        ],
      }),
    );

    const provider = parsed.providers.get("openai");
    expect(parsed.connected).toEqual(["openai"]);
    expect(provider?.models["gpt-5.4"]?.limit?.context).toBe(400_000);
    // The native array of variants becomes the map the settings builder reads.
    expect(Object.keys(provider?.models["gpt-5.4"]?.variants ?? {})).toEqual([
      "high",
      "low",
    ]);
  });

  it("skips disabled, deprecated, and idless models", () => {
    const parsed = parseV2ModelApiOutput(
      JSON.stringify({
        data: [
          { modelID: "off", providerID: "openai", enabled: false },
          { modelID: "old", providerID: "openai", status: "deprecated" },
          { modelID: "", providerID: "openai" },
          { modelID: "ok", providerID: "openai" },
        ],
      }),
    );
    expect(Object.keys(parsed.providers.get("openai")?.models ?? {})).toEqual([
      "ok",
    ]);
  });

  it("canonicalizes legacy provider ids from the API", () => {
    const parsed = parseV2ModelApiOutput(
      JSON.stringify({
        data: [
          { modelID: "m", providerID: "google-vertex-anthropic" },
          { modelID: "m2", providerID: "azure-cognitive-services" },
        ],
      }),
    );
    expect([...parsed.providers.keys()].sort()).toEqual(["azure", "google-vertex"]);
  });

  it("survives non-JSON and empty output", () => {
    expect(parseV2ModelApiOutput("").providers.size).toBe(0);
    expect(parseV2ModelApiOutput("error: no service").providers.size).toBe(0);
    expect(parseV2ModelApiOutput("{}").connected).toEqual([]);
  });

  it("reads agents from the V2 agent route, keyed by id", () => {
    const agents = parseV2AgentApiOutput(
      JSON.stringify({
        location: { directory: "/repo" },
        data: [
          { id: "build", name: "Build", mode: "primary", hidden: false },
          { id: "plan", name: "Plan", mode: "primary", hidden: false },
          { id: "title", name: "Title", mode: "all", hidden: false },
          { name: "NoId", mode: "all" },
        ],
      }),
    );

    // The id is what the session routes accept; the display name is not a
    // valid substitute, so that is what MonoCode sends.
    expect(agents.map((agent) => agent.name)).toEqual(["build", "plan", "title"]);
    expect(agents.map((agent) => agent.mode)).toEqual([
      "primary",
      "primary",
      "all",
    ]);
    // `title` is a hidden built-in even when the server does not flag it.
    expect(agents[2].hidden).toBe(true);
    // An entry with no id cannot be selected, so it is dropped.
    expect(agents).toHaveLength(3);
  });

  it("falls back to the id when the server omits the display name", () => {
    const agents = parseV2AgentApiOutput(
      JSON.stringify({ data: [{ id: "build", mode: "primary" }] }),
    );
    expect(agents[0].name).toBe("build");
  });

  it("honors the server's own hidden flag", () => {
    const agents = parseV2AgentApiOutput(
      JSON.stringify({
        data: [{ id: "x", name: "X", mode: "all", hidden: true }],
      }),
    );
    expect(agents[0].hidden).toBe(true);
  });
});

describe("parseServerPasswordFromOutput", () => {
  it("reads the per-process password V2 prints", () => {
    expect(
      parseServerPasswordFromOutput("  server password  aBc-123_xYz"),
    ).toBe("aBc-123_xYz");
  });

  it("strips trailing punctuation and tolerates casing", () => {
    expect(parseServerPasswordFromOutput("Server Password: hunter2.")).toBe(
      "hunter2",
    );
  });

  it("returns null when V1 prints no password", () => {
    expect(
      parseServerPasswordFromOutput("opencode server listening on http://127.0.0.1:4096"),
    ).toBeNull();
  });
});

describe("parseOpenCodeVersion / compareSemver", () => {
  it("extracts a semver and gates 1.14.19", () => {
    expect(parseOpenCodeVersion("1.14.19")).toBe("1.14.19");
    expect(parseOpenCodeVersion("opencode 1.15.0")).toBe("1.15.0");
    expect(compareSemver("1.14.18", "1.14.19")).toBeLessThan(0);
    expect(compareSemver("1.14.19", "1.14.19")).toBe(0);
    expect(compareSemver("1.15.0", "1.14.19")).toBeGreaterThan(0);
  });
});

describe("openCode protocol detection", () => {
  it("classifies stable and beta releases", () => {
    expect(
      openCodeProtocolForRelease(parseOpenCodeRelease("1.14.19")!),
    ).toBe("v1");
    expect(
      openCodeProtocolForRelease(parseOpenCodeRelease("opencode 2.0.0")!),
    ).toBe("v2");
    expect(
      openCodeProtocolForRelease(parseOpenCodeRelease("0.0.0-beta-18743")!),
    ).toBe("v2");
  });

  it("gates old V1, accepts V2, rejects garbage", () => {
    expect(assertSupportedOpenCodeRelease("1.14.19")).toEqual({
      version: "1.14.19",
      protocol: "v1",
    });
    expect(assertSupportedOpenCodeRelease("0.0.0-beta-18743").protocol).toBe(
      "v2",
    );
    expect(() => assertSupportedOpenCodeRelease("1.14.18")).toThrow(/too old/);
    expect(() => assertSupportedOpenCodeRelease("no version here")).toThrow(
      /Unable to determine/,
    );
  });
});

describe("normalizeServerEvent", () => {
  it("passes V1 events through untouched", () => {
    const event = { type: "permission.asked", properties: { id: "r1" } };
    expect(normalizeServerEvent(event)).toBe(event);
  });

  it("drops a payload with no event type", () => {
    expect(normalizeServerEvent({ properties: {} })).toBeNull();
  });
});

describe("buildOpenCodePermissionRules", () => {
  it("allows everything in full-access", () => {
    expect(buildOpenCodePermissionRules("full-access")).toEqual([
      { permission: "*", pattern: "*", action: "allow" },
    ]);
  });

  it("asks by default and allows edits in auto-accept-edits", () => {
    const rules = buildOpenCodePermissionRules("auto-accept-edits");
    expect(rules).toContainEqual({
      permission: "edit",
      pattern: "*",
      action: "allow",
    });
    expect(rules[0]).toEqual({
      permission: "*",
      pattern: "*",
      action: "ask",
    });
  });

  it("maps allow/deny onto OpenCode reply values", () => {
    expect(toOpenCodePermissionReply("allow")).toBe("once");
    expect(toOpenCodePermissionReply("deny")).toBe("reject");
  });

  it("denies every action for text-only sessions", () => {
    expect(buildOpenCodeDenyAllRules()).toEqual([
      { permission: "*", pattern: "*", action: "deny" },
    ]);
  });
});

describe("OpenCode CLI inventory parsers", () => {
  it("parses the plain provider/model list", () => {
    const parsed = parseModelsCliOutput(
      ["opencode/big-pickle", "commandcode/claude-sonnet-5"].join("\n"),
    );
    expect(parsed.connected).toEqual(["opencode", "commandcode"]);
    const models = flattenOpenCodeModels(parsed, []);
    expect(models.map((model) => model.nativeId)).toEqual([
      "opencode/big-pickle",
      "commandcode/claude-sonnet-5",
    ]);
    expect(models[1]).toMatchObject({
      id: "opencode:commandcode/claude-sonnet-5",
      name: "Claude Sonnet 5",
    });
  });

  it("rejects mixed plain and verbose output", () => {
    expect(
      parsePlainModelSlugs(
        ['opencode/big-pickle', '{"id":"big-pickle"}'].join("\n"),
      ),
    ).toBeNull();
  });

  it("normalizes V2 native shapes: arrays, modelID, canonical IDs, skips", () => {
    const parsed = parseModelsCliOutput(
      [
        "azure-cognitive-services/gpt-5",
        '{"modelID":"gpt-5"}',
        "google-vertex-anthropic/claude",
        '{"modelID":"claude","variants":[{"id":"high"},{"id":"low"}],"status":"deprecated"}',
        "acme/old",
        '{"id":"old","disabled":true}',
      ].join("\n"),
    );
    // Deprecated/disabled entries are dropped; legacy IDs canonicalized.
    expect(parsed.connected).toEqual(["azure"]);
    const models = flattenOpenCodeModels(parsed, []);
    expect(models.map((model) => model.nativeId)).toEqual(["azure/gpt-5"]);
  });

  it("parses models --verbose output", () => {
    const stdout = [
      "opencode/glm-5",
      '{"id":"glm-5","name":"GLM 5","variants":{"high":{},"medium":{}}}',
      "anthropic/claude-sonnet-4-6",
      '{"id":"claude-sonnet-4-6","name":"Claude Sonnet 4.6","variants":{"high":{}}}',
      "",
    ].join("\n");
    const parsed = parseModelsCliOutput(stdout);
    const models = flattenOpenCodeModels(parsed, [
      { name: "build", mode: "primary", hidden: false },
      { name: "plan", mode: "primary", hidden: false },
      { name: "title", mode: "primary", hidden: true },
    ]);
    expect(models.map((model) => model.nativeId)).toEqual([
      "anthropic/claude-sonnet-4-6",
      "opencode/glm-5",
    ]);
    expect(models.map((model) => model.provider)).toEqual([
      { id: "anthropic", name: "Anthropic" },
      { id: "opencode", name: "OpenCode" },
    ]);
    expect(
      models[1].settings?.some((setting) => setting.id === "variant"),
    ).toBe(true);
    expect(
      models[0].settings?.find((setting) => setting.id === "agent")?.value,
    ).toBe("build");
  });

  it("parses agent list headers", () => {
    const agents = parseAgentListCliOutput(
      ["build (primary)", "{}", "compaction (primary)", "{}"].join("\n"),
    );
    expect(agents).toEqual([
      { name: "build", mode: "primary", hidden: false },
      { name: "compaction", mode: "primary", hidden: true },
    ]);
  });

  it("uses familiar provider names and readable custom-provider fallbacks", () => {
    expect(openCodeProviderName("opencode-go")).toBe("OpenCode Go");
    expect(openCodeProviderName("openai")).toBe("OpenAI");
    expect(openCodeProviderName("acme-cloud")).toBe("Acme Cloud");
  });

  it("sorts variant options and labels xhigh as Extra High", () => {
    const parsed = parseModelsCliOutput(
      [
        "some-cloud/spark-1",
        '{"id":"spark-1","name":"Spark 1","variants":{"high":{},"minimal":{},"xhigh":{},"low":{},"medium":{}}}',
        "",
      ].join("\n"),
    );
    const [model] = flattenOpenCodeModels(parsed, []);
    const variant = model?.settings?.find((setting) => setting.id === "variant");
    expect(variant?.options.map((option) => option.value)).toEqual([
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(variant?.options.map((option) => option.label)).toEqual([
      "Minimal",
      "Low",
      "Medium",
      "High",
      "Extra High",
    ]);
    expect(variant?.value).toBe("medium");
  });

  it("parses indented slug lines instead of falling back to plain slugs", () => {
    // Some CLI generations indent the inventory. Without trimming, no slug
    // matches, zero models parse, and the caller falls back to the plain
    // list — silently dropping every model's variants (and the thinking
    // control with them).
    const parsed = parseModelsCliOutput(
      [
        "  some-cloud/spark-1",
        '  {"id":"spark-1","name":"Spark 1","variants":{"xhigh":{}}}',
        "",
      ].join("\n"),
    );
    expect(parsed.connected).toEqual(["some-cloud"]);
    const [model] = flattenOpenCodeModels(parsed, []);
    expect(
      model?.settings?.find((setting) => setting.id === "variant")?.options.map(
        (option) => option.value,
      ),
    ).toEqual(["xhigh"]);
  });

  it("accepts V2 variant entries keyed by name", () => {
    const parsed = parseModelsCliOutput(
      [
        "some-cloud/spark-1",
        '{"id":"spark-1","variants":[{"name":"high"},{"id":"low"}]}',
        "",
      ].join("\n"),
    );
    const [model] = flattenOpenCodeModels(parsed, []);
    expect(
      model?.settings?.find((setting) => setting.id === "variant")?.options.map(
        (option) => option.value,
      ),
    ).toEqual(["low", "high"]);
  });
});

describe("isTurnDoneStatusEvent", () => {
  it("treats session.status=idle and bare session.idle as done", () => {
    expect(
      isTurnDoneStatusEvent("session.status", {
        status: { type: "idle" },
      }),
    ).toBe(true);
    expect(isTurnDoneStatusEvent("session.idle", {})).toBe(true);
    expect(isTurnDoneStatusEvent("session.idle", { sessionID: "s" })).toBe(
      true,
    );
  });

  it("ignores busy and retry statuses", () => {
    expect(
      isTurnDoneStatusEvent("session.status", {
        status: { type: "busy" },
      }),
    ).toBe(false);
    expect(
      isTurnDoneStatusEvent("session.status", {
        status: { type: "retry" },
      }),
    ).toBe(false);
    expect(isTurnDoneStatusEvent("server.heartbeat", {})).toBe(false);
  });
});

describe("mergeOpenCodeAssistantText", () => {
  it("emits only the new suffix", () => {
    expect(mergeOpenCodeAssistantText("Hel", "Hello")).toEqual({
      latestText: "Hello",
      deltaToEmit: "lo",
    });
  });

  it("keeps a longer snapshot if the next update shrinks", () => {
    expect(mergeOpenCodeAssistantText("Hello world", "Hello")).toEqual({
      latestText: "Hello world",
      deltaToEmit: "",
    });
  });
});

describe("OpenCode helpers", () => {
  it("ignores OpenCode placeholder titles", () => {
    expect(
      isOpenCodeDefaultTitle("New session - 2026-08-16T07:24:01.000Z"),
    ).toBe(true);
    expect(isOpenCodeDefaultTitle("Fix login timeout")).toBe(false);
  });

  it("detects 404 / NotFoundError", () => {
    expect(isOpenCodeNotFound({ status: 404 })).toBe(true);
    expect(isOpenCodeNotFound({ name: "NotFoundError" })).toBe(true);
    expect(isOpenCodeNotFound({ status: 500, name: "NotFoundError" })).toBe(
      false,
    );
  });

  it("infers default variant and agent", () => {
    expect(inferDefaultVariant("anthropic", ["low", "high"])).toBe("high");
    expect(inferDefaultVariant("openai", ["low", "medium", "high"])).toBe(
      "medium",
    );
    expect(inferDefaultAgent([{ name: "plan" }, { name: "build" }])).toBe(
      "build",
    );
  });

  it("prefers medium/high variants on any provider", () => {
    expect(inferDefaultVariant("some-cloud", ["low", "medium", "high"])).toBe(
      "medium",
    );
    expect(inferDefaultVariant("some-cloud", ["low", "high"])).toBe("high");
    expect(inferDefaultVariant("some-cloud", ["low", "xhigh"])).toBeUndefined();
  });

  it("labels variants like Codex/Cursor effort levels", () => {
    expect(openCodeVariantLabel("xhigh")).toBe("Extra High");
    expect(openCodeVariantLabel("extra-high")).toBe("Extra High");
    expect(openCodeVariantLabel("minimal")).toBe("Minimal");
    expect(openCodeVariantLabel("high")).toBe("High");
  });

  it("sorts variants from lowest to highest effort", () => {
    expect(sortOpenCodeVariants(["high", "minimal", "xhigh", "low", "medium"])).toEqual([
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });
});

describe("contextUsedFromMessageInfo", () => {
  it("counts cache reads and writes alongside input and output", () => {
    expect(
      contextUsedFromMessageInfo({
        role: "assistant",
        modelID: "big-pickle",
        providerID: "opencode",
        tokens: {
          input: 1_200,
          output: 800,
          reasoning: 200,
          cache: { read: 40_000, write: 5_000 },
        },
      }),
    ).toBe(47_200);
  });

  it("ignores a message that carries no token block", () => {
    expect(contextUsedFromMessageInfo({ role: "assistant" })).toBeUndefined();
    expect(contextUsedFromMessageInfo(null)).toBeUndefined();
  });

  it("treats an all-zero reading as nothing to report", () => {
    expect(
      contextUsedFromMessageInfo({
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
      }),
    ).toBeUndefined();
  });

  it("normalizes cache usage for a turn tooltip", () => {
    expect(
      turnMetricsFromMessageInfo({
        tokens: {
          input: 1_200,
          output: 800,
          reasoning: 200,
          cache: { read: 40_000, write: 5_000 },
        },
      }),
    ).toEqual({
      inputTokens: 1_200,
      outputTokens: 1_000,
      cacheReadTokens: 40_000,
      cacheWriteTokens: 5_000,
      cacheHitPercent: (40_000 / 46_200) * 100,
    });
  });
});

describe("flattenOpenCodeModels context window", () => {
  it("carries limit.context onto the catalog entry", () => {
    const models = flattenOpenCodeModels(
      {
        providers: new Map([
          [
            "opencode",
            {
              id: "opencode",
              name: "opencode",
              models: {
                "big-pickle": {
                  id: "big-pickle",
                  name: "Big Pickle",
                  limit: { context: 200_000, output: 32_000 },
                },
              },
            },
          ],
        ]),
        connected: ["opencode"],
      },
      [],
    );
    expect(models[0]?.contextWindow).toBe(200_000);
  });
});
