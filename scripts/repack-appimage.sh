#!/usr/bin/env bash
# Repack the Tauri-built AppImage without the over-bundled Wayland client
# libraries.
#
# Root cause (tauri-apps/tauri#15665): linuxdeploy copies Ubuntu 22.04's
# libwayland-client.so into the AppDir. On hosts with Mesa >= 25 (e.g.
# CachyOS/Arch + AMD + Wayland), the host EGL stack resolves that stale
# libwayland first and eglGetDisplay() fails with EGL_BAD_PARAMETER, so
# WebKitWebProcess aborts and the window stays black. Dropping the bundled
# copies makes the loader fall back to the host libraries, which always
# match the host Mesa. Systems without any libwayland are unaffected in
# practice: GTK itself depends on it, so any machine able to run this
# WebKit app already ships it.
#
# This intentionally prunes ONLY libwayland-*. glib/gstreamer stay bundled
# for old distros, and the GL dispatch (EGL/GL/gbm/drm) already comes from
# the host in our bundle.
set -euo pipefail

BUNDLE_DIR="target/release/bundle/appimage"
APPIMAGETOOL_URL="${APPIMAGETOOL_URL:-https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

shopt -s nullglob
inputs=("$BUNDLE_DIR"/*.AppImage)
if (( ${#inputs[@]} != 1 )); then
  echo "expected exactly one AppImage in $BUNDLE_DIR" >&2
  exit 1
fi
src="$(readlink -f "${inputs[0]}")"
name="$(basename "$src")"

tool="$work/appimagetool.AppImage"
curl -fsSL -o "$tool" "$APPIMAGETOOL_URL"
chmod +x "$tool"

# --appimage-extract-and-run works without FUSE (plain CI runners).
export APPIMAGE_EXTRACT_AND_RUN=1
(
  cd "$work"
  "$src" --appimage-extract >/dev/null
)

libdir="$work/squashfs-root/usr/lib"
if [ ! -d "$libdir" ]; then
  echo "unexpected AppDir layout: $libdir missing" >&2
  exit 1
fi

echo "pruning bundled Wayland client libraries:"
to_prune=(
  "$libdir"/libwayland-client.so*
  "$libdir"/libwayland-cursor.so*
  "$libdir"/libwayland-egl.so*
  "$libdir"/libwayland-server.so*
)
if (( ${#to_prune[@]} > 0 )); then
  rm -fv "${to_prune[@]}"
fi

remaining="$(ls "$libdir" | grep -E '^libwayland-.*\.so' || true)"
if [ -n "$remaining" ]; then
  echo "prune failed, still bundled:" >&2
  echo "$remaining" >&2
  exit 1
fi

"$tool" "$work/squashfs-root" "$work/$name" >/dev/null

# Verify the repacked artifact carries no Wayland client libs, then swap it
# over the original under the same file name.
verify="$work/verify"
mkdir -p "$verify"
(
  cd "$verify"
  APPIMAGE_EXTRACT_AND_RUN=1 "$work/$name" --appimage-extract >/dev/null
)
if ls "$verify"/squashfs-root/usr/lib 2>/dev/null | grep -Eq '^libwayland-.*\.so'; then
  echo "repacked AppImage still bundles libwayland" >&2
  exit 1
fi

mv "$work/$name" "$BUNDLE_DIR/$name"
chmod +x "$BUNDLE_DIR/$name"
echo "repacked $BUNDLE_DIR/$name without bundled libwayland"
