/**
 * Every place the project version is written, in one list.
 *
 * This exists because the version used to live in three files the release
 * workflow checked, while nine more carried a copy that nothing verified.
 * packaging/aur was 33 releases behind and the Flatpak manifest 55, both
 * because `bump-version.mjs` only *reminded* you to update them.
 *
 * Writer and checker both read this list, so a new pin cannot be added to one
 * and forgotten by the other.
 */

/**
 * `read` pulls the version out; `write` replaces it. Both take the raw file
 * text so callers do not re-read the file per pin.
 */
export const VERSION_SOURCES = [
  {
    label: "package.json",
    file: "package.json",
    read: (text) => text.match(/"version": "([^"]+)"/)?.[1] ?? null,
    write: (text, v) => text.replace(/("version": ")[^"]+(")/, `$1${v}$2`),
  },
  {
    label: "package-lock.json (root)",
    file: "package-lock.json",
    read: (text) =>
      text.match(/^(\{\n\s*"name": "monocode-desktop",\n\s*"version": ")([^"]+)/m)?.[2] ??
      null,
    write: (text, v) =>
      text.replace(
        /(^(\{\n\s*"name": "monocode-desktop",\n\s*"version": "))[^"]+/m,
        `$1${v}`,
      ),
  },
  {
    label: "package-lock.json (packages)",
    file: "package-lock.json",
    read: (text) =>
      text.match(/"packages": \{\n\s*"": \{\n\s*"name": "monocode-desktop",\n\s*"version": "([^"]+)/)?.[1] ??
      null,
    write: (text, v) =>
      text.replace(
        /("packages": \{\n\s*"": \{\n\s*"name": "monocode-desktop",\n\s*"version": ")[^"]+/,
        `$1${v}`,
      ),
  },
  {
    label: "Cargo.toml",
    file: "Cargo.toml",
    read: (text) => text.match(/^version = "([^"]+)"/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^(version = ")[^"]+"/m, `$1${v}"`),
  },
  {
    label: "Cargo.lock (monocode)",
    file: "Cargo.lock",
    read: (text) =>
      text.match(/name = "monocode"\nversion = "([^"]+)"/)?.[1] ?? null,
    write: (text, v) =>
      text.replace(/(name = "monocode"\nversion = ")[^"]+/, `$1${v}`),
  },
  {
    label: "src-tauri/tauri.conf.json",
    file: "src-tauri/tauri.conf.json",
    read: (text) => text.match(/"version": "([^"]+)"/)?.[1] ?? null,
    write: (text, v) => text.replace(/("version": ")[^"]+(")/, `$1${v}$2`),
  },
  {
    label: "packaging/archlinux/monocode/PKGBUILD",
    file: "packaging/archlinux/monocode/PKGBUILD",
    read: (text) => text.match(/^pkgver=([\d.]+)/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^pkgver=[\d.]+/m, `pkgver=${v}`),
  },
  {
    label: "packaging/archlinux/monocode/.SRCINFO",
    file: "packaging/archlinux/monocode/.SRCINFO",
    read: (text) => text.match(/^\tpkgver = ([\d.]+)/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^(\tpkgver = )[\d.]+/m, `$1${v}`),
  },
  {
    // The -bin package downloads a published AppImage, so its version is the
    // release it points at. It was the one the writer skipped entirely.
    label: "packaging/aur/monocode-bin/PKGBUILD",
    file: "packaging/aur/monocode-bin/PKGBUILD",
    read: (text) => text.match(/^pkgver=([\d.]+)/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^pkgver=[\d.]+/m, `pkgver=${v}`),
  },
  {
    label: "packaging/aur/monocode-bin/.SRCINFO",
    file: "packaging/aur/monocode-bin/.SRCINFO",
    read: (text) => text.match(/^\tpkgver = ([\d.]+)/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^(\tpkgver = )[\d.]+/m, `$1${v}`),
  },
  {
    label: "flatpak manifest tag",
    file: "packaging/flatpak/com.monocode.desktop.yml",
    read: (text) => text.match(/^\s*tag: v([\d.]+)/m)?.[1] ?? null,
    write: (text, v) => text.replace(/^(\s*tag: v)[\d.]+/m, `$1${v}`),
  },
  {
    label: "packaging/flatpak/com.monocode.desktop.metainfo.xml",
    file: "packaging/flatpak/com.monocode.desktop.metainfo.xml",
    read: (text) =>
      text.match(/<release version="([\d.]+)"/)?.[1] ?? null,
    write: (text, v) =>
      text.replace(/(<release version=")[\d.]+(" date=")\d{4}-\d{2}-\d{2}(")/, `$1${v}$2${TODAY}$3`),
  },
];

/** Set once at module load so every metainfo write stamps the same day. */
export const TODAY = new Date().toISOString().slice(0, 10);
