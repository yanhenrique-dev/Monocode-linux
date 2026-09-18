#!/usr/bin/env node
// Builds the Tauri v2 static updater manifest (latest.json) for a release.
//
// Usage:
//   node scripts/make-updater-json.mjs <version> <appimage-path> <sig-path> <out-path>
//
// - version: semver without leading v (e.g. 0.1.67)
// - appimage-path: final (repacked) AppImage that users download
// - sig-path: signature file produced by `tauri signer sign` for that AppImage
// - out-path: where to write latest.json
//
// The asset URL targets the GitHub Release that will host these files, so
// this must run before `gh release create` uploads them.
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "yanhenrique-dev/Monocode-linux";

const [version, appimagePath, sigPath, outPath] = process.argv.slice(2);
if (!version || !appimagePath || !sigPath || !outPath) {
  console.error(
    "usage: node scripts/make-updater-json.mjs <version> <appimage> <sig> <out>",
  );
  process.exit(1);
}

const signature = readFileSync(sigPath, "utf8").trim();
if (!signature) {
  console.error(`empty signature in ${sigPath}`);
  process.exit(1);
}
const asset = appimagePath.split("/").pop();
const manifest = {
  version,
  notes: "See CHANGELOG.md for details.",
  pub_date: new Date().toISOString(),
  platforms: {
    "linux-x86_64": {
      signature,
      url: `https://github.com/${REPO}/releases/download/v${version}/${asset}`,
    },
  },
};
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${outPath} for v${version} (${asset})`);
