# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.30] - 2026-09-23

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Frontend UI on shadcn-style primitives over Base UI: dialog, popover,
  dropdown/context menus, switch, slider, select, combobox, tabs, toast,
  tooltip and alert-dialog bound to the runtime theme tokens, with the
  previous Modal/Popover/ExplorerMenu APIs preserved.
- Real tooltips (hover + keyboard focus) replacing native `title=` on the
  Composer toolbar, TitleBar, SurfaceTabs, Sidebar, transcript actions and
  Settings-adjacent controls.
- Destructive confirms use `role=alertdialog` with Cancel focused and no
  backdrop dismiss (ConfirmDialog, RemoveProject, archive delete).
- Sessions: installed default provider with availability fallback, live
  in-memory composer drafts over persisted ones (portes #208 e #336).
- `resolveModel` never returns another harness's model; unknown models
  fall back to the harness name in the Sidebar.

### Fixed

- Dialogs trap Tab and restore focus; popovers dismiss on outside press
  and Escape with the previous focus restored.
- Empty live draft no longer resurrects the previous persisted text on
  fast pane remount; switching sessions in the same pane drops the
  previous draft.
- Stale provider account/session ids cleared when the harness fallback
  swaps providers.
- Test mocks hardened against the session↔availability import cycle.

## [0.2.25] - 2026-09-22

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Queued follow-ups render above the Tasks pill; the pill names the
  active phase next to the counter.
- Follow-up default is now Queue: Enter mid-turn waits for the turn to
  finish instead of injecting into the running turn.
- Codex auth-refresh failures show recovery steps instead of the raw
  error; duplicate failure rows collapse into one.
- Transcript file links prefer files the agent actually touched.
- Transcript scroll without jumps: per-turn size estimates, native
  scroll under 40 turns, wider end-zone, adaptive overscan.
- Faster session switching: memoized render boundaries, per-session
  transcript cache, idle hydration, lazy file index.

### Fixed

- Composer jank during streaming: memoized composer/highlight, throttled
  runner measurements, resize early-return.
- Sidebar no longer overlaps Settings during transitions.
- Audible sound-engine diagnosis for AppImage builds.
- Missing frontend dependencies declared in `package.json`.

## [0.2.20] - 2026-09-22

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- GitHub inbox fidelity: `assignedToMe` also covers
  `review-requested:@me` (PRs) and `mentions:@me` (issues); PR detail
  shows a Checks section (in progress, successful, failed, mergeable
  note) from `statusCheckRollup`; incremental snapshots evict stale
  items.
- Transcript virtualization by turn (TanStack Virtual) with gated
  viewport, enable flag, and tests.
- Tasks pill names the active task with a loading spinner and status
  legend; sidebar session rows follow the live checkout branch.
- ESLint 9 flat config baseline (warn-only) so `npm run lint` works.

### Fixed

- Approval toast only for background sessions; focused sessions resolve
  inline on the tool row (Allow/Deny).
- `errorMessage` never throws (safe fallback); `findOrThrow` preserves
  falsy matches; logger storage access guarded.
- Motion consistency: first sidebar open animates, folds animate with
  grid rows only, file pane first paint stays dry.
- CodeRabbit review findings applied across all PRs in this release.

## [0.2.17] - 2026-09-21

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- File clipboard on Linux: `clipboard_file_paths` and
  `copy_file_to_clipboard` now talk to the desktop environment through
  `wl-clipboard` (Wayland) or `xclip` (X11) using `text/uri-list`, so
  pasting files copied in Nautilus/Dolphin into the file tree and copying
  originals out of the image viewer work natively.
- GitHub inbox refresh: background polling with incremental `since`
  snapshots, unread badges, read-mark rollback on storage failure, and
  smooth enter/exit animations behind the experimental flag.
- Follow-up queue evidence: busy follow-ups with behavior Queue land a
  visible card above the input, and steered follow-ups keep their notice
  until the running turn ends.

### Fixed

- Clipboard correctness: helper order follows the active session
  (`WAYLAND_DISPLAY`/`XDG_SESSION_TYPE`) with fallback across helpers;
  URI parsing no longer pre-decodes (`a#b.txt` stays `a#b.txt`).
- Reveal-in-file-manager via `FileManager1.ShowItems` (`gio open` has
  no `--select` flag); `gh` subprocesses get piped stdio; PTY slave
  name uses `libc::c_char`; session database uses atomic `create_new`
  with `0600` only on fresh files; inbox media locks are evicted.
- Window controls always render in the title bar (decorations off left
  rail-open projects without min/max/close); sidebar blur slider drives
  `--sidebar-blur` again; exit animations run `onExit` exactly once;
  background polls honor backoff; invalidated list snapshots never
  overwrite fresh data and merged lists keep `updatedAt` order.

### Removed

- Leftover macOS and Windows code paths from the Linux-only fork:
  `macos.rs` (traffic lights, WindowServer blur, dock badge/menu),
  `windows.rs` (Job Objects), `tray.rs`, the macOS-only native menu in
  `menu.rs`, the macOS pasteboard backend, and the vendored
  `portable-pty` (ConPTY) crate. `pty.rs`, `harness.rs`,
  `external_editor.rs`, `rate_limits.rs`, `notifications.rs`,
  `skills.rs`, `fs/write.rs`, and `lib.rs` keep only their Linux paths;
  the no-op commands `set_traffic_lights_visible`,
  `set_window_background_blur`, `set_dock_badge`, and
  `set_window_glass_enabled` are gone along with the dead `.icns`/`.ico`
  icons and `src-tauri/macos` assets.
- Frontend platform branches: `platform.ts` is now the fixed Linux
  contract (`Ctrl+`, `Alt+`, `Shift+`), `IS_MAC`/`IS_WIN`/
  `HAS_NATIVE_GLASS` and the `is-mac`/`has-native-glass` CSS hooks are
  gone, traffic-light spacers are removed, `Reveal` labels are the file
  manager wording, and the Windows-only close-to-tray setting and tray
  behavior are deleted.

## [0.2.10] - 2026-09-21

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Per-user Linux desktop installer (`scripts/install-linux-desktop.sh`,
  porte #295): installs release binary, launcher and icons to
  `~/.local`, with reinstall/uninstall coverage and Freedesktop
  single-layer escaping.
- Antigravity ACP provider (porte #314): resolves `agy_acp_server.par`,
  normalizes ACP protocol, manages session lifecycle and recovery, adds
  models, skills, icons and transport tests. Unavailable on Windows by
  design (no Windows ACP binary ships).
- Chat message copy and Notes actions (porte #291): attachment-aware
  clipboard copy/paste with size limits, transcript copy buttons,
  async note save with pending/error states.
- Skill file opens match activity label (porte #330): tool rows resolve
  the file from the label, expand `~/` via recognized home, and only
  show a diff preview when preview path matches the opened file.
- Add-to-chat zero-tab fallback (porte #325): with no tabs open, the
  request seeds a new session instead of being dropped.

### Fixed

- CodeRabbit review corrections: strict `previewMatchesFile` (no diff
  for wrong file when label is not a path, e.g. "Edit dependency
  versions"); prompt bubble expansion is keyboard-accessible via a
  dedicated Show more button instead of a click-only div; Inbox header
  and content share `max-w-[1600px]`; `prettyCwd` matches `Users`/`home`
  case-insensitively; `resolveGates` null narrowing in Antigravity
  live tests.
- Inbox PR header full-width (porte #289): detail header uses
  `max-w-[1600px]` to match the Code tab; diff sticky behavior already
  present.

## [0.2.0] - 2026-09-21

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Transparent app icon everywhere: the white tile is gone from the KDE
  menu, tray, favicon, boot splash, README and all bundles (AppImage,
  Flatpak, Arch, macOS/Windows artifacts).
- Live trailing status shimmer: "Compacting context…" animates in the
  transcript while compaction runs instead of leaving the bottom row bare.
- Session filters stay in sync: a toggle flipped in Settings → Archive
  (or another window) now reflects in the open sidebar immediately.
- Persist-then-broadcast everywhere: appearance, UI scale and session
  filters only notify other surfaces after the value actually lands in
  storage, so two editors never disagree.
- Boot paints the stored accent, blur, chat vars and zoom before the
  bundle loads, with each storage read guarded and missing keys keeping
  the CSS defaults.
- Revalidation before confirmed PR actions: a merge/close dialog opened
  before mergeability resolves blocks itself when conflicts or missing
  push access land late.

### Fixed

- Inbox marks read with the freshest stamp so polls stop resurrecting
  unread dots; `gh repo view` pins the origin repo so upstream never wins.
- PR actions disable without push access (repo-scoped, verified against
  the API) and on merge conflicts.
- Task lists keep their key across keyless snapshots and ignore transient
  empties; the runner mascot rides the top of the tasks strip.
- Settings Update row shows last-checked, friendly errors and a stable
  action with badge; honest performance toggles with master hint and a Go
  to Performance link; search reveals focus the row with live regions and
  accent folding; Clear in Keybindings returns focus to the filter.
- Worktrees empty state offers Create, locked trees name their blocker,
  archive filter and full dates; P2 design tokens, type scale and contrast.
- Appearance drag previews revert on abort, picker dismiss and unmount;
  the color picker rewinds its thumb on cancel and never reverts a
  committed pick on unmount.
- Terminal GPU toggle shows the stored value with a master-switch hint;
  provider rows derive the displayed model from the Default badge;
  sound previews document that they play even while muted.
- Context meter hides while compacting (unknown level) and restores on
  failure; pi's post-compact estimate still lands immediately.
- Exact `github.com` host matching for remote URLs (embedded impostor
  hosts and explicit ports handled).

## [0.1.95] - 2026-09-20

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Portable tarball next to the AppImage on every release: raw binary,
  desktop entry, icons and install notes — no AppImage runtime, no
  pacman required (`~/.local` or `/usr/local` install).

## [0.1.94] - 2026-09-20

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Fixed

- Composer tasks pill hides once every task settled instead of pinning
  a dead "Complete" strip above the input.
- Queued-message card fuses with the tasks strip (no double border or
  radius) so strip, queue and input read as one surface.

## [0.1.92] - 2026-09-20

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Per-cue custom notification sounds: each alert (turn finished, inbox
  activity, linked PR/issue activity, update available) can keep its
  built-in cue or use any local audio file, with test/reset controls
  and full pt-BR coverage.
- Browser-preview shim so the app boots outside the native webview
  (inert inside the packaged app).

### Changed

- `fs.rs` split into `src-tauri/src/fs/` domain modules (read, write,
  git, github, omp, path) with no logic changes.

### Fixed

- `read_file_preview` no longer panics on multibyte lines near the
  200-byte cut; truncation now lands on char boundaries.
- Commit view accepts 64-char SHA-256 hashes, matching the rest of
  the git module.

## [0.1.89] - 2026-09-20

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Session review attribution across parallel sessions: shared files are
  grouped per claimant, adopted shell changes stay review-visible.
- Notifications/Performance split in Settings with full pt-BR coverage.
- Composer submit guardrails extracted as named guards with
  characterization tests.

### Fixed

- External links open non-blocking with client-side validation and a
  15s timeout (timed-out helpers are killed and reaped); xdg-open no
  longer inherits the bundled LD_LIBRARY_PATH.
- Busy state of the worktree dialogs announced to assistive tech
  (en/pt-BR).

## [0.1.80] - 2026-09-20

> **Alpha:** MonoCode Linux is in Alpha. Expect breaking changes,
> incomplete features, and rough edges — please report issues.

### Added

- Tasks pill near the composer: surfaces the active task list progress
  and jumps to the running card on click (toggle in Settings).
- F11 toggles fullscreen, browser-style.

### Changed

- Icon system foundation: consistent stroke scale, provider marks, and
  shared aliases across the chrome.
- True chevron glyphs and a lighter taskbar badge fillet for separation
  on dark docks.

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
- Brazilian Portuguese translation for Settings (language selector,
  dates/numbers follow the locale).
- Dual-protocol OpenCode harness (V1/V2 auto-detect, durable prompt,
  nested permissions/questions).

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
