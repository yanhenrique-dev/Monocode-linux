# MonoCode Linux — Guia Linux

> Interface desktop para seus agentes de código, exclusiva para Linux, distribuída como AppImage.

Este documento concentra tudo que é específico de Linux. Para uso geral, veja o [README](../README.md).

## Instalação

Baixe o AppImage na página [Releases](https://github.com/yanhenrique-dev/Monocode-linux/releases/latest):

```bash
chmod +x MonoCode_*.AppImage
./MonoCode_*.AppImage
```

Funciona em qualquer distro x86_64, sem instalar nada.

## Pré-requisitos para build

- Node.js 20+
- Rust estável atual (`rustup default stable`)
- Dependências Tauri/WebKit no Debian/Ubuntu:

```bash
npm run setup:linux
```

O script `scripts/install-linux-deps.sh` instala:

- `build-essential`, `curl`, `file`, `wget`, `patchelf`, `zenity`
- `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`
- `libssl-dev`, `librsvg2-dev`, `libxdo-dev`

Outras distros: instale os equivalentes (webkit2gtk 4.1, gtk3, libsoup3, javascriptcoregtk) pelo seu gerenciador de pacotes.

## Build a partir do código

```bash
npm ci
npm run build:linux
```

Saída em `target/release/bundle/appimage/`: o `.AppImage` executável.

Para desenvolvimento com hot-reload:

```bash
npm install
npm run tauri dev
```

O Tauri carrega automaticamente `src-tauri/tauri.linux.conf.json` no Linux
(janela sem decoração nativa, bundle `appimage`).

## Provedores (CLIs)

Instale e autentique pelo menos um antes de abrir o app:

| Provedor | Instalação | Login |
|---|---|---|
| Claude Code | <https://claude.com/product/claude-code> | `claude auth login` |
| Codex | <https://developers.openai.com/codex/cli> | `codex login` |
| Cursor CLI | <https://cursor.com/cli> | `agent login` |
| Grok Build | `curl -fsSL https://x.ai/cli/install.sh \| bash` | `grok login` |
| OpenCode | <https://opencode.ai> | `opencode auth login` |
| Pi | `npm install -g @earendil-works/pi-coding-agent` | — |
| omp | `curl -fsSL https://omp.sh/install \| sh` | — |
| fx | `curl -fsSL https://fx.sh/setup.sh \| bash` | `fx login` |
| Hermes Agent | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh \| bash` | `hermes model` |

## Sobre o projeto

- Exclusivo para Linux: CI, release, docs e empacotamento só para AppImage.
- Mantenedor: [yanhenrique-dev](https://github.com/yanhenrique-dev).

## Fluidez e composição (WebKit)

O interruptor "aceleração de hardware" nas Configurações só desliga os
desfoques (`backdrop-blur`) e o renderizador GPU do terminal. Composição GPU
de verdade no WebKitGTK depende do sistema, não do app. Se a rolagem ou as
Configurações parecerem pesadas, experimente antes de mexer no código:

```bash
# Desliga a composição acelerada (útil para comparar: se melhorar, o
# gargalo está no caminho GPU do WebKit, não no JavaScript)
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./MonoCode_*.AppImage

# Força o renderizador DMA-BUF (Wayland + Mesa recentes)
WEBKIT_DMABUF_RENDERER=1 ./MonoCode_*.AppImage
```

Para medir com dados, abra o app com o inspetor remoto e grave um trace:

```bash
WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9222 ./MonoCode_*.AppImage
```

Se alguma flag ajudar de forma consistente, vale registrar aqui o hardware
e o driver onde foi testada.

## Tela preta ao abrir (EGL_BAD_PARAMETER)

Afeta AppImages construídos no Ubuntu 22.04 rodando em distros rolantes
(CachyOS/Arch + Mesa recente + AMD + Wayland): o empacotador embute o
`libwayland-client` antigo do Ubuntu, o Mesa do host falha em
`eglGetDisplay()` e o processo web aborta — a janela abre preta. É o caso
de [tauri-apps/tauri#15665](https://github.com/tauri-apps/tauri/issues/15665).

Desde a **0.1.61** o workflow de release remove essas bibliotecas e
reempacota o AppImage (`scripts/repack-appimage.sh`), então o loader usa o
libwayland do host. Se ainda assim abrir preto numa versão antiga:

```bash
# Confirma o diagnóstico (esperado: EGL_BAD_PARAMETER)
./MonoCode_*.AppImage 2>&1 | grep -i EGL

# Contorno imediato: extrair e rodar contra as libs do sistema
./MonoCode_*.AppImage --appimage-extract
./squashfs-root/AppRun
```

## Links não abrem no navegador

O empacotador incluía o `xdg-open` do Ubuntu 22.04, que não conhece o
Plasma 6: com `KDE_SESSION_VERSION=6` ele não executa nada e sai com
sucesso — o clique no link morria em silêncio. Desde a versão com o fix, o
`scripts/repack-appimage.sh` também remove esse `xdg-open` embutido e o app
usa o do sistema. Se um link mesmo assim não abrir, teste no terminal:

```bash
/usr/bin/xdg-open "https://example.com"
```

e confira o navegador padrão com `xdg-settings get default-web-browser`.

## Verificação

```bash
npm run check:web   # vitest + tsc
npm run check:rust  # cargo fmt, clippy, test
npm run check       # ambos (igual ao CI)
```
