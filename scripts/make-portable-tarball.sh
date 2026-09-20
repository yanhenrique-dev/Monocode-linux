#!/usr/bin/env bash
# Builds the portable tarball (MonoCode_<VERSION>_amd64.tar.gz) from the
# final AppImage: extracts it once and packs the raw binary, the desktop
# entry, the icons and LICENSE. No AppImage runtime, no pacman required.
#
# Layout inside the tarball (mirrors filesystem roots):
#   monocode-<VERSION>/bin/monocode
#   monocode-<VERSION>/share/applications/monocode.desktop
#   monocode-<VERSION>/share/icons/hicolor/*/apps/monocode.png
#   monocode-<VERSION>/LICENSE
#   monocode-<VERSION>/LEIA-ME.txt
#
# User install (no root):  tar -xzf MonoCode_*.tar.gz -C ~/.local --strip-components=1
# System install (root):   sudo tar -xzf MonoCode_*.tar.gz -C /usr/local --strip-components=1
set -euo pipefail

VERSION="${1:?usage: make-portable-tarball.sh <version> <appimage> <outdir>}"
APPIMAGE="${2:?usage: make-portable-tarball.sh <version> <appimage> <outdir>}"
OUTDIR="${3:?usage: make-portable-tarball.sh <version> <appimage> <outdir>}"

if [[ ! -f "$APPIMAGE" ]]; then
  echo "AppImage not found: $APPIMAGE" >&2
  exit 1
fi
mkdir -p "$OUTDIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --appimage-extract needs no FUSE; it drops squashfs-root in the cwd.
cp "$APPIMAGE" "$WORK/app.AppImage"
chmod +x "$WORK/app.AppImage"
(cd "$WORK" && ./app.AppImage --appimage-extract >/dev/null)

ROOT="$WORK/squashfs-root"
for required in usr/bin/monocode usr/share/applications/MonoCode.desktop usr/share/icons LICENSE; do
  # LICENSE lives in the repo, not in the AppImage; check it separately.
  if [[ "$required" == "LICENSE" ]]; then
    continue
  fi
  if [[ ! -e "$ROOT/$required" ]]; then
    echo "Missing in AppImage: $required" >&2
    exit 1
  fi
done

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$REPO_ROOT/LICENSE" ]]; then
  echo "Missing repo LICENSE: $REPO_ROOT/LICENSE" >&2
  exit 1
fi

STAGE="$WORK/stage/monocode-$VERSION"
mkdir -p "$STAGE/bin" "$STAGE/share/applications" "$STAGE/share/icons"
cp "$ROOT/usr/bin/monocode" "$STAGE/bin/"
cp "$ROOT/usr/share/applications/MonoCode.desktop" "$STAGE/share/applications/monocode.desktop"
# Open files passed on the command line instead of starting a second instance.
sed -i 's|^Exec=.*|Exec=monocode %U|' "$STAGE/share/applications/monocode.desktop"
cp -a "$ROOT/usr/share/icons/." "$STAGE/share/icons/"
cp "$REPO_ROOT/LICENSE" "$STAGE/"

cat > "$STAGE/LEIA-ME.txt" <<EOF
MonoCode $VERSION — tarball portátil (sem AppImage, sem pacman)

Dependências do sistema (Arch/CachyOS e derivadas):
  sudo pacman -S --needed gtk3 webkit2gtk-4.1 libsoup3 libayatana-appindicator \\
    openssl librsvg zenity hicolor-icon-theme xdg-utils

Instalar para o seu usuário (sem root):
  tar -xzf MonoCode_${VERSION}_amd64.tar.gz -C ~/.local --strip-components=1
  (binário em ~/.local/bin, launcher e ícones em ~/.local/share)

Instalar para o sistema (root):
  sudo tar -xzf MonoCode_${VERSION}_amd64.tar.gz -C /usr/local --strip-components=1

Desinstalar: apague os arquivos instalados acima.
Atualizar: baixe o tarball da próxima versão e extraia por cima.
O atualizador automático do app (latest.json) cobre só o AppImage.
EOF

tar -czf "$OUTDIR/MonoCode_${VERSION}_amd64.tar.gz" -C "$WORK/stage" "monocode-$VERSION"
echo "wrote $OUTDIR/MonoCode_${VERSION}_amd64.tar.gz"
