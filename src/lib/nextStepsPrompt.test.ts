import { describe, expect, it } from "vitest";
import {
  buildNextStepsPrompt,
  cleanLabel,
  cleanPrompt,
  parseNextStepSuggestions,
} from "./nextStepsPrompt";

describe("buildNextStepsPrompt", () => {
  it("includes the transcript tail", () => {
    const prompt = buildNextStepsPrompt("user: add a login form");
    expect(prompt).toContain("add a login form");
  });

  it("truncates a very long transcript instead of sending it whole", () => {
    const prompt = buildNextStepsPrompt("x".repeat(50_000));
    expect(prompt).toContain("[truncated]");
    expect(prompt.length).toBeLessThan(20_000);
  });

  it("asks for JSON only and forbids the model calling tools", () => {
    const prompt = buildNextStepsPrompt("anything");
    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Do not call tools");
  });
});

describe("cleanLabel", () => {
  it("strips quoting and markdown noise", () => {
    expect(cleanLabel('**"Run the tests"**')).toBe("Run the tests");
  });

  it("keeps only the first line", () => {
    expect(cleanLabel("Run the tests\nand then lint")).toBe("Run the tests");
  });

  it("truncates a label that is too long", () => {
    expect(cleanLabel("a".repeat(80))).toHaveLength(48);
  });

  it("rejects an empty label", () => {
    expect(cleanLabel("   ")).toBe("");
  });
});

describe("cleanPrompt", () => {
  it("strips wrapping quotes", () => {
    expect(cleanPrompt('"add a test for the parser"')).toBe(
      "add a test for the parser",
    );
  });

  it("rejects a prompt carrying JSON braces", () => {
    expect(cleanPrompt('return {"a":1}')).toBe("");
  });

  it("truncates a prompt that is too long", () => {
    expect(cleanPrompt("b".repeat(1_000))).toHaveLength(400);
  });

  it("rejects an empty prompt", () => {
    expect(cleanPrompt("  ")).toBe("");
  });
});

describe("parseNextStepSuggestions", () => {
  it("reads the documented shape", () => {
    const parsed = parseNextStepSuggestions(
      '{"suggestions":[{"label":"Run the tests","prompt":"Run the test suite."}]}',
    );
    expect(parsed).toEqual([
      { label: "Run the tests", prompt: "Run the test suite." },
    ]);
  });

  it("tolerates a code fence around the JSON", () => {
    const parsed = parseNextStepSuggestions(
      '```json\n{"suggestions":[{"label":"Lint","prompt":"Run the linter."}]}\n```',
    );
    expect(parsed).toHaveLength(1);
  });

  it("keeps good entries and drops unusable ones", () => {
    const parsed = parseNextStepSuggestions(
      JSON.stringify({
        suggestions: [
          { label: "Good", prompt: "Do the good thing." },
          { label: "", prompt: "No label." },
          { label: "No prompt" },
          { label: "Junk", prompt: '{"json":true}' },
          "not an object",
          { label: "Second", prompt: "Do another thing." },
        ],
      }),
    );
    expect(parsed?.map((s) => s.label)).toEqual(["Good", "Second"]);
  });

  it("never returns more than three", () => {
    const parsed = parseNextStepSuggestions(
      JSON.stringify({
        suggestions: Array.from({ length: 9 }, (_, i) => ({
          label: `L${i}`,
          prompt: `P${i}`,
        })),
      }),
    );
    expect(parsed).toHaveLength(3);
  });

  it("collapses two suggestions that send the same text", () => {
    const parsed = parseNextStepSuggestions(
      JSON.stringify({
        suggestions: [
          { label: "First", prompt: "Run the tests." },
          { label: "Also tests", prompt: "run the tests." },
        ],
      }),
    );
    expect(parsed).toHaveLength(1);
  });

  it("returns null when there is nothing usable", () => {
    expect(parseNextStepSuggestions("no json here")).toBeNull();
    expect(parseNextStepSuggestions("{ broken")).toBeNull();
    expect(parseNextStepSuggestions('{"suggestions":[]}')).toBeNull();
    expect(parseNextStepSuggestions('{"other":1}')).toBeNull();
    expect(
      parseNextStepSuggestions('{"suggestions":[{"label":"x"}]}'),
    ).toBeNull();
  });
});
