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
    let url = url.to_string();
    // Never block the async executor on a child process: run the launch on
    // the blocking pool like the other spawn sites in this codebase. The
    // wait itself is bounded: a wedged session bus can keep `xdg-open`
    // from exiting, and the click must not hang forever without feedback.
    let status = tauri::async_runtime::spawn_blocking(move || {
        let child = std::process::Command::new("xdg-open")
            .arg(&url)
            // See the module docs: host helpers must not see our bundled libs.
            .env_remove("LD_LIBRARY_PATH")
            .spawn()
            .map_err(|err| format!("failed to launch xdg-open: {err}"))?;
        wait_with_timeout(child, std::time::Duration::from_secs(15))
    })
    .await
    .map_err(|err| format!("xdg-open task failed: {err}"))??;
    if status.success() {
        Ok(())
    } else {
        Err(format!("xdg-open exited with {status}"))
    }
}

/// Waits for a spawned helper, giving up after `timeout`. A timed-out child
/// is left running: `xdg-open` delegates and exits on its own in the common
/// case, and killing by pid from here would race its own reparenting.
#[cfg(target_os = "linux")]
fn wait_with_timeout(
    mut child: std::process::Child,
    timeout: std::time::Duration,
) -> Result<std::process::ExitStatus, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(status)) => Ok(status),
        Ok(Err(err)) => Err(format!("failed waiting for xdg-open: {err}")),
        Err(_) => Err(format!("xdg-open timed out after {}s", timeout.as_secs())),
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

    #[cfg(target_os = "linux")]
    #[test]
    fn wait_returns_exit_status() {
        use super::wait_with_timeout;
        let child = std::process::Command::new("true")
            .spawn()
            .expect("spawns true");
        let status =
            wait_with_timeout(child, std::time::Duration::from_secs(5)).expect("true exits");
        assert!(status.success());

        let child = std::process::Command::new("false")
            .spawn()
            .expect("spawns false");
        let status =
            wait_with_timeout(child, std::time::Duration::from_secs(5)).expect("false exits");
        assert!(!status.success());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn wait_gives_up_on_hung_helpers() {
        use super::wait_with_timeout;
        let child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .expect("spawns sleep");
        let err = wait_with_timeout(child, std::time::Duration::from_millis(100))
            .expect_err("sleep outlives the timeout");
        assert!(err.contains("timed out"), "{err}");
    }
}
