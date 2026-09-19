import { describe, expect, it } from "vitest";
import {
  mcodeAutoPermissionOption,
  mcodePermissionOptionId,
  mcodePermissionRequestFromAcp,
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

  it("auto-approves with the most permissive option", () => {
    expect(
      mcodeAutoPermissionOption("auto", ["allow-once", "allow-always"]),
    ).toBe("allow-always");
    expect(mcodeAutoPermissionOption("auto", [])).toBeNull();
  });
});
