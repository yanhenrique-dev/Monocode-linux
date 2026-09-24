<p align="center">
  <img src="public/monocode.png" alt="MonoCode Linux logo" width="88" />
</p>

<h1 align="center">MonoCode Linux</h1>

<p align="center">
  <strong>One Linux desktop for your coding agents.</strong><br />
  Keep provider sessions, code changes, terminals, and reviews in one workspace.
</p>

<p align="center">
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/releases/latest">
    <img
      src="https://img.shields.io/github/download/yanhenrique-dev/Monocode-linux/releases/latest?style=for-the-badge&color=2ea44f&label=Download%20for%20Linux"
      alt="Download MonoCode for Linux"
    />
  </a>
</p>

<p align="center">
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml">
    <img
      src="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml/badge.svg?branch=main"
      alt="MonoCode CI build status"
    />
  </a>
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/releases/latest">
    <img
      src="https://img.shields.io/github/v/release/yanhenrique-dev/Monocode-linux?label=release&style=flat"
      alt="Latest MonoCode release"
    />
  </a>
  <img
    src="https://img.shields.io/badge/platform-Linux%20x86__64-24292e?style=flat"
    alt="Supported platform: Linux x86_64"
  />
  <a href="LICENSE">
    <img
      src="https://img.shields.io/badge/license-MIT-8b5cf6?style=flat"
      alt="License: MIT"
    />
  </a>
</p>

<p align="center">
  <img
    src="https://img.shields.io/badge/Tauri-2-24c8db?style=flat&logo=tauri&logoColor=white"
    alt="Built with Tauri 2"
  />
  <img
    src="https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react&logoColor=black"
    alt="Built with React 19"
  />
  <img
    src="https://img.shields.io/badge/Rust-2021-dea584?style=flat&logo=rust&logoColor=white"
    alt="Built with Rust 2021"
  />
  <a href="https://ko-fi.com/yanhenriquedev">
    <img
      src="https://img.shields.io/badge/Ko--fi-Sponsor-ff5e5b?style=flat&logo=ko-fi&logoColor=white"
      alt="Sponsor MonoCode on Ko-fi"
    />
  </a>
</p>

