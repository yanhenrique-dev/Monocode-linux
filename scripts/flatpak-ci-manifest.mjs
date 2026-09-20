#!/usr/bin/env node
// Derives a CI validation manifest from packaging/flatpak/com.monocode.desktop.yml
// by swapping the `monocode` module's git-tag source for a local directory
// source. Rationale: the release tag pinned in the manifest may not exist yet
// on the branch under test, and CI should not clone the whole history just to
// validate YAML structure and the remaining (node toolchain) downloads.
//
// Usage:
//   node scripts/flatpak-ci-manifest.mjs <in-manifest> <repo-dir> <out-manifest>
import { readFileSync, writeFileSync } from "node:fs";

const [inPath, repoDir, outPath] = process.argv.slice(2);
if (!inPath || !repoDir || !outPath) {
  console.error(
    "usage: node scripts/flatpak-ci-manifest.mjs <in-manifest> <repo-dir> <out-manifest>",
  );
  process.exit(1);
}

const lines = readFileSync(inPath, "utf8").split("\n");
const start = lines.findIndex((line) => line.trim() === "- type: git");
if (start === -1) {
  console.error(`no git source block found in ${inPath}`);
  process.exit(1);
}
let end = start;
while (
  end + 1 < lines.length &&
  /^\s+(url|tag|commit|branch|disable-shallow-clone):/.test(lines[end + 1])
) {
  end += 1;
}
const indent = lines[start].slice(0, lines[start].indexOf("-"));
const replacement = [
  `${indent}- type: dir`,
  `${indent}  path: ${repoDir}`,
];
lines.splice(start, end - start + 1, ...replacement);
writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`wrote ${outPath} (git source -> dir ${repoDir})`);
