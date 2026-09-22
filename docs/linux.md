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

### OpenCode: MCP, config e auth

O MonoCode não gerencia MCP nem escreve `opencode.json`. O `opencode serve`
que o app sobe lê a config normal do OpenCode: `opencode.json[c]` do projeto
para cima mais `~/.config/opencode/`. MCPs (`opencode mcp list`), skills
(`opencode debug skill`) e providers (`opencode providers list`) continuam
sendo configurados no próprio OpenCode.

O que o MonoCode faz por sessão: `PATCH /session` com regras de permissão
conforme o modo de acesso (supervised, auto-accept-edits, auto, full-access).
`question` é sempre permitido, `allow` vira `once` (a sessão pergunta de novo
na próxima vez). Cheque `opencode debug config` se algo parecer ignorado.

Auth é por provider dentro do OpenCode, então não há botão de login no app
para ele. Se o turno falhar com modelo não encontrado, rode
`opencode models <provider>` e escolha um `provider/model` do catálogo.
Overrides via env (`OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`,
`OPENCODE_AUTH_CONTENT`) são repassados do login shell para o `serve`,
igual às chaves de fx e grok.

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

## Sons e notificações (runtime)

O app toca o som in-app mesmo quando o banner do sistema aparece: no
Linux o banner carrega só uma dica de som (`message-new-instant`) que o
servidor pode ignorar, então o cue interno é a garantia audível.

Pré-requisitos no host:

- Um daemon de notificações no barramento da sessão
  (`org.freedesktop.Notifications`). Sem ele, o banner falha e o app
  registra o motivo no console (`[notifications] show_notification
  rejected`) enquanto o cue in-app assume.
- Banners com janela focada e sessão visível não disparam por desenho:
  o som in-app toca, sem banner duplicado.
- Sons embutidos são sintetizados via Web Audio (sem codec). Arquivos
  customizados `.ogg`/`.wav` decodificam em mais sistemas;
  `.mp3`/`.m4a`/`.opus` dependem dos plugins GStreamer do WebKitGTK do
  host. Falha de decodificação aparece nas Configurações com o motivo
  (`missing`/`decode`/`unavailable`).
- O Web Audio começa suspenso até o primeiro clique/tecla. Se o primeiro
  turno terminar antes de qualquer gesto, o cue pode sair mudo uma vez;
  depois do primeiro gesto, normaliza.
- Nenhum som no AppImage: o AppImage usa o WebKitGTK e o GStreamer do
  host, então sem saída de áudio funcional no sistema não há cue. Nas
  Configurações, a linha de status do som mostra `Áudio pronto`,
  `Aguardando primeiro clique ou tecla` ou `Áudio indisponível`. Cheque
  no host:

```bash
# Servidor de áudio de pé? (esperado: PipeWire ou PulseAudio)
pactl info 2>/dev/null | head -n 3 || pipewire --version

# Sinks de áudio do GStreamer presentes?
if ! command -v gst-inspect-1.0 >/dev/null 2>&1; then
  echo "gst-inspect-1.0 não está instalado; não foi possível verificar os sinks"
else
  gst-inspect-1.0 pulsesink alsasink 2>&1 | grep -i "no such element" \
    || echo "sinks OK"
fi

# Web Audio do WebKitGTK funciona? Abra qualquer página de teste Web Audio
# no navegador do sistema; se ela também ficar muda, o problema é o stack
# de áudio do host, não o app.
```
- Ícone do banner: o app procura `com.monocode.desktop` e depois
  `monocode` no tema de ícones. Com integração desktop instalada
  (`scripts/install-linux-desktop.sh` ou pacote nativo), o banner usa o
  ícone correto; sem ela, o banner aparece sem ícone, mas aparece.

Diagnóstico rápido:

```bash
# Daemon presente? (esperado: vendor, name, version, spec)
dbus-send --session --print-reply --dest=org.freedesktop.Notifications \
  /org/freedesktop/Notifications \
  org.freedesktop.Notifications.GetServerInformation
notify-send "MonoCode" "teste"

# Tema de som tem o nome pedido?
find /usr/share/sounds /usr/local/share/sounds ~/.local/share/sounds \
  -name 'message-new-instant*' 2>/dev/null
```

Nas Configurações, "Sons" liga/desliga os cues e "Notificações" pede o
banner do sistema. Reativar os sons não repete atividade antiga: eventos
anteriores ao religamento são ignorados de propósito.

## Links não abrem no navegador

O empacotador incluía o `xdg-open` do Ubuntu 22.04, que não conhece os
desktops Linux atuais: dependendo da sessão (ex. Plasma 6 via
`KDE_SESSION_VERSION=6`), ele não executa nada e sai com sucesso — o clique
no link morria em silêncio. Desde a versão com o fix, o
`scripts/repack-appimage.sh` também remove esse `xdg-open` embutido e o app
usa o do sistema, que entende o desktop em execução. Se um link mesmo assim
não abrir, teste no terminal:

```bash
/usr/bin/xdg-open "https://example.com"
```

e confira o navegador padrão com `xdg-settings get default-web-browser`.

## Interface borrada ou apagada

Ordem de checagem:

1. Escala da interface diferente de 100% (Ctrl+=, Ctrl+-, Ctrl+0): zoom
   fracionário borra botões e ícones. Em Configurações → Aparência a
   linha da escala mostra botão de reset quando não está em 100%.
2. Escala fracionária do Wayland (125%/150%): o WebKitGTK renderiza em
   resolução não inteira e tudo amacia. Se o passo 1 não resolveu e o
   sistema usa fração, teste 100% ou 200% para confirmar a origem.

## Verificação

```bash
npm run check:web   # vitest + tsc
npm run check:rust  # cargo fmt, clippy, test
npm run check       # ambos (igual ao CI)
```