> **Fork notice:** MonoCode Linux derives from
> [hardbeat920/monocode](https://github.com/hardbeat920/monocode) and focuses on
> Linux. See the upstream project and its contributors for the original work.

<p align="center">
  <a href="docs/monocode-loading.gif">
    <img
      src="docs/monocode-loading.gif"
      alt="MonoCode loading animation"
      width="420"
    />
  </a>
</p>

## Start here

- [Download the latest AppImage](https://github.com/yanhenrique-dev/Monocode-linux/releases/latest).
- [Install the Arch Linux AUR package](docs/aur.md).
- [Set up Linux and troubleshoot dependencies](docs/linux.md).
- [Build MonoCode from source](#build-from-source).
- [Read the contribution guide](docs/CONTRIBUTING.md).
- [Report a bug](https://github.com/yanhenrique-dev/Monocode-linux/issues/new/choose).
- [Report a security issue privately](https://github.com/yanhenrique-dev/Monocode-linux/security/advisories/new).

## What MonoCode Linux does

Use MonoCode Linux when you want one desktop workspace for coding-agent CLIs.
This guide helps you install, configure, and build the app. MonoCode connects to
your existing provider accounts and does not sell tokens.

The app, continuous integration (CI), releases, and packaging target Linux
x86_64. Releases ship as AppImages. This fork does not support macOS or Windows.

## Features

- Run independent provider sessions in tabs.
- Attach files, mention project paths, and use skills in one composer.
- Switch between Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, fx,
  Hermes Agent, MiniMax Code, and Antigravity.
- Explore projects, edit files, and review side-by-side changes.
- Use integrated terminals, Git workflows, worktrees, and a GitHub inbox.
- Coordinate helper agents in isolated project directories.
- Keep session history, project groups, reminders, and notifications together.
- Configure terminal and WebKit acceleration, appearance, sounds, and themes.
- Receive update notices from GitHub Releases.
- Use the interface in English or Brazilian Portuguese.

## Supported providers

Install or activate at least one provider before starting a session. MonoCode
checks provider binaries and disables integrations it cannot find.

| Provider     | Install or activate                                                   | Sign in               |
| ------------ | --------------------------------------------------------------------- | --------------------- |
| Claude Code  | [Install guide](https://claude.com/product/claude-code)               | `claude auth login`   |
| Codex        | [Install guide](https://developers.openai.com/codex/cli)              | `codex login`         |
| Cursor CLI   | [Install guide](https://cursor.com/cli)                               | `agent login`         |
| Grok Build   | `curl -fsSL https://x.ai/cli/install.sh \| bash`                      | `grok login`          |
| OpenCode     | [Install guide](https://opencode.ai)                                  | `opencode auth login` |
| Pi           | `npm install -g @earendil-works/pi-coding-agent`                      | —                     |
| omp          | `curl -fsSL https://omp.sh/install \| sh`                             | —                     |
| fx           | `curl -fsSL https://fx.sh/setup.sh \| bash`                           | `fx login`            |
| Hermes Agent | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` | `hermes model`        |
| MiniMax Code | `curl -fsSL https://filecdn.minimax.chat/public/install.sh \| bash`   | `mcode login`         |
| Antigravity  | Install Antigravity, then run `agy` once in a terminal                | —                     |

You only need one provider. Missing integrations do not block available ones.

## Install from a release

Download the latest AppImage from
[GitHub Releases](https://github.com/yanhenrique-dev/Monocode-linux/releases/latest),
then run:

```bash
chmod +x MonoCode_*.AppImage
./MonoCode_*.AppImage
```

The AppImage runs on x86_64 Linux distributions. For system dependencies,
diagnostics, and WebKit troubleshooting, see the [Linux guide](docs/linux.md).

Arch Linux users can also install
[`monocode-bin` from the AUR](https://aur.archlinux.org/packages/monocode-bin).
See the [AUR guide](docs/aur.md) for setup and update details.

## Build from source

### Prerequisites

Before you begin, install:

- Node.js 20 or newer
- The stable Rust toolchain
- Tauri 2 system dependencies for Linux

On Debian or Ubuntu, install the native packages with:

```bash
npm run setup:linux
```

On other distributions, install the equivalent WebKitGTK, GTK 3, Soup 3, and
JavaScriptCoreGTK packages. The complete list appears in
[docs/linux.md](docs/linux.md).

### Start the development app

Install project dependencies:

```bash
npm ci
```

Start MonoCode with hot reload:

```bash
npm run tauri dev
```

### Build an AppImage

Build the distributable AppImage:

```bash
npm run build:linux
```

The output is written to `target/release/bundle/appimage/`.

### Install without root access

Build and install the release binary under `~/.local/bin`, then create a
launcher under `$XDG_DATA_HOME` (`~/.local/share` when unset):

```bash
npm run install:linux:desktop
```

Remove only those per-user files:

```bash
npm run uninstall:linux:desktop
```

This command does not modify system directories or the packages under
`packaging/`.

## Run project checks

Run the same validation used by CI:

```bash
npm run check
cargo check
npm run test:linux:installer
```

Use focused checks while developing:

| Scope                               | Command                   |
| ----------------------------------- | ------------------------- |
| Frontend tests and type checking    | `npm run check:web`       |
| Test-file type checking             | `npm run check:web:tests` |
| Rust formatting, linting, and tests | `npm run check:rust`      |
| Frontend lint                       | `npm run lint`            |
| Unused files and dependencies       | `npm run knip`            |

## Project structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── docs/
├── packaging/
│   ├── archlinux/
│   ├── aur/
│   └── flatpak/
├── public/
├── scripts/
├── src/
│   ├── app/
│   ├── assets/
│   ├── chrome/
│   ├── components/
│   ├── hooks/
│   ├── instructions/
│   ├── lib/
│   │   └── harness/
│   └── surfaces/
└── src-tauri/
    ├── capabilities/
    ├── icons/
    └── src/
```

## Common commands

| Command                           | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `npm run dev`                     | Start the Vite frontend                       |
| `npm run dev:stable`              | Start the Vite frontend in stable mode        |
| `npm run build`                   | Type-check and build the frontend             |
| `npm run preview`                 | Preview the frontend production build         |
| `npm test`                        | Run the Vitest suite once                     |
| `npm run test:watch`              | Run Vitest in watch mode                      |
| `npm run check`                   | Run frontend and Rust project checks          |
| `npm run check:web`               | Run frontend tests and TypeScript checks      |
| `npm run check:web:tests`         | Type-check test files                         |
| `npm run check:rust`              | Run Rust formatting, Clippy, and tests        |
| `npm run lint`                    | Run ESLint on frontend source                 |
| `npm run knip`                    | Find unused files and dependencies            |
| `npm run tauri dev`               | Start the desktop app in development mode     |
| `npm run tauri:stable`            | Start Tauri with the stable configuration     |
| `npm run build:linux`             | Build the release AppImage                    |
| `npm run test:linux:installer`    | Test the per-user desktop installer           |
| `npm run setup:linux`             | Install native Linux build dependencies       |
| `npm run install:linux:desktop`   | Install a per-user desktop build              |
| `npm run uninstall:linux:desktop` | Remove the per-user desktop build             |
| `npm run set-version -- VERSION`  | Synchronize versions across release manifests |

For `npm run set-version -- VERSION`, replace `VERSION` with a semantic version
such as `0.3.0`. This command is for release maintainers.

## Documentation

- [Linux setup and troubleshooting](docs/linux.md)
- [Arch Linux AUR installation](docs/aur.md)
- [Flatpak packaging guide](docs/flathub.md)
- [Frontend architecture](docs/FRONTEND-UI.md)
- [Motion and interaction rules](docs/motion.md)
- [Security policy](docs/SECURITY.md)
- [Code of conduct](docs/CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## Contributing

Read the [contribution guide](docs/CONTRIBUTING.md) before opening a pull
request. Keep changes focused, add or update tests, and run the required checks.

Report vulnerabilities through
[GitHub Security Advisories](https://github.com/yanhenrique-dev/Monocode-linux/security/advisories/new).
Do not open a public issue for a suspected vulnerability.

## License

MonoCode Linux is available under the [MIT License](LICENSE). Provider names
and logos remain the property of their respective owners. See [NOTICE](NOTICE).
