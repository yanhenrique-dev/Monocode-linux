# MonoCode no Flatpak/Flathub (`com.monocode.desktop`)

Distribuição sandboxed. O manifest em
`packaging/flatpak/com.monocode.desktop.yml` é a fonte da verdade; o
Flathub builda e publica a partir do seu próprio repo
(`flathub/com.monocode.desktop`), espelhando este arquivo.

Runtime pinado: GNOME 49 (SDK ainda traz `webkit2gtk-4.1`, que o backend
Tauri linka). Re-checar na submissão — o Flathub recusa runtimes EOL e o
bump é uma linha (`runtime-version:`). O CI não valida o SDK em si, só
manifest, metainfo e lint.

## Como funciona no sandbox

O app é uma IDE: abre projetos arbitrários, sobe shells no PTY e executa
CLIs de providers (`claude`, `codex`, `opencode`, …) e `git`. Nada disso
existe dentro do sandbox, então:

- `--filesystem=home` — projetos moram em qualquer lugar da home; portais
  por pasta não servem porque o usuário escolhe o diretório em runtime.
- `--talk-name=org.freedesktop.Flatpak` — todo spawn (shell do PTY,
  CLIs, `git`, `gh`, `xdg-open`, editores externos) é re-executado no
  host via `flatpak-spawn --host`. Implementação em
  `src-tauri/src/host.rs`; fora do sandbox o comportamento é idêntico
  a `std::process::Command`.
- `MONOCODE_FLATPAK=1` força o modo sandbox fora do Flatpak (útil para
  testar o roteamento host sem rebuildar o Flatpak).

Pré-requisito: instale pelo menos um CLI de provider **no host** e
autentique antes de abrir o app (a mesma tabela de
[providers](linux.md#provedores-clis)).

## Diferenças conhecidas vs. nativo

- **Sem self-updater.** O Flathub proíbe updaters embutidos: o plugin
  `tauri-plugin-updater` nem é registrado no sandbox
  (`src-tauri/src/lib.rs`) e a UI de Settings mostra "Atualizações
  gerenciadas pelo Flatpak" (`src/lib/updater.ts`,
  `flatpak_sandboxed`). Atualize pelo software center ou `flatpak update`.
- **Rótulo de foreground do terminal ausente.** O PTY do sandbox só
  enxerga o proxy `flatpak-spawn`; o processo real roda em outro pid
  namespace no host, então `foreground_label` retorna `None`.
- **Sinais via host.** Matar sessões/terminais sinaliza pelo
  `flatpak-spawn --host kill`; órfãos de crash são varridos via `ps` do
  host com os mesmos markers (`MONOCODE_HARNESS_PARENT`).

## Limitações conhecidas (antes da submissão ao Flathub)

- **Dependências offline.** O sandbox de build do Flathub não tem rede:
  a submissão exige manifestos de fontes npm/Cargo gerados
  (`flatpak-node-generator`, `flatpak-cargo-generator`) e build 100%
  offline. O manifesto atual baixa o repo + toolchain Node — suficiente
  para iteração local, insuficiente para o Flathub.
- **PID do proxy vs. PID do host.** `harness_spawn`/`spawn_unix`
  guardam o `Child::id()` do proxy `flatpak-spawn`, mas `signal_host` e
  `host_alive` usam esse número em `kill` no host — namespaces `/proc`
  distintos, então o número pode não identificar o processo real (ou
  identificar outro). Antes da submissão: protocolo explícito de PID
  real (ex. wrapper que imprime o PID do host antes do `exec`) ou ciclo
  de vida gerenciado pelo próprio proxy, e remover a dependência de
  `MONOCODE_HARNESS_PARENT` quando ele carregar o PID do proxy.

## Validar localmente

Pré-requisitos: `flatpak`, `flatpak-builder`, `appstreamcli`.

```bash
flatpak-builder --install-deps-from=flathub --force-clean \
  builddir packaging/flatpak/com.monocode.desktop.yml
flatpak-builder --run builddir \
  packaging/flatpak/com.monocode.desktop.yml monocode
```

Só validação rápida (sem build completo — o CI faz o mesmo):

```bash
node scripts/flatpak-ci-manifest.mjs \
  packaging/flatpak/com.monocode.desktop.yml "$PWD" /tmp/ci.yml
flatpak-builder --download-only /tmp/fb-builddir /tmp/ci.yml
appstreamcli validate packaging/flatpak/com.monocode.desktop.metainfo.xml
desktop-file-validate packaging/flatpak/com.monocode.desktop.desktop
flatpak-builder-lint manifest packaging/flatpak/com.monocode.desktop.yml
```

## Lint (`flatpak-builder-lint`) e exceções

Validado com o lint oficial (via `org.flatpak.Builder`); o CI repete via
`scripts/flatpak-lint-gate.mjs`, que só falha em achados **novos**. Na
submissão, pedir exceção para cada erro abaixo (documentação das
justificativas em https://docs.flathub.org/linter):

| Achado | Tipo | Justificativa |
|---|---|---|
| `appid-ends-with-lowercase-desktop` | exceção | `com.monocode.desktop` é o identifier Tauri estabelecido em todos os artefatos (`.deb`, AUR, updater); renomear quebraria a identidade do projeto. |
| `appid-url-not-reachable` | decisão aberta | Nenhum domínio próprio para o ID rDNS (o lint tenta `https://monocode.com`). Opções: pedir exceção, ou registrar domínio. Ver `io.github.*` abaixo — não adotado para não divergir do identifier Tauri. |
| `finish-args-home-filesystem-access` | exceção | IDE/agent workspace: projetos em qualquer pasta da home, escolhida em runtime — portais por pasta não servem. Categoria aceita para dev tools. |
| `finish-args-flatpak-spawn-access` | exceção | CLIs de providers, login shell, `git` e `xdg-open` vivem no host; roteados via `flatpak-spawn --host` (`src-tauri/src/host.rs`). Categoria aceita para dev tools. |

Warnings aceitos: `runtime-update-available` (pin consciente, ver acima).
Corrigidos durante a implementação: `x11+wayland` → `wayland` +
`fallback-x11`; `source-git-no-commit-with-tag` → `commit:` fixado;
`developer-id-invalid` → developer usa o próprio app-id.

Nota sobre `io.github.*`: o Flathub sugere esse prefixo para projetos sem
domínio, mas adotá-lo divergiria do identifier Tauri (`com.monocode.desktop`)
usado no `.deb`, AUR e updater. Mantido o ID atual + exceção.

## Submeter ao Flathub (manual, fora do CI)

1. Confirme que a tag `vX.Y.Z` existe (o manifest fixa `tag:` + `commit:`;
   o `npm run set-version -- X.Y.Z` atualiza ambos — o commit via API do
   GitHub, com aviso se a tag ainda não existir).
2. Adicione screenshots reais no `.metainfo.xml` (remoto, `type="default"`).
3. Copie `com.monocode.desktop.yml` para um clone de
   `flathub/com.monocode.desktop`, commit e abra o PR de submissão.
4. Acompanhe o review — permissões amplas e ID estão justificados na
   tabela acima; responda com este documento como referência.

## Versionamento

`npm run set-version -- X.Y.Z` atualiza `tag:` + `commit:` do manifest e o
`<release>` do metainfo junto com os demais manifests. O tarball do Node
tem `sha256` fixado (atualizar se bump de Node).
