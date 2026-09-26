import { beforeEach, describe, expect, it, vi } from "vitest";

const runners = vi.hoisted(() => ({
  claude: vi.fn<() => Promise<string>>(),
  codex: vi.fn<() => Promise<string>>(),
  cursor: vi.fn<() => Promise<string>>(),
  grok: vi.fn<() => Promise<string>>(),
  opencode: vi.fn<() => Promise<string>>(),
  pi: vi.fn<() => Promise<string>>(),
}));

vi.mock("./claudeText", () => ({ runClaudeTextPrompt: runners.claude }));
vi.mock("./codexText", () => ({ runCodexTextPrompt: runners.codex }));
vi.mock("./cursorText", () => ({ runCursorTextPrompt: runners.cursor }));
vi.mock("./grokText", () => ({ runGrokTextPrompt: runners.grok }));
vi.mock("./opencodeText", () => ({ runOpenCodeTextPrompt: runners.opencode }));
vi.mock("./piText", () => ({ runTextPrompt: runners.pi }));
vi.mock("./piFlavor", () => ({
  PI_FLAVOR: { id: "pi" },
  OMP_FLAVOR: { id: "omp" },
}));

import {
  generateNextStepSuggestions,
  nextStepSuggestionKey,
  requestNextStepSuggestions,
  resetNextStepSuggestionGuard,
  supportsNextSteps,
} from "./nextStepsText";

const VALID = JSON.stringify({
  suggestions: [{ label: "Run the tests", prompt: "Run the test suite." }],
});

beforeEach(() => {
  for (const fn of Object.values(runners)) fn.mockReset();
  for (const fn of Object.values(runners)) {
    fn.mockResolvedValue(VALID);
  }
  vi.spyOn(console, "debug").mockImplementation(() => {});
  resetNextStepSuggestionGuard();
});

describe("supportsNextSteps", () => {
  it("covers the harnesses that ship a text runner", () => {
    for (const id of [
      "claude",
      "codex",
      "cursor",
      "grok",
      "opencode",
      "pi",
      "omp",
    ]) {
      expect(supportsNextSteps(id as never), id).toBe(true);
    }
  });

  it("is false for a harness with no text runner", () => {
    expect(supportsNextSteps("fx")).toBe(false);
    expect(supportsNextSteps("hermes")).toBe(false);
  });
});

describe("generateNextStepSuggestions", () => {
  it("routes to the runner for the session's own harness", async () => {
    const parsed = await generateNextStepSuggestions({
      harness: "codex",
      cwd: "/repo",
      transcript: "user: fix the parser",
    });
    expect(runners.codex).toHaveBeenCalledOnce();
    expect(runners.claude).not.toHaveBeenCalled();
    expect(parsed).toEqual([
      { label: "Run the tests", prompt: "Run the test suite." },
    ]);
  });

  it("passes cwd and a bounded timeout", async () => {
    await generateNextStepSuggestions({
      harness: "claude",
      cwd: "/repo",
      transcript: "t",
    });
    const input = runners.claude.mock.calls[0]![0] as {
      cwd: string;
      timeoutMs: number;
    };
    expect(input.cwd).toBe("/repo");
    expect(input.timeoutMs).toBeGreaterThan(0);
    expect(input.timeoutMs).toBeLessThanOrEqual(45_000);
  });

  it("drops providerAccountId for runners that do not take one", async () => {
    // cursor's runner has no providerAccountId field; passing one through
    // would be a type error at the call site, so the adapter strips it.
    await generateNextStepSuggestions({
      harness: "cursor",
      cwd: "/repo",
      transcript: "t",
      providerAccountId: "acct-1",
    });
    const input = runners.cursor.mock.calls[0]![0] as Record<string, unknown>;
    expect("providerAccountId" in input).toBe(false);
    expect(input.cwd).toBe("/repo");
  });

  it("returns null and stays quiet when the runner throws", async () => {
    runners.claude.mockRejectedValue(new Error("binary missing"));
    const parsed = await generateNextStepSuggestions({
      harness: "claude",
      cwd: "/repo",
      transcript: "t",
    });
    expect(parsed).toBeNull();
  });

  it("returns null when the harness has no runner at all", async () => {
    const parsed = await generateNextStepSuggestions({
      harness: "fx",
      cwd: "/repo",
      transcript: "t",
    });
    expect(parsed).toBeNull();
    for (const fn of Object.values(runners)) expect(fn).not.toHaveBeenCalled();
  });

  it("returns null when the answer cannot be parsed", async () => {
    runners.claude.mockResolvedValue("I think you should probably test it?");
    const parsed = await generateNextStepSuggestions({
      harness: "claude",
      cwd: "/repo",
      transcript: "t",
    });
    expect(parsed).toBeNull();
  });

  it("feeds the transcript into the prompt", async () => {
    await generateNextStepSuggestions({
      harness: "claude",
      cwd: "/repo",
      transcript: "assistant: added the parser",
    });
    const input = runners.claude.mock.calls[0]![0] as { prompt: string };
    expect(input.prompt).toContain("added the parser");
  });
});

describe("requestNextStepSuggestions", () => {
  const base = {
    harness: "claude" as const,
    cwd: "/repo",
    blocks: [{ role: "user", text: "fix the parser" }],
  };

  it("commits under the session-and-generation key", async () => {
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 7,
      commit,
    });
    expect(commit).toHaveBeenCalledWith("s1:7", [
      { label: "Run the tests", prompt: "Run the test suite." },
    ]);
  });

  it("spends at most one call per session and generation", async () => {
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 7,
      commit,
    });
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 7,
      commit,
    });
    expect(runners.claude).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
  });

  it("spends a second call for a genuinely new turn", async () => {
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 7,
      commit,
    });
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 8,
      commit,
    });
    expect(runners.claude).toHaveBeenCalledTimes(2);
  });

  it("does not spend a call on a harness with no runner", async () => {
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      harness: "fx",
      sessionId: "s1",
      generation: 1,
      commit,
    });
    expect(runners.claude).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  // The bar keeps the static shortcuts on failure; nothing is committed and
  // no error reaches the user.
  it("commits nothing when the model call fails", async () => {
    runners.claude.mockRejectedValue(new Error("nope"));
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 2,
      commit,
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits nothing when the answer is unparseable", async () => {
    runners.claude.mockResolvedValue("just do the thing");
    const commit = vi.fn();
    await requestNextStepSuggestions({
      ...base,
      sessionId: "s1",
      generation: 3,
      commit,
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("keys by session and generation so a late answer cannot land wrong", () => {
    expect(nextStepSuggestionKey("abc", 4)).toBe("abc:4");
    expect(nextStepSuggestionKey("abc", 4)).not.toBe(
      nextStepSuggestionKey("abc", 5),
    );
    expect(nextStepSuggestionKey("abc", 4)).not.toBe(
      nextStepSuggestionKey("abd", 4),
    );
  });
});
