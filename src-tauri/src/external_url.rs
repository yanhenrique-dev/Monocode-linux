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
    // Reject control/whitespace/backslash games before parsing: some
    // launchers trim or split on them differently than the parser does.
    if url
        .chars()
        .any(|ch| ch.is_whitespace() || ch.is_control() || ch == '\\')
    {
        return false;
    }
    // `Url::parse` lowercases the scheme, so uppercase HTTP(S) works. Note
    // `has_host` counts `Some("")`, so the emptiness check is explicit.
    match url::Url::parse(url) {
        Ok(parsed) => {
            (parsed.scheme() == "http" || parsed.scheme() == "https")
                && parsed.host_str().is_some_and(|host| !host.is_empty())
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !is_allowed_url(&url) {
        return Err("refusing to open non-http(s) URL".into());
    }
    open_url(&app, &url).await
}

#[cfg(target_os = "linux")]
async fn open_url(_app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    // Sandboxed: the host xdg-open dispatches to the host browser. The wait
    // stays off the async runtime (spawn_blocking) and is bounded: a stuck
    // helper is killed and reaped instead of leaking a thread per click.
    let url = url.to_owned();
    let status = tauri::async_runtime::spawn_blocking(move || {
        let child = crate::host::command("xdg-open")
            .arg(&url)
            // See the module docs: host helpers must not see our bundled libs.
            .env_remove("LD_LIBRARY_PATH")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|err| format!("failed to launch xdg-open: {err}"))?;
        wait_with_timeout(child, std::time::Duration::from_secs(15))
    })
    .await
    .map_err(|err| format!("failed waiting for xdg-open: {err}"))??;
    if status.success() {
        Ok(())
    } else {
        Err(format!("xdg-open exited with {status}"))
    }
}

#[cfg(target_os = "linux")]
fn wait_with_timeout(
    mut child: std::process::Child,
    timeout: std::time::Duration,
) -> Result<std::process::ExitStatus, String> {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("xdg-open timed out after {}s", timeout.as_secs()));
            }
            Err(err) => return Err(format!("failed waiting for xdg-open: {err}")),
        }
    }
}

#[cfg(not(target_os = "linux"))]
async fn open_url(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
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
        // Schemes are case-insensitive; the parser normalizes them.
        assert!(is_allowed_url("HTTPS://example.com/x"));
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
            "https://?query-only",
            "https://exa mple.com",
            "https://example.com/a\\b",
            "  https://example.com",
        ] {
            assert!(!is_allowed_url(url), "{url}");
        }
    }
}
