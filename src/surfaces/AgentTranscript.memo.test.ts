// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../lib/session";
import {
  AgentTranscript,
  sameTranscriptBlock,
  sameTranscriptTurn,
} from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const user = (id: string, text: string): Block => ({ id, role: "user", text });
const assistant = (id: string, text: string): Block => ({
  id,
  role: "assistant",
  text,
});
const runningTool: Block = {
  id: "t-0",
  role: "tool",
  text: "Running",
  tool: { kind: "shell", status: "running" },
};

describe("sameTranscriptBlock", () => {
  it("treats untouched blocks as equal", () => {
    expect(sameTranscriptBlock(user("u", "Hi"), user("u", "Hi"))).toBe(true);
  });

  it("notices text growth, status flips and approval decisions", () => {
    expect(
      sameTranscriptBlock(assistant("a", "Token"), assistant("a", "Token token")),
    ).toBe(false);
    expect(
      sameTranscriptBlock(runningTool, {
        ...runningTool,
        text: "Done",
        tool: { kind: "shell", status: "completed" },
      }),
    ).toBe(false);
    const pending: Block = {
      id: "t-1",
      role: "tool",
      text: "Install?",
      tool: { kind: "shell", status: "pending" },
      approval: { requestId: 7 },
    };
    expect(
      sameTranscriptBlock(pending, {
        ...pending,
        approval: { requestId: 7, decided: "allow" },
      }),
    ).toBe(false);
  });
});

describe("sameTranscriptTurn", () => {
  it("keeps settled turns out of streaming re-renders", () => {
    const settled = [user("user-0", "First"), assistant("answer-0", "Done")];
    expect(sameTranscriptTurn(settled, settled.map((b) => ({ ...b })))).toBe(
      true,
    );
    expect(
      sameTranscriptTurn(settled, [...settled, assistant("extra", "New")]),
    ).toBe(false);
  });
});

describe("streaming updates still reach the DOM", () => {
  it("grows the live answer and settles tool rows", () => {
    const blocks: Block[] = [
      user("user-0", "Run it"),
      runningTool,
      user("user-1", "Second"),
      assistant("answer-1", "Token"),
    ];
    act(() => {
      root.render(createElement(AgentTranscript, { blocks, busy: true }));
    });
    expect(container.textContent).toContain("Shell");

    act(() => {
      root.render(
        createElement(AgentTranscript, {
          blocks: blocks.map((block) =>
            block.id === "t-0"
              ? {
                  ...block,
                  text: "Done",
                  tool: { kind: "shell", status: "completed" },
                }
              : block.id === "answer-1"
                ? { ...block, text: "Token token" }
                : block,
          ),
          busy: true,
        }),
      );
    });
    expect(container.textContent).toContain("Done");
    expect(container.textContent).toContain("Token token");
  });
});
