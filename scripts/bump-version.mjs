#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: npm run set-version -- 0.1.1");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function replaceFirst(path, pattern, replacement) {
  const text = readFileSync(path, "utf8");
  const next = text.replace(pattern, replacement);
  if (next === text) {
    console.error(`failed to update ${path}`);
    process.exit(1);
  }
  writeFileSync(path, next);
}

replaceFirst(
  join(root, "package.json"),
  /("version": ")[^"]+(")/,
  `$1${version}$2`,
);
// The lockfile carries the version twice: once at the top and once on the
// root package. Missing them left npm's lockfile claiming 0.1.0 sixteen
// releases later. The second pattern is anchored on `packages` because the
// top-level object repeats the same name/version pair.
replaceFirst(
  join(root, "package-lock.json"),
  /^(\{\n\s*"name": "monocode-desktop",\n\s*"version": ")[^"]+(")/,
  `$1${version}$2`,
);
replaceFirst(
  join(root, "package-lock.json"),
  /("packages": \{\n\s*"": \{\n\s*"name": "monocode-desktop",\n\s*"version": ")[^"]+(")/,
  `$1${version}$2`,
);
replaceFirst(
  join(root, "Cargo.toml"),
  /^(version = ")[^"]+(")/m,
  `$1${version}$2`,
);
replaceFirst(
  join(root, "src-tauri/tauri.conf.json"),
  /("version": ")[^"]+(")/,
  `$1${version}$2`,
);
replaceFirst(
  join(root, "Cargo.lock"),
  /(name = "monocode"\nversion = ")[^"]+(")/,
  `$1${version}$2`,
);
// Packaging pins the same version: Flathub manifest tag, native Arch
// PKGBUILD, and the Flatpak metainfo release entry. Resolve the tag's commit
// SHA BEFORE writing anything: a missing tag or network failure must never
// leave `tag` and `commit` pointing at different versions.
const flatpakSha = await fetch(
  `https://api.github.com/repos/yanhenrique-dev/Monocode-linux/git/refs/tags/v${version}`,
  { headers: { "User-Agent": "monocode-bump-version" } },
)
  .then((res) => (res.ok ? res.json() : null))
  .then((ref) => ref?.object?.sha ?? null)
  .catch((error) => {
    console.warn(`could not resolve tag v${version}: ${error.message}`);
    return null;
  });
if (flatpakSha) {
  replaceFirst(
    join(root, "packaging/flatpak/com.monocode.desktop.yml"),
    /^(\s*tag: v)[\d.]+/m,
    `$1${version}`,
  );
  replaceFirst(
    join(root, "packaging/flatpak/com.monocode.desktop.yml"),
    /^(\s*commit: )[0-9a-f]{40}/m,
    `$1${flatpakSha}`,
  );
} else {
  // Bumping ahead of a release (tag not pushed yet): keep the previous
  // tag+commit pair untouched so the manifest stays self-consistent.
  console.warn(
    `tag v${version} not found upstream; Flatpak tag/commit pins untouched`,
  );
}
replaceFirst(
  join(root, "packaging/archlinux/monocode/PKGBUILD"),
  /^(pkgver=)[\d.]+/m,
  `$1${version}`,
);
replaceFirst(
  join(root, "packaging/flatpak/com.monocode.desktop.metainfo.xml"),
  /(<release version=")[\d.]+(" date=")\d{4}-\d{2}-\d{2}(")/,
  `$1${version}$2${new Date().toISOString().slice(0, 10)}$3`,
);

console.log(`version ${version}`);
console.log(
  "remember: regen packaging/archlinux/monocode/.SRCINFO on Arch " +
    "(makepkg --printsrcinfo > .SRCINFO) and bump packaging/aur/monocode-bin " +
    "separately (docs/aur.md).",
);
