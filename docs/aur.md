# MonoCode no AUR (`monocode-bin`)

Pacote `-bin`: baixa o AppImage do GitHub Release, extrai e instala em
`/opt/monocode-bin` com symlink `/usr/bin/monocode`, `.desktop` e ícones.

## Testar localmente

Pré-requisitos no Arch: `base-devel`, `pacman-contrib` (`updpkgsums`), `namcap`.

```bash
cd packaging/aur/monocode-bin
makepkg -si
```

## Atualizar para uma nova versão

1. Confirme que o GitHub Release `vX.Y.Z` existe com o asset
   `MonoCode_X.Y.Z_amd64.AppImage`.
2. Edite `pkgver` no `PKGBUILD` e zere `pkgrel=1`.
3. Regenere checksum e `.SRCINFO`:
   ```bash
   updpkgsums
   makepkg --printsrcinfo > .SRCINFO
   ```
4. Valide: `namcap PKGBUILD` e `namcap monocode-bin-*.pkg.tar.zst`.
5. Commit `PKGBUILD` + `.SRCINFO` juntos.

Se só o `PKGBUILD` mudou sem nova versão upstream, incremente `pkgrel`.

## Publicar no AUR (manual, fora do CI)

1. Crie a conta em https://aur.archlinux.org/register e uma chave SSH
   dedicada (`ssh-keygen -f ~/.ssh/aur`), cadastrando a pública no perfil.
2. Clone o repo vazio: `git clone ssh://aur@aur.archlinux.org/monocode-bin.git`
3. Copie `PKGBUILD` + `.SRCINFO` para lá, commit no branch `master` e `git push`.
4. Manutenção: acompanhe issues/comentários no AUR e atualize `pkgver`
   a cada release upstream.
