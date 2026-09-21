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

fn find_helper() -> Option<Helper> {
    // Prefer Wayland, fall back to X11. Either works when the matching stack
    // is live; a stale binary from the other session fails with a spawn or
    // display error, which callers surface as a copy/paste failure.
    resolve_gui_binary("wl-copy")
        .map(Helper::WlCopy)
        .or_else(|| resolve_gui_binary("xclip").map(Helper::Xclip))
}

fn find_paste_helper() -> Option<Helper> {
    resolve_gui_binary("wl-paste")
        .map(Helper::WlPaste)
        .or_else(|| resolve_gui_binary("xclip").map(Helper::Xclip))
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
            let decoded = percent_decode(line);
            url::Url::parse(&decoded)
                .ok()
                .filter(|uri| uri.scheme() == "file")
                .and_then(|uri| uri.to_file_path().ok())
        })
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

/// Decode `file:///home/user/My%20File.txt` style escapes. Non-UTF-8 sequences
/// become replacement characters, matching how file managers round-trip paths.
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = &text[index + 1..index + 3];
            if let Ok(byte) = u8::from_str_radix(hex, 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn clipboard_file_paths_sync() -> Vec<String> {
    let Some(helper) = find_paste_helper() else {
        return Vec::new();
    };
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
    Vec::new()
}

fn copy_file_to_clipboard_sync(path: &str) -> Result<(), String> {
    let path = crate::fs::expand_home(path);
    let metadata =
        std::fs::metadata(&path).map_err(|error| format!("{}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("{} is not a file", path.display()));
    }
    let Some(helper) = find_helper() else {
        return Err(
            "No clipboard helper found. Install wl-clipboard (Wayland) or xclip (X11).".into(),
        );
    };
    let payload = uri_list(std::slice::from_ref(&path));
    let mut command = match &helper {
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
        _ => return Err("Clipboard helper is unavailable.".into()),
    };
    command
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|error| display_error(&helper, error))?;
    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin
            .write_all(payload.as_bytes())
            .map_err(|error| display_error(&helper, error))?;
    }
    drop(child.stdin.take());
    let status = child
        .wait()
        .map_err(|error| display_error(&helper, error))?;
    if status.success() {
        Ok(())
    } else {
        Err(display_error(
            &helper,
            std::io::Error::other("helper exited with failure"),
        ))
    }
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
}
