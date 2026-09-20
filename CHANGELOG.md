# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.75] - 2026-09-20

### Added

- MiniMax Code (mcode) harness over ACP: binary resolve, session
  lifecycle, ACP events, catalog, picker height and models.
- Amend last commit in the Changes panel, with HEAD message prefill
  and a pushed-commit guard.
- Uniform model controls: Menu/Beside pills (effort, variant, fast,
  thinking, service tier, context), `Extra High` variant labels with
  low-to-high ordering, favorites provenance, and direct model list
  in beside mode.
- Custom pets management in Settings (add, remove, hide).
- Font-smoothing auto on Linux.

### Fixed

- Model submenu overlapping the parent glass (positive gap) and
  provider icon consistency (unique SVG ids, optical padding).
- HarnessIcon compiles with the mcode branch on every lineage.

## [0.1.70] - 2026-09-19

### Added

- Git worktrees: backend (list/create/rename/remove + session journal)
  and frontend (pickers, switching, removal, draft auto-create,
  Worktrees page).
- Tauri auto-update wiring: signed `latest.json` manifest, updater
  pubkey, and signing secrets in the release workflow.
- AUR package `monocode-bin` (AppImage + docs).
- Interface blur row shows disabled with a hint while Hardware
  acceleration is off.
- Chat background blur slider.
- Confirm before deleting an archived conversation.

### Changed

- Popover blur reduced from xl to md: same frosted feel, less glow.
- Blur-off states (toggle and hardware-reduced) use opaque fills, so
  popovers and modals no longer turn transparent.

### Fixed

- External links open in the browser: the launcher now scrubs
  `LD_LIBRARY_PATH` so host `kde-open` stops crashing on it.
- Context meter no longer shows a duplicated native tooltip.
- Spawn/removal race guard between harness processes and worktree
  deletion, plus worktree frontend fixes (committed hooks, stuck
  preparing flag, `"~"` project mapping, removed-worktree memo).
- WebGL probe cache test seam.

## [0.1.67] - 2026-09-18

### Added

- Command palette (`>`) with a Reload action.
- Clock timestamps on user messages, including card-only ones.
- Interface blur toggle in Appearance (also gates glass blur on
  WebKitGTK software compositing).
- Ko-fi donate button (Sponsor + README badge).
- Usage footer refreshes at turn end without token refresh.
- Sticky inbox PR header with full-width diffs in the Code tab.
- New project icon (app, menu, README and favicon).

### Fixed

- Image paste on WebKitGTK/Wayland when the webview hides clipboard
  types: the async clipboard read is now attempted instead of silently
  dropping the image.
- Stale approval requests are settled when turns end, so old Allow/Deny
  controls stop being actionable.
- Open editors reconcile on the first mtime sample instead of only
  establishing a baseline.
- OpenCode connection: serve env, tolerant catalog, idle ends the turn.
- Removed the bundled xdg-open: links open in the browser on Plasma 6.
- Render performance batch: coalesced workspace nudges, frame budget
  (rAF/memoization), and glass/composite sweep.

## [0.1.61] - 2026-09-18

### Fixed

- Black window on recent Mesa/Wayland systems (EGL_BAD_PARAMETER): the
  release AppImage no longer bundles the stale Ubuntu 22.04
  `libwayland-client`, so the host EGL stack initializes correctly.

## [0.1.60] - 2026-09-18

### Added

- Image paste fallback in the composer: when the webview hides clipboard
  files, the app tries the async clipboard API, and failures now show a
  hint instead of dying silent.

### Fixed

- Smoother transcript streaming and scrolling: memoized turn grouping,
  cached viewport sync, stable Mermaid renders, no backdrop blur on the
  jump-to-latest button, and animations paused while scrolling.
- Smoother Settings: appearance state moved out of the root, memoized
  sliders/toggles, preview/commit split (persist and IPC only on release),
  and throttled blur IPC and color-picker drags.
- Sash resize no longer freezes the Preview pane: `is-resizing` cutouts,
  throttled terminal resizes, paused arcade and outline measurements.
- Build button no longer sticks on Building after a superseded or failed
  turn: orphaned plan builds reset to ready.
- Removed the duplicated centered window title on Linux.
- Pixel mascots render at integer scale (16px) instead of distorted
  fractional sizes.
- Higher contrast rail and action icons.

### Changed

- Releases focus on AppImage only: `.deb` builds, docs, and install
  instructions removed (`npm run build:linux`, `setup:linux`).

## [0.1.50] - 2026-09-17

### Added

- Initial release of MonoCode Linux: desktop UI for coding agents (Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, fx, Hermes Agent), Linux only.
- Native `.deb` and AppImage packaging, Ubuntu/Debian dependency helper (`npm run setup:linux:deb`), and Linux guide in `docs/linux.md`.
- GPU terminal rendering with a master hardware-acceleration switch in Settings.

[Unreleased]: https://github.com/yanhenrique-dev/Monocode-linux/compare/v0.1.75...HEAD
[0.1.75]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.75
[0.1.70]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.70
[0.1.67]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.67
[0.1.61]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.61
[0.1.60]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.60
[0.1.50]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.50
