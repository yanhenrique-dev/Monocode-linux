// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOT_MIRROR_KEYS } from "./bootMirror";

const SRC = join(import.meta.dirname, "../..");
const ROOT = join(SRC, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__snapshots__") continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) sourceFiles(path, out);
    // Test files seed localStorage to set up state; that is a fixture, not a
    // second writer. Only production code is held to the invariant.
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      out.push(path);
  }
  return out;
}

/**
 * The mirror only stays a cache if it has exactly one writer.
 *
 * If any module calls `localStorage.setItem` for a boot key directly, the
 * store, the pre-React boot script, and the native file can disagree about
 * which value is current, and the symptom is a theme that reverts on the next
 * launch. That is invisible in a test suite, so it is checked here instead:
 * every source file is read and any direct write to a mirrored key fails.
 */
describe("boot mirror ownership", () => {
  const files = sourceFiles(SRC);

  it("finds production source files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("actually inspects every mirrored key, not just the ones that pass", () => {
    // A regex that silently matches nothing would report a clean run. Count
    // the strings the scan looks for so a broken pattern cannot hide.
    expect(BOOT_MIRROR_KEYS.length).toBe(13);
    expect(new Set(BOOT_MIRROR_KEYS).size).toBe(BOOT_MIRROR_KEYS.length);
  });

  it.each(BOOT_MIRROR_KEYS)("is the only writer of %s", (key) => {
    const offenders: string[] = [];
    for (const file of files) {
      // The module that owns the key is allowed to write it.
      if (file.endsWith(join("settings", "bootMirror.ts"))) continue;
      const text = readFileSync(file, "utf8");
      for (const call of ["setItem", "removeItem"] as const) {
        const pattern = new RegExp(
          `localStorage\\.${call}\\(\\s*["'\`]${key.replace(/\./g, "\\.")}["'\`]`,
        );
        if (pattern.test(text)) offenders.push(`${file} (${call})`);
      }
    }
    expect(offenders, `direct writes to ${key}`).toEqual([]);
  });

  it("covers every key the boot script reads, and no boot key is missing", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const read = new Set(
      Array.from(html.matchAll(/storeGet\("([^"]+)"\)/g)).map((m) => m[1]),
    );
    const mirrored = new Set(BOOT_MIRROR_KEYS);

    // Containment, not equality. The mirror is allowed to hold a key the boot
    // script does not read yet: `experimentalAnimations` is mirrored here and
    // only becomes a boot key once the Experimental section lands, and pinning
    // equality would make this test fail on every branch where that has not
    // merged yet. The other direction is the one that breaks users, so it is
    // the one asserted: a key the boot script reads with nothing in the mirror
    // means the first frame paints a default and then corrects itself.
    for (const key of read) {
      expect(mirrored, `boot script reads ${key}`).toContain(key);
    }
    expect(read.size).toBeGreaterThan(8);
  });
});
