//! Opening http(s) links in the host browser with a sanitized environment.
//!
//! The generic opener plugin spawns `xdg-open`, which on KDE delegates to the
//! host `kde-open` binary. That binary inherits our `LD_LIBRARY_PATH`, and the
//! bundled libraries shadow the host ones (e.g. libnghttp2 vs libcurl), so the
//! helper dies with a symbol lookup error and the link silently never opens.
//! Launching with a clean library path keeps the dispatch on host libraries.

/// Only remote web links go through here. Local files keep using the opener
/// plugin's reveal/open-path flow, which the desktop handles in-process.
fn is_allowed_url(url: &str) -> bool {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"));
    match rest {
        // No host part, no whitespace/control bytes, no backslashes that some
        // launchers treat as separators.
        Some(after) => {
            !after.is_empty()
                && !after
                    .chars()
                    .any(|ch| ch.is_whitespace() || ch.is_control() || ch == '\\')
        }
        None => false,
    }
}

#[tauri::command]
pub async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !is_allowed_url(&url) {
        return Err("refusing to open non-http(s) URL".into());
    }
    open_url(&app, &url)
}

#[cfg(target_os = "linux")]
fn open_url(_app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(url)
        // See the module docs: host helpers must not see our bundled libs.
        .env_remove("LD_LIBRARY_PATH")
        .status()
        .map_err(|err| format!("failed to launch xdg-open: {err}"))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err(format!("xdg-open exited with {status}"))
            }
        })
}

#[cfg(not(target_os = "linux"))]
fn open_url(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_allowed_url;

    #[test]
    fn allows_plain_http_urls() {
        assert!(is_allowed_url("http://example.com/docs"));
        assert!(is_allowed_url("https://github.com/acme/web/issues/157"));
    }

    #[test]
    fn rejects_non_web_schemes() {
        for url in [
            "file:///etc/passwd",
            "mailto:someone@example.com",
            "tel:+123",
            "javascript:alert(1)",
            "data:text/plain,hi",
            "ftp://example.com/x",
            "",
        ] {
            assert!(!is_allowed_url(url), "{url}");
        }
    }

    #[test]
    fn rejects_missing_hosts_and_sneaky_separators() {
        for url in [
            "https://",
            "http://",
            "https://exa mple.com",
            "https://example.com/a\\b",
            "  https://example.com",
        ] {
            assert!(!is_allowed_url(url), "{url}");
        }
    }
}
