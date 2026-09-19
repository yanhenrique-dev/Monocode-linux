import { describe, expect, it } from "vitest";
import {
  mcodeAutoPermissionOption,
  mcodeConfigToModelSettings,
  mcodeEventsFromAcpUpdate,
  mcodeExtractModelConfigId,
  mcodePermissionOptionId,
  mcodePermissionRequestFromAcp,
  mcodeReadConfigOptions,
  mcodeResolveSettingConfigId,
  mcodeSessionIdFromResult,
} from "./mcodeProtocol";

describe("mcode permission requests", () => {
  it("reads tool-call fields instead of top-level distractors", () => {
    const request = mcodePermissionRequestFromAcp({
      title: "top-level title must not win",
      kind: "top-level-kind",
      toolCallId: "top-level-id",
      toolCall: {
        toolCallId: "call-1",
        kind: "write",
        title: "Write main.rs",
      },
      options: [{ optionId: "allow-once" }, { optionId: "reject-once" }],
    });
    expect(request.callId).toBe("call-1");
    expect(request.kind).toBe("write");
    expect(request.title).toBe("Write main.rs");
    expect(request.optionIds).toEqual(["allow-once", "reject-once"]);
  });

  it("supports snake_case option ids", () => {
    const request = mcodePermissionRequestFromAcp({
      tool_call: { tool_call_id: "call-2", kind: "read", title: "Read" },
      options: [{ id: "allow_once" }],
    });
    expect(request.callId).toBe("call-2");
    expect(request.optionIds).toEqual(["allow_once"]);
  });

  it("maps allow/deny to the offered options with safe fallbacks", () => {
    expect(
      mcodePermissionOptionId("allow", ["reject-once", "allow-once"]),
    ).toBe("allow-once");
    expect(mcodePermissionOptionId("deny", ["allow-once"])).toBe(
      "reject-once",
    );
  });

  it("matches option ids case-insensitively and ignores non-strings", () => {
    expect(mcodePermissionOptionId("allow", ["ALLOW-ONCE"])).toBe(
      "ALLOW-ONCE",
    );
    expect(
      mcodePermissionOptionId("deny", [null, 42, "reject-once"] as never[]),
    ).toBe("reject-once");
  });

  it("auto-approves with the most permissive option", () => {
    expect(
      mcodeAutoPermissionOption("auto", ["allow-once", "allow-always"]),
    ).toBe("allow-always");
    expect(mcodeAutoPermissionOption("auto", [])).toBeNull();
  });
});

describe("mcode session config", () => {
  const options = mcodeReadConfigOptions([
    { id: "provider", category: "provider", currentValue: "minimax" },
    { id: "model", category: "model", currentValue: "MiniMax-M2" },
    { id: "effort", category: "thought_level", currentValue: "high" },
    { id: "verbose", category: "display", currentValue: true },
    { noId: true },
  ]);

  it("flattens config options, skipping id-less entries", () => {
    expect(options).toHaveLength(4);
    expect(options[1]).toMatchObject({ id: "model", category: "model" });
  });

  it("prefers the literal model id for the model selector", () => {
    expect(mcodeExtractModelConfigId(options)).toBe("model");
    expect(mcodeExtractModelConfigId([])).toBe("model");
  });

  it("resolves effort through aliases", () => {
    expect(mcodeResolveSettingConfigId(options, "effort")).toBe("effort");
    expect(mcodeResolveSettingConfigId(options, "reasoning")).toBe("effort");
    expect(mcodeResolveSettingConfigId(options, "unknown")).toBeUndefined();
  });

  it("maps toggles and selects to model settings, skipping model/provider", () => {
    const settings = mcodeConfigToModelSettings(options);
    expect(settings.map((s) => s.id).sort()).toEqual(["effort", "verbose"]);
    expect(settings.find((s) => s.id === "verbose")).toMatchObject({
      kind: "toggle",
      value: "true",
    });
  });

  it("reads the session id from new/resume responses", () => {
    expect(mcodeSessionIdFromResult({ sessionId: "abc" })).toBe("abc");
    expect(mcodeSessionIdFromResult({ session_id: "def" })).toBe("def");
    expect(mcodeSessionIdFromResult({})).toBeUndefined();
  });
});

describe("mcode session updates", () => {
  it("maps message and thought chunks to deltas", () => {
    expect(
      mcodeEventsFromAcpUpdate({
        update: { sessionUpdate: "agent_message_chunk", content: "hi" },
      }),
    ).toEqual([{ type: "message.delta", text: "hi" }]);
    expect(
      mcodeEventsFromAcpUpdate({
        update: { sessionUpdate: "agent_thought_chunk", content: "hmm" },
      }),
    ).toEqual([{ type: "reasoning.delta", text: "hmm" }]);
  });

  it("maps tool calls with call ids", () => {
    expect(
      mcodeEventsFromAcpUpdate({
        update: {
          sessionUpdate: "tool_call",
          toolCall: { toolCallId: "c1", kind: "write", title: "W" },
          status: "running",
        },
      }),
    ).toEqual([
      { type: "tool.updated", callId: "c1", title: "W", kind: "write", status: "running" },
    ]);
    expect(
      mcodeEventsFromAcpUpdate({ update: { sessionUpdate: "tool_call" } }),
    ).toEqual([]);
  });

  it("maps plan entries to tasks and falls back to text", () => {
    const [event] = mcodeEventsFromAcpUpdate({
      update: {
        sessionUpdate: "plan",
        entries: [{ content: "step one", status: "done" }],
      },
    }) as Array<{ type: string; items: Array<{ text: string }> }>;
    expect(event.type).toBe("tasks.updated");
    expect(event.items[0]?.text).toBe("step one");
    expect(
      mcodeEventsFromAcpUpdate({
        update: { sessionUpdate: "plan", text: "loose plan" },
      }),
    ).toEqual([{ type: "plan", text: "loose plan", append: true }]);
  });
});
