<p align="center">
  <img src="public/monocode.png" alt="MonoCode Linux" width="88" />
</p>

<h1 align="center">MonoCode Linux</h1>

<p align="center">
  <strong>Interface desktop para seus agentes de código, exclusiva para Linux.</strong>
</p>

<p align="center">
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml"><img src="https://github.com/yanhenrique-dev/Monocode-linux/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/yanhenrique-dev/Monocode-linux/releases/latest"><img src="https://img.shields.io/github/v/release/yanhenrique-dev/Monocode-linux?label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/plataforma-Linux%20x86__64-blue" alt="Linux x86_64" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-green" alt="MIT" /></a>
</p>

> Aviso de fork: este projeto deriva de [hardbeat920/monocode](https://github.com/hardbeat920/monocode.git) e é mantido com foco total em Linux. O crédito pela base original vai para o autor e os contribuidores do upstream.

---

## Índice

- [O que é](#o-que-é)
- [Recursos](#recursos)
- [Provedores suportados](#provedores-suportados)
- [Instalação](#instalação)
- [Compilando do código-fonte](#compilando-do-código-fonte)
- [Uso](#uso)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts disponíveis](#scripts-disponíveis)
- [CI e releases](#ci-e-releases)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## O que é

O MonoCode Linux é um aplicativo desktop (Tauri + React) que reúne seus agentes de código numa interface só. Abas são sessões, o composer é a entrada, e cada provedor roda com a sua própria assinatura. O app não vende tokens.

Empacotamento, documentação e automação miram um alvo só: Linux x86_64, distribuído em `.deb` e AppImage. Não há suporte a macOS nem Windows neste fork.

## Recursos

- Abas que funcionam como sessões independentes, uma por agente.
- Um composer só para todos os provedores, com anexos de arquivos, menções e skills.
- Suporte a Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, fx e Hermes Agent.
- Terminal com renderização acelerada por GPU e uma chave geral de hardware nas Configurações.
- Explorador de arquivos com preview e revisão de mudanças lado a lado.
- Orquestração de agentes auxiliares em diretórios isolados, com pausa, retomada e retry.
- Histórico de sessões, grupos de projetos, lembretes e notificações por projeto.
- Verificação de atualizações com download direto dos Releases do GitHub.

## Provedores suportados

Instale e autentique pelo menos um provedor antes de abrir o app:

| Provedor | Instalação | Login |
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

Um provedor basta: o app detecta os CLIs na inicialização e desabilita os ausentes com dica de instalação.

## Instalação

Baixe a versão mais recente em [GitHub Releases](https://github.com/yanhenrique-dev/Monocode-linux/releases/latest):

```bash
# Pacote .deb (Ubuntu/Debian x86_64)
sudo apt install ./MonoCode_*.deb

# AppImage (qualquer distro x86_64)
chmod +x MonoCode_*.AppImage
./MonoCode_*.AppImage
```

Dependências e solução de problemas em detalhe: [docs/linux.md](docs/linux.md).

## Compilando do código-fonte

Pré-requisitos:

- Node.js 20 ou mais recente
- Toolchain Rust estável (`rustup default stable`)
- Dependências Tauri/WebKit do sistema (ex.: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`)

No Ubuntu/Debian, o script do repositório instala as dependências nativas:

```bash
npm run setup:linux:deb
```

Build dos pacotes distribuíveis (saída em `target/release/bundle/`):

```bash
npm ci
npm run build:linux
```

Modo desenvolvimento, com hot-reload:

```bash
npm install
npm run tauri dev
```

Para rodar a mesma verificação do CI:

```bash
npm run check        # web + rust
npm run check:web    # vitest + tsc
npm run check:rust   # cargo fmt, clippy e testes
```

## Uso

1. Abra o app e escolha um projeto (ou crie um).
2. Selecione o provedor/modelo no composer.
3. Descreva a tarefa. Cada aba guarda a própria sessão e o histórico.
4. Acompanhe diffs, terminais e aprovações sem sair da interface.
5. Ajuste GPU do terminal, temas e notificações em Configurações.

## Estrutura do projeto

```
.
├── src/
│   ├── app/        # hooks de app (sessões, abas, composer, orquestração)
│   ├── chrome/     # moldura da janela (título, sidebar, composer, tabs)
│   ├── surfaces/   # painéis da aba (transcript, editor, diff, terminal)
│   ├── lib/        # libs compartilhadas (harness/, adapters por provedor)
│   └── hooks/      # hooks React reutilizáveis
├── src-tauri/
│   ├── src/        # lado Rust (PTYs, filesystem/git, sessões, janela)
│   └── tauri.linux.conf.json  # config Tauri do Linux
├── scripts/
│   └── install-linux-deps-debian.sh  # dependências Ubuntu/Debian
├── docs/
│   ├── linux.md            # guia Linux completo
│   ├── CONTRIBUTING.md     # como contribuir
│   ├── CODE_OF_CONDUCT.md  # código de conduta
│   └── SECURITY.md         # política de segurança
└── .github/workflows/  # CI (ci.yml) e release (release.yml), só Linux
```

## Scripts disponíveis

| Script | O que faz |
|---|---|
| `npm run dev` | frontend Vite em modo dev |
| `npm run build` | `tsc` + build Vite |
| `npm test` / `test:watch` | suíte Vitest |
| `npm run check` | validação total (web + rust) |
| `npm run tauri dev` | app desktop em desenvolvimento |
| `npm run setup:linux:deb` | instala dependências no Debian/Ubuntu |
| `npm run build:linux` | gera `.deb` + AppImage |
| `npm run set-version` | sincroniza versão nos manifestos |

## CI e releases

- CI (`.github/workflows/ci.yml`): roda no `ubuntu-latest` a cada push/PR com Vitest, `tsc`, `cargo fmt`, Clippy e `cargo test`.
- Release (`.github/workflows/release.yml`): a cada tag `v*`, confere a versão nos manifestos e no CHANGELOG, compila `.deb` e AppImage e publica no GitHub Release.

Para lançar uma versão:

```bash
npm run set-version 0.1.51
# atualize o CHANGELOG.md e commite
git tag v0.1.51 && git push origin v0.1.51
```

## Contribuindo

O projeto é mantido por [yanhenrique-dev](https://github.com/yanhenrique-dev), com foco em Linux. Pull requests pequenos e focados são bem-vindos. Mudanças grandes merecem uma issue antes. Veja como contribuir em [CONTRIBUTING.md](docs/CONTRIBUTING.md) e as regras de conduta em [CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md). Falha de segurança se reporta em privado, via [Security Advisories](https://github.com/yanhenrique-dev/Monocode-linux/security/advisories/new). Nunca abra issue pública para isso.

## Licença

[MIT](LICENSE). Nomes e logos de provedores são marcas de seus respectivos donos, veja [NOTICE](NOTICE).
