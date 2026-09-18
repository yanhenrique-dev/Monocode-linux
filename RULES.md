# MonoCode Linux — Project Rules

Working agreements for contributors and coding agents. Highest priority first.

## HIGH — Think all of Linux, never one environment

Every fix, feature, and workaround MUST target Linux as a whole: all
distributions (Debian/Ubuntu, Fedora, Arch/CachyOS, …), all desktop
environments (KDE Plasma, GNOME, XFCE, Cinnamon, …), and both Wayland and
X11 sessions.

- Do NOT scope a fix to a single distro, desktop, or display server unless
  the bug is proven exclusive to it — and document that proof.
- Prefer host-provided system integration (libraries, `xdg-open`, MIME
  handlers, portals) over bundling era-pinned copies that rot.
- When a bug only reproduces on one setup, still frame docs, comments, and
  changelogs in environment-agnostic terms; name the setup as an example,
  never as the whole story.
- Validate thinking across environments: "does this hold on old LTS and on
  rolling release? on Wayland and X11? with and without a compositor?"

## Linux-only scope

This fork ships Linux x86_64 AppImage builds only. Do not add macOS or
Windows install/build/release paths, configs, or docs.

## Changes go through pull requests

Never push directly to `main`. One focused PR per fix or feature, with
validation evidence (`tsc`, test suite, and `cargo` checks when Rust or
packaging is touched).

## Keep the fast paths fast

- No synchronous IPC, disk writes, or layout reads inside per-frame,
  per-keystroke, or per-pointermove handlers — preview cheaply, commit on
  release.
- Preserve the existing performance contracts when porting upstream code
  (memoized rows, rAF-throttled previews, `content-visibility` discipline).
- Prefer silence-free failure modes: surface a hint instead of dropping
  user actions quietly.
