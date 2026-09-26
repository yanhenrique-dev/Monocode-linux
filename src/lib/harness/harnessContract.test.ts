import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_EXEC_ARGS,
  DECLARED_EXEC_INTENTS,
  HARNESS_EXEC,
  SERVE_PASSWORD,
  isAllowedExecArgs,
} from "./harnessContract";
import { openCodeBasicAuth } from "./opencodeClient";

const here = dirname(fileURLToPath(import.meta.url));
const harnessDir = here;

/**
 * Each assertion below corresponds to a defect that shipped: the two sides of
 * this boundary disagreed, nothing tied them together, and the backend's own
 * test asserted its list against itself. These tests read the shared artifact
 * instead, so a change on one side that is not made on the other fails here.
 */
describe("the Rust <-> TypeScript contract", () => {
  describe("harness_exec", () => {
    it("permits every argument vector this app declares", () => {
      // The one that shipped in 0.2.55: `api get /api/model` was a vector the
      // frontend sent and the backend refused, so no V2 model ever loaded and
      // the catalog came back empty with no error.
      for (const intent of DECLARED_EXEC_INTENTS) {
        expect(
          isAllowedExecArgs(HARNESS_EXEC[intent]),
          `"${intent}" (${JSON.stringify(HARNESS_EXEC[intent])}) is not permitted by the contract`,
        ).toBe(true);
      }
    });

    it("declares no vector twice", () => {
      const seen = new Set<string>();
      for (const intent of DECLARED_EXEC_INTENTS) {
        const key = JSON.stringify(HARNESS_EXEC[intent]);
        expect(seen.has(key), `${intent} duplicates an earlier intent: ${key}`).toBe(false);
        seen.add(key);
      }
    });

    it("matches on length and order, not as a prefix", () => {
      // Mirrors `contract::tests::refuses_anything_the_contract_does_not_declare`
      // on the provider side, so the rule cannot mean one thing in Rust and
      // another here.
      expect(isAllowedExecArgs([])).toBe(false);
      expect(isAllowedExecArgs(["api"])).toBe(false);
      expect(isAllowedExecArgs(["api", "get"])).toBe(false);
      expect(isAllowedExecArgs(["api", "post", "/api/model"])).toBe(false);
      expect(isAllowedExecArgs(["--json", "models"])).toBe(false);
      expect(isAllowedExecArgs(["models", "--json", "--verbose"])).toBe(false);
    });

    it("has no call site passing a literal past the contract", () => {
      // The catalog above is the only place a vector may be written. A literal
      // handed straight to execChild is a vector this test cannot see, which is
      // exactly how the original drift became invisible.
      const offenders: string[] = [];
      for (const file of readdirSync(harnessDir)) {
        if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
        const source = readFileSync(join(harnessDir, file), "utf8");
        // Match the argument list of an execChild call, allowing it to span
        // lines as the multi-line calls do.
        for (const match of source.matchAll(/execChild\(([\s\S]{0,120}?),\s*cwd/g)) {
          if (/\[/.test(match[1])) {
            offenders.push(`${file}: execChild(${match[1].replace(/\s+/g, " ").trim()}, …)`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it("keeps the artifact's own list non-empty and well-formed", () => {
      expect(ALLOWED_EXEC_ARGS.length).toBeGreaterThan(0);
      for (const entry of ALLOWED_EXEC_ARGS) {
        expect(entry.length).toBeGreaterThan(0);
        for (const arg of entry) expect(typeof arg).toBe("string");
      }
    });
  });

  describe("serve_password", () => {
    it("sends the credential the contract states", () => {
      // The 401: V2 requires Basic auth on every route, so a client that
      // resolved the endpoint but dropped the password failed on its first
      // model fetch. Asserting against the artifact means a change to the
      // scheme or username cannot pass unnoticed.
      const header = openCodeBasicAuth("hunter2");
      expect(header.startsWith(`${SERVE_PASSWORD.scheme} `)).toBe(true);
      const decoded = atob(header.slice(SERVE_PASSWORD.scheme.length + 1));
      expect(decoded).toBe(`${SERVE_PASSWORD.user}:hunter2`);
    });

    it("does not treat an empty password as a credential", () => {
      // Absence must stay distinguishable from empty: sending
      // `opencode:` is a rejected credential, not an anonymous request.
      expect(openCodeBasicAuth("")).not.toBe(openCodeBasicAuth("x"));
    });
  });

  describe("default_cwd", () => {
    it("is treated as a suggestion, never as a chosen project", () => {
      // The phantom `bin` project: the backend returned the app's own install
      // directory and the frontend offered it as a default, so it landed in the
      // user's recents and project rail uninvited. The provider now refuses the
      // install directory; this asserts the consumer still gates what it gets.
      const source = readFileSync(join(here, "..", "..", "app", "useSessionSync.ts"), "utf8");
      const call = source.indexOf('invoke<string>("default_cwd")');
      expect(call).toBeGreaterThan(-1);
      const after = source.slice(call, call + 240);
      expect(after).toContain("looksLikeProject");
      // The guard must come before the value is adopted.
      expect(after.indexOf("looksLikeProject")).toBeLessThan(after.indexOf("setProjectCwd"));
    });
  });

  describe("harness_sse_open", () => {
    it("forwards the frame name to the consumer", () => {
      // The dropped `event:` field. V2 carries the event discriminator in the
      // SSE frame name, so a consumer that receives only `data` cannot tell a
      // text delta from a tool result when a payload omits its own `type`.
      const source = readFileSync(join(harnessDir, "child.ts"), "utf8");
      expect(source).toMatch(/onData\(frame\.data,\s*frame\.name\)/);
    });
  });
});
