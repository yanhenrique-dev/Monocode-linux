#!/usr/bin/env node
/**
 * Write the project version to every pin listed in version-sources.mjs.
 *
 *   npm run set-version -- 0.1.1
 *
 * The pin list is shared with check-version.mjs, so a new pin cannot be
 * checked without also being written, or written without being checked. This
 * script used to write eight files and print a reminder asking you to handle
 * two more by hand; the AUR package sat 33 releases behind because of that
 * reminder, and the Flatpak manifest 55.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION_SOURCES } from "./version-sources.mjs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: npm run set-version -- 0.1.1");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function writePin(pin, text) {
  const next = pin.write(text, version);
  if (next === text) {
    console.error(`failed to update ${pin.label}: no replacement made`);
    process.exit(1);
  }
  writeFileSync(join(root, pin.file), next);
}

let written = 0;
for (const pin of VERSION_SOURCES) {
  const path = join(root, pin.file);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`failed to update ${pin.label}: cannot read ${pin.file}`);
    process.exit(1);
  }
  // The Flatpak tag is resolved with its commit below; a manifest whose tag
  // moved but whose commit did not is worse than one left alone.
  if (pin.file === "packaging/flatpak/com.monocode.desktop.yml") continue;
  writePin(pin, text);
  written += 1;
}

// The Flatpak manifest pins a tag *and* the commit that tag points at, so
// they have to move together. Resolve the SHA BEFORE writing the tag: a
// missing tag or a network failure must never leave the pair inconsistent.
const flatpak = VERSION_SOURCES.find(
  (pin) => pin.file === "packaging/flatpak/com.monocode.desktop.yml",
);
const flatpakPath = join(root, flatpak.file);
let flatpakText = readFileSync(flatpakPath, "utf8");
const sha = await fetch(
  `https://api.github.com/repos/yanhenrique-dev/Monocode-linux/git/refs/tags/v${version}`,
  { headers: { "User-Agent": "monocode-bump-version" } },
)
  .then((res) => (res.ok ? res.json() : null))
  .then((ref) => ref?.object?.sha ?? null)
  .catch((error) => {
    console.warn(`could not resolve tag v${version}: ${error.message}`);
    return null;
  });

if (sha) {
  writePin(flatpak, flatpakText);
  written += 1;
  flatpakText = readFileSync(flatpakPath, "utf8").replace(
    /^(\s*commit: )[0-9a-f]{40}/m,
    `$1${sha}`,
  );
  writeFileSync(flatpakPath, flatpakText);
} else {
  // Bumping ahead of a release: leave tag and commit together rather than
  // pointing one at a tag the other does not describe.
  console.warn(
    `tag v${version} not found upstream; Flatpak tag/commit pair left untouched`,
  );
}

console.log(
  `version ${version} written to ${written} of ${VERSION_SOURCES.length} pins`,
);
console.log(
  "remaining: regen packaging/archlinux/monocode/.SRCINFO on Arch " +
    "(makepkg --printsrcinfo > .SRCINFO) if the PKGBUILD metadata changed",
);
