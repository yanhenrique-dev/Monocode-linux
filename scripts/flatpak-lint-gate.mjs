#!/usr/bin/env node
// Gates `flatpak-builder-lint manifest` output: fails on any error outside
// the documented baseline. Every baseline entry needs a justification in
// docs/flathub.md (Flathub exception request or accepted trade-off); new
// findings must be triaged, never silently appended here.
//
// Usage:
//   flatpak-builder-lint manifest <manifest> > lint.json
//   node scripts/flatpak-lint-gate.mjs lint.json
import { readFileSync } from "node:fs";

const BASELINE = new Set([
  // App ID is the established Tauri identifier across .deb/AUR/updater.
  "appid-ends-with-lowercase-desktop",
  // No owned domain for the rDNS ID (see docs/flathub.md).
  "appid-url-not-reachable",
  // IDE needs the whole home (arbitrary project dirs at runtime).
  "finish-args-home-filesystem-access",
  // Provider CLIs, login shell, git and xdg-open run on the host.
  "finish-args-flatpak-spawn-access",
]);

const [lintPath] = process.argv.slice(2);
if (!lintPath) {
  console.error("usage: node scripts/flatpak-lint-gate.mjs <lint-json>");
  process.exit(1);
}

const report = JSON.parse(readFileSync(lintPath, "utf8"));
const errors = report.errors ?? [];
const unexpected = errors.filter((id) => !BASELINE.has(id));
if (unexpected.length > 0) {
  console.error(`new flatpak lint errors: ${unexpected.join(", ")}`);
  console.error("triage them in docs/flathub.md before extending the baseline");
  process.exit(1);
}
const stale = [...BASELINE].filter((id) => !errors.includes(id));
for (const id of stale) {
  console.log(`note: baseline entry no longer reported (${id}) — consider removing it`);
}
console.log(`flatpak lint gate passed (${errors.length} known errors, 0 new)`);
