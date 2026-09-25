#!/usr/bin/env node
/**
 * Verify every version pin in the project agrees.
 *
 *   node scripts/check-version.mjs [expected]
 *
 * With no argument the expected version is read from package.json, so this is
 * a self-consistency check that can run in CI, in a pre-commit hook, or by
 * hand. With an argument it also checks that the release tag matches, which is
 * what the release workflow needs.
 *
 * Every pin in version-sources.mjs is reported, not just the first mismatch,
 * because the failure mode this replaces was a pin nobody was checking.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION_SOURCES } from "./version-sources.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Strip the leading "v" a release tag carries. */
const expected = (process.argv[2] ?? "").replace(/^v/, "") ||
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`not a version: ${expected}`);
  process.exit(2);
}

const mismatched = [];
const unreadable = [];

for (const source of VERSION_SOURCES) {
  let text;
  try {
    text = readFileSync(join(root, source.file), "utf8");
  } catch {
    unreadable.push({ label: source.label, file: source.file });
    continue;
  }
  const found = source.read(text);
  if (found == null) {
    unreadable.push({ label: source.label, file: source.file });
  } else if (found !== expected) {
    mismatched.push({ label: source.label, found });
  }
}

if (unreadable.length > 0) {
  console.error(`could not read a version from:`);
  for (const { label } of unreadable) console.error(`  ${label}`);
}

if (mismatched.length > 0) {
  console.error(`version ${expected} does not match every pin:`);
  for (const { label, found } of mismatched) {
    console.error(`  ${label} is ${found}`);
  }
}

if (unreadable.length > 0 || mismatched.length > 0) {
  console.error(
    `\nfix with: node scripts/bump-version.mjs ${expected}\n` +
      "then re-run makepkg --printsrcinfo on Arch if the PKGBUILD metadata changed",
  );
  process.exit(1);
}

console.log(`version ${expected} agrees across ${VERSION_SOURCES.length} pins`);
