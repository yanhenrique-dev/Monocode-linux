#!/usr/bin/env node
// Builds the Tauri v2 static updater manifest (latest.json) for a release.
//
// Usage:
//   node scripts/make-updater-json.mjs <version> <appimage-path> <sig-path> <out-path> [--channel stable|beta] [--notes-file CHANGELOG.md]
//
// - version: semver without leading v (e.g. 0.2.50)
// - appimage-path: final (repacked) AppImage that users download
// - sig-path: signature file produced by `tauri signer sign` for that AppImage
// - out-path: where to write latest.json
//
// Manifest includes size + sha256 when available, and release notes
// extracted from CHANGELOG.md (fallback generic). Channel selects rollout
// metadata; beta manifests are written to latest-beta.json by release workflow.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

const REPO = "yanhenrique-dev/Monocode-linux";

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flags = argv.filter((a) => a.startsWith("--"));
const [version, appimagePath, sigPath, outPath] = positional;

function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = flags.find((f) => f.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = flags.indexOf(`--${name}`);
  if (idx >= 0 && flags[idx + 1] && !flags[idx + 1].startsWith("--")) return flags[idx + 1];
  return undefined;
}

if (!version || !appimagePath || !sigPath || !outPath) {
  console.error(
    "usage: node scripts/make-updater-json.mjs <version> <appimage> <sig> <out> [--channel stable|beta]",
  );
  process.exit(1);
}

const channel = flagValue("channel") ?? "stable";
if (!["stable", "beta"].includes(channel)) {
  console.error(`invalid channel: ${channel} (expected stable|beta)`);
  process.exit(1);
}

const signature = readFileSync(sigPath, "utf8").trim();
if (!signature) {
  console.error(`empty signature in ${sigPath}`);
  process.exit(1);
}
if (!existsSync(appimagePath)) {
  console.error(`missing AppImage: ${appimagePath}`);
  process.exit(1);
}

const asset = appimagePath.split("/").pop();
const { size } = statSync(appimagePath);
const sha256 = createHash("sha256").update(readFileSync(appimagePath)).digest("hex");

// Extract release notes for version from CHANGELOG.md when present.
function changelogNotes(ver) {
  try {
    const notesFile = flagValue("notes-file") ?? "CHANGELOG.md";
    if (!existsSync(notesFile)) return null;
    const text = readFileSync(notesFile, "utf8");
    const re = new RegExp(`^## \\[${ver}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|\\Z)`, "m");
    const m = text.match(re);
    if (!m) return null;
    const body = m[1].trim().split("\n").slice(0, 40).join("\n").trim();
    return body.length > 2000 ? `${body.slice(0, 2000)}\n…` : body;
  } catch {
    return null;
  }
}

const notes = changelogNotes(version) ?? "See CHANGELOG.md for details.";

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  channel,
  // Staged rollout hint for future client enforcement (percent 0-100).
  rollout: channel === "beta" ? 100 : 100,
  platforms: {
    "linux-x86_64": {
      signature,
      url: `https://github.com/${REPO}/releases/download/v${version}/${asset}`,
      size,
      sha256,
    },
  },
};
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${outPath} for v${version} (${asset}, ${size} bytes, channel=${channel})`);
