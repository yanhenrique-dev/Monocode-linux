<p align="center">
  <img src="public/monocode.png" alt="MonoCode Linux" width="88" />
</p>

<h1 align="center">MonoCode Linux</h1>

<p align="center">
  <strong>A desktop interface for your coding agents, Linux only.</strong>
</p>

<p align="center">
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml"><img src="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/releases/latest"><img src="https://img.shields.io/github/v/release/yanhenrique-dev/Monocode-linux?label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-Linux%20x86__64-blue" alt="Linux x86_64" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" /></a>
  <a href="https://ko-fi.com/yanhenriquedev"><img src="https://img.shields.io/badge/Ko--fi-Sponsor-ff5e5b?logo=ko-fi&logoColor=white" alt="Sponsor on Ko-fi" /></a>
</p>

> Fork notice: this project derives from [hardbeat920/monocode](https://github.com/hardbeat920/monocode.git) and is maintained with a Linux-only focus. Credit for the original codebase goes to the upstream author and contributors.

---

## Contents

- [What is it](#what-is-it)
- [Features](#features)
- [Supported providers](#supported-providers)
- [Install](#install)
- [Build from source](#build-from-source)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Contributing](#contributing)
- [License](#license)

## What is it

MonoCode Linux is a desktop app (Tauri + React) that puts your coding agents in one interface. Tabs are sessions, the composer is the input, and each provider runs on its own subscription. The app does not sell tokens.

Packaging, docs, and automation target one platform: Linux x86_64, shipped as an AppImage. This fork supports neither macOS nor Windows.

## Features

- Tabs that work as independent sessions, one per agent.
- A single composer for every provider, with file attachments, mentions, and skills.
- Support for Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, fx, Hermes Agent, and MiniMax Code.
- GPU-accelerated terminal with a master hardware switch in Settings.
- File explorer with preview and side-by-side change review.
- Helper-agent orchestration in isolated directories, with pause, resume, and retry.
- Session history, project groups, reminders, and per-project notifications.
- Update checks with direct download from GitHub Releases.
- Settings in English and Brazilian Portuguese.

## Supported providers

Install and sign in to at least one provider before opening the app:

| Provider | Install | Login |
|---|---|---|
| Claude Code | [claude.com/product/claude-code](https://claude.com/product/claude-code) | `claude auth login` |
| Codex | [developers.openai.com/codex/cli](https://developers.openai.com/codex/cli) | `codex login` |
| Cursor CLI | [cursor.com/cli](https://cursor.com/cli) | `agent login` |
| Grok Build | `curl -fsSL https://x.ai/cli/install.sh \| bash` | `grok login` |
| OpenCode | [opencode.ai](https://opencode.ai) | `opencode auth login` |
| Pi | `npm install -g @earendil-works/pi-coding-agent` | — |
| omp | `curl -fsSL https://omp.sh/install \| sh` | — |
| fx | `curl -fsSL https://fx.sh/setup.sh \| bash` | `fx login` |
| Hermes Agent | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` | `hermes model` |
| MiniMax Code | `curl -fsSL https://filecdn.minimax.chat/public/install.sh \| bash` | `mcode login` |

One provider is enough: the app detects the CLIs at startup and disables the missing ones with an install hint.

## Install

Grab the latest build from [GitHub Releases](https://github.com/yanhenrique-dev/Monocode-linux/releases/latest):

```bash
chmod +x MonoCode_*.AppImage
./MonoCode_*.AppImage
```

It runs on any x86_64 distro, nothing to install.

On Arch Linux there is also the AUR package [`monocode-bin`](https://aur.archlinux.org/packages/monocode-bin) (see [docs/aur.md](docs/aur.md)).

Dependencies and troubleshooting in detail: [docs/linux.md](docs/linux.md).

## Build from source

Requirements:

- Node.js 20 or newer
- Stable Rust toolchain (`rustup default stable`)
- System Tauri/WebKit dependencies (e.g. `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`)

On Ubuntu/Debian, the repo script installs the native dependencies:

```bash
npm run setup:linux
```

Distributable AppImage build (output in `target/release/bundle/appimage/`):

```bash
npm ci
npm run build:linux
```

Per-user desktop install (no `sudo`, no package). Installs the release binary
under `~/.local/bin` and a launcher under `$XDG_DATA_HOME` (`~/.local/share`
when unset):

```bash
npm run install:linux:desktop
```

Remove only those files with `npm run uninstall:linux:desktop`. It does not
touch system paths or the Flatpak/AUR packaging in `packaging/`.

Development mode, with hot-reload:

```bash
npm install
npm run tauri dev
```

Same checks the CI runs:

```bash
npm run check        # web + rust
npm run check:web    # vitest + tsc
npm run check:rust   # cargo fmt, clippy and tests
```

## Usage

1. Open the app and pick a project (or create one).
2. Select the provider and model in the composer.
3. Describe the task. Each tab keeps its own session and history.
4. Follow diffs, terminals, and approvals without leaving the interface.
5. Tune terminal GPU, themes, and notifications in Settings.

## Project structure

```
.
├── src/
│   ├── app/        # app hooks (sessions, tabs, composer, orchestration)
│   ├── chrome/     # window frame (title, sidebar, composer, tabs)
│   ├── surfaces/   # tab panels (transcript, editor, diff, terminal)
│   ├── lib/        # shared libs (harness/, per-provider adapters)
│   └── hooks/      # reusable React hooks
├── src-tauri/
│   ├── src/        # Rust side (PTYs, filesystem/git, sessions, window)
│   └── tauri.linux.conf.json  # Linux Tauri config
├── scripts/
│   └── install-linux-deps.sh  # Ubuntu/Debian dependencies
├── docs/
│   ├── linux.md            # full Linux guide
│   ├── aur.md              # monocode-bin AUR package
│   ├── CONTRIBUTING.md     # how to contribute
│   ├── CODE_OF_CONDUCT.md  # code of conduct
│   └── SECURITY.md         # security policy
└── .github/workflows/  # CI (ci.yml) and release (release.yml), Linux only
```

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite frontend in dev mode |
| `npm run build` | `tsc` + Vite build |
| `npm test` / `test:watch` | Vitest suite |
| `npm run check` | full validation (web + rust) |
| `npm run tauri dev` | desktop app in development |
| `npm run setup:linux` | installs dependencies on Debian/Ubuntu |
| `npm run build:linux` | builds the AppImage |
| `npm run install:linux:desktop` | per-user install: binary + launcher, no sudo |
| `npm run uninstall:linux:desktop` | removes only the per-user install |
| `npm run set-version` | syncs the version across manifests |

## Contributing

The project is maintained by [yanhenrique-dev](https://github.com/yanhenrique-dev), with a Linux focus. Small, focused pull requests are welcome. Large changes deserve an issue first. See how to contribute in [CONTRIBUTING.md](docs/CONTRIBUTING.md) and the conduct rules in [CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md). Report security flaws in private, via [Security Advisories](https://github.com/yanhenrique-dev/Monocode-linux/security/advisories/new). Never open a public issue for those.

## License

[MIT](LICENSE). Provider names and logos are trademarks of their respective owners, see [NOTICE](NOTICE).
