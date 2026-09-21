//! File clipboard: hand file URIs to the desktop environment and read them back.
//!
//! Wayland compositors and X11 file managers agree on `text/uri-list` for
//! clipboard-carrying files; GNOME also reads `x-special/gnome-copied-files`
//! from Dolphin and Nautilus alike. Copying moves bytes through the installed
//! helper (`wl-clipboard` or `xclip`) instead of linking a protocol library,
//! matching the repo preference for host-provided system integration.

use std::path::PathBuf;
use std::process::Command;

use crate::harness::resolve_gui_binary;

enum Helper {
    WlCopy(PathBuf),
    WlPaste(PathBuf),
    Xclip(PathBuf),
}

/// True on a Wayland session: `WAYLAND_DISPLAY` set, or the session type says
/// so explicitly. Anything else (plain X11, unknown) uses the X11 helper
/// first — picking `wl-copy` on X11 fails even when the binary exists.
fn wayland_first() -> bool {
    if std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty()) {
        return true;
    }
    match std::env::var("XDG_SESSION_TYPE") {
        Ok(session) => session.eq_ignore_ascii_case("wayland"),
        Err(_) => false,
    }
}

fn session_helpers(copy: bool) -> Vec<Helper> {
    let wl_name = if copy { "wl-copy" } else { "wl-paste" };
    let names: [&str; 2] = if wayland_first() {
        [wl_name, "xclip"]
    } else {
        ["xclip", wl_name]
    };
    names
        .into_iter()
        .filter_map(|name| {
            let path = resolve_gui_binary(name)?;
            Some(if name == "xclip" {
                Helper::Xclip(path)
            } else if copy {
                Helper::WlCopy(path)
            } else {
                Helper::WlPaste(path)
            })
        })
        .collect()
}

fn display_error(helper: &Helper, error: std::io::Error) -> String {
    match helper {
        Helper::WlCopy(_) => format!("wl-copy failed: {error}"),
        Helper::WlPaste(_) => format!("wl-paste failed: {error}"),
        Helper::Xclip(_) => format!("xclip failed: {error}"),
    }
}

fn uri_list(paths: &[PathBuf]) -> String {
    paths
        .iter()
        .map(|path| {
            url::Url::from_file_path(path)
                .map(|uri| uri.to_string())
                .unwrap_or_else(|_| {
                    // Paths that are not absolute cannot become file URIs.
                    // Percent-escape them so the URI list stays parseable.
                    let text = path.to_string_lossy();
                    format!(
                        "file://{}",
                        text.bytes()
                            .map(|byte| {
                                if byte.is_ascii_alphanumeric()
                                    || matches!(byte, b'/' | b'~' | b'-' | b'_' | b'.' | b' ')
                                {
                                    (byte as char).to_string()
                                } else {
                                    format!("%{byte:02X}")
                                }
                            })
                            .collect::<String>()
                    )
                })
        })
        .collect::<Vec<_>>()
        .join("\r\n")
}

