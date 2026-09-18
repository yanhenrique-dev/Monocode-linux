# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/yanhenrique-dev/Monocode-linux/compare/v0.1.60...HEAD
[0.1.60]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.60
[0.1.50]: https://github.com/yanhenrique-dev/Monocode-linux/releases/tag/v0.1.50