fn uris_to_paths(payload: &str) -> Vec<String> {
    payload
        .lines()
        .map(|line| line.trim_end_matches('\r'))
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| {
            // Parse the raw line: pre-decoding `%23` would turn an encoded `#`
            // into a fragment (`a#b.txt` reads back as `a`), and byte-slicing
            // the escapes can split a UTF-8 char (`%€`) and panic.
            url::Url::parse(line)
                .ok()
                .filter(|uri| uri.scheme() == "file")
                .and_then(|uri| uri.to_file_path().ok())
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

fn clipboard_file_paths_sync() -> Vec<String> {
    // Try every installed helper in session order: the first pick can fail
    // at runtime (e.g. wl-paste present but unusable on X11), so fall
    // through to the next instead of returning an empty list.
    for helper in session_helpers(false) {
        for target in ["x-special/gnome-copied-files", "text/uri-list"] {
            let mut command = match &helper {
                Helper::WlPaste(path) => {
                    let mut command = Command::new(path);
                    if target == "text/uri-list" {
                        command.arg("-t").arg(target);
                    }
                    command
                }
                Helper::Xclip(path) => {
                    let mut command = Command::new(path);
                    command
                        .arg("-o")
                        .arg("-selection")
                        .arg("clipboard")
                        .arg("-t")
                        .arg(target);
                    command
                }
                _ => continue,
            };
            match command.output() {
                Ok(output) if output.status.success() && !output.stdout.is_empty() => {
                    let payload = String::from_utf8_lossy(&output.stdout);
                    if target == "x-special/gnome-copied-files" {
                        // First token is "copy" or "cut"; the rest are URIs.
                        let paths = payload
                            .split_once('\n')
                            .map(|(_, uris)| uris_to_paths(uris))
                            .unwrap_or_default();
                        if !paths.is_empty() {
                            return paths;
                        }
                        continue;
                    }
                    let paths = uris_to_paths(&payload);
                    if !paths.is_empty() {
                        return paths;
                    }
                }
                _ => continue,
            }
        }
    }
    Vec::new()
}

fn copy_file_to_clipboard_sync(path: &str) -> Result<(), String> {
    let path = crate::fs::expand_home(path);
    let metadata =
        std::fs::metadata(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("{} is not a file", path.display()));
    }
    let helpers = session_helpers(true);
    if helpers.is_empty() {
        return Err(
            "No clipboard helper found. Install wl-clipboard (Wayland) or xclip (X11).".into(),
        );
    }
    let payload = uri_list(std::slice::from_ref(&path));
    let mut last_error = String::new();
    for helper in &helpers {
        let mut command = match helper {
            Helper::WlCopy(binary) => {
                let mut command = Command::new(binary);
                command.arg("-t").arg("text/uri-list");
                command
            }
            Helper::Xclip(binary) => {
                let mut command = Command::new(binary);
                command
                    .arg("-selection")
                    .arg("clipboard")
                    .arg("-t")
                    .arg("text/uri-list");
                command
            }
            _ => continue,
        };
        command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        let outcome = (|| {
            let mut child = command
                .spawn()
                .map_err(|error| display_error(helper, error))?;
            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                stdin
                    .write_all(payload.as_bytes())
                    .map_err(|error| display_error(helper, error))?;
            }
            drop(child.stdin.take());
            let status = child.wait().map_err(|error| display_error(helper, error))?;
            if status.success() {
                Ok(())
            } else {
                Err(display_error(
                    helper,
                    std::io::Error::other("helper exited with failure"),
                ))
            }
        })();
        match outcome {
            // A stale helper from the other session fails here; the next one
            // in session order gets a turn instead of surfacing the error.
            Ok(()) => return Ok(()),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

#[tauri::command]
pub fn clipboard_file_paths() -> Vec<String> {
    clipboard_file_paths_sync()
}

#[tauri::command]
pub fn copy_file_to_clipboard(path: String) -> Result<(), String> {
    copy_file_to_clipboard_sync(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uri_list_encodes_spaces_and_unicode() {
        let home = std::env::temp_dir();
        let paths = vec![home.join("My File.txt"), home.join("relação.txt")];
        let list = uri_list(&paths);
        assert_eq!(list.lines().count(), 2);
        assert!(list.contains("My%20File.txt"), "{list}");
        assert!(list.starts_with("file://"), "{list}");
    }

    #[test]
    fn uri_round_trip_preserves_spaces() {
        let home = std::env::temp_dir();
        let paths = vec![home.join("My File.txt")];
        let parsed = uris_to_paths(&uri_list(&paths));
        assert_eq!(parsed, vec![paths[0].to_string_lossy().into_owned()]);
    }

    #[test]
    fn uri_list_skips_comments_and_bare_lines() {
        let payload = "# comment\nfile:///tmp/a.txt\r\nnot-a-uri\nfile:///tmp/b%20c.txt";
        let paths = uris_to_paths(payload);
        assert_eq!(paths, vec!["/tmp/a.txt", "/tmp/b c.txt"]);
    }

    #[test]
    fn gnome_payload_drops_the_leading_action_token() {
        let payload = "copy\nfile:///tmp/a.txt\r\nfile:///tmp/b.txt";
        let (_, uris) = payload.split_once('\n').unwrap();
        assert_eq!(uris_to_paths(uris), vec!["/tmp/a.txt", "/tmp/b.txt"]);
    }

    #[test]
    fn uri_keeps_encoded_hash_question_and_percent() {
        // Decoding before parsing would turn `%23` into a fragment and read
        // back the wrong file (`a#b.txt` becomes `a`).
        let payload = "file:///tmp/a%23b.txt\nfile:///tmp/a%3Fb.txt\nfile:///tmp/100%25.txt";
        assert_eq!(
            uris_to_paths(payload),
            vec!["/tmp/a#b.txt", "/tmp/a?b.txt", "/tmp/100%.txt"]
        );
    }

    #[test]
    fn uri_tolerates_invalid_escapes_without_panicking() {
        // `%€` splits a UTF-8 char: byte-slicing the escapes would panic.
        let payload = "file:///tmp/%ZZ.txt\nfile:///tmp/%€.txt";
        let paths = uris_to_paths(payload);
        assert_eq!(paths.len(), 2);
        assert!(paths[0].ends_with("%ZZ.txt"), "{paths:?}");
    }

    #[test]
    fn uri_round_trip_preserves_hash_in_file_name() {
        let home = std::env::temp_dir();
        let paths = vec![home.join("a#b.txt")];
        let parsed = uris_to_paths(&uri_list(&paths));
        assert_eq!(parsed, vec![paths[0].to_string_lossy().into_owned()]);
    }
}
