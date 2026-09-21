//! Desktop notifications for turns that end or stall while the window is in
//! the background.
//!
//! Linux uses the freedesktop notification bus (`notify-rust`), which has no
//! permission model: banners are controlled from the desktop environment.

use serde::Serialize;
use tauri::AppHandle;

/// Emitted to every window when the user clicks a notification. Payload is
/// the session id; the window that owns that session handles it.
pub const CLICK_EVENT: &str = "monocode:notification-click";

fn handle_click(app: &AppHandle, identifier: &str) {
    use tauri::Emitter;
    if let Some(reminder) = identifier.strip_prefix(crate::reminders::NOTIFICATION_PREFIX) {
        crate::reminders::open_from_notification(app, reminder);
    } else {
        let _ = app.emit(CLICK_EVENT, identifier);
    }
}

/// The freedesktop bus has no permission model; the variant exists to keep
/// the frontend contract unchanged.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Permission {
    Prompt,
    Granted,
    Denied,
    Unsupported,
}

#[tauri::command]
pub async fn notification_permission(app: AppHandle) -> Permission {
    platform::permission(&app).await
}

#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Permission {
    platform::request_permission(&app).await
}

/// Outcome of a dispatched banner. `os_sound` reports whether the platform
/// itself played a sound: Linux only sends a `sound-name` hint the server
/// may ignore (or the sound theme may lack), so the frontend still plays
/// its in-app cue there even when the banner showed.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowOutcome {
    pub os_sound: bool,
}

/// Resolves only once the platform reports the banner as scheduled: the
/// frontend skips its own turn-finished cue on success, so returning early
/// would silence a turn that never got a notification.
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    session_id: String,
    title: String,
    subtitle: String,
    body: String,
    sound: bool,
) -> Result<ShowOutcome, String> {
    platform::show(&app, &session_id, &title, &subtitle, &body, sound).await
}

/// Opens the app's page in the OS notification settings, where the user can
/// re-enable alerts after declining the prompt.
#[tauri::command]
pub fn open_notification_settings(app: AppHandle) -> Result<(), String> {
    platform::open_settings(&app)
}

#[cfg(target_os = "linux")]
mod platform {
    use tauri::AppHandle;

    use super::Permission;

    pub(super) async fn permission(_app: &AppHandle) -> Permission {
        Permission::Granted
    }

    pub(super) async fn request_permission(_app: &AppHandle) -> Permission {
        Permission::Granted
    }

    /// Desktop entry name installed by `scripts/install-linux-desktop.sh`.
    /// The Arch package installs the same artwork as `monocode` instead, so
    /// the icon lookup tries both names before giving up on an icon.
    const DESKTOP_ENTRY: &str = "com.monocode.desktop";
    const ICON_FALLBACK: &str = "monocode";

    pub(super) async fn show(
        app: &AppHandle,
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> Result<super::ShowOutcome, String> {
        let mut notification = notify_rust::Notification::new();
        notification
            .appname("MonoCode")
            .summary(&format!("{title}: {subtitle}"))
            // The body is agent output; servers render it as markup.
            .body(&escape_markup(body))
            // Servers only report the click when a "default" action exists.
            .action("default", "Show")
            // Lets GNOME attribute the banner to this app even when the
            // AppImage runs without desktop integration installed.
            .hint(notify_rust::Hint::DesktopEntry(DESKTOP_ENTRY.into()));
        if let Some(icon) = resolve_icon() {
            notification.icon(&icon);
        }
        if sound {
            // Best-effort hint only: servers may ignore it and sound themes
            // may lack the name, so the frontend still plays its in-app cue.
            notification.sound_name("message-new-instant");
        }
        let handle = notification.show().map_err(map_show_error)?;
        let app = app.clone();
        let session_id = session_id.to_string();
        // `wait_for_action` blocks until the notification closes, so it runs
        // on a detached thread; the server owns banner expiry, which is why
        // no explicit timeout is set here.
        std::thread::spawn(move || {
            handle.wait_for_action(|action| {
                if action == "default" {
                    super::handle_click(&app, &session_id);
                }
            });
        });
        Ok(super::ShowOutcome { os_sound: false })
    }

    /// Icon theme name for the banner, or `None` when neither installed name
    /// resolves. Passing a missing name degrades some servers to a generic
    /// (or silent) banner, so lookup happens before the icon is set.
    fn resolve_icon() -> Option<String> {
        for name in [DESKTOP_ENTRY, ICON_FALLBACK] {
            if icon_exists(name) {
                return Some(name.into());
            }
        }
        None
    }

    fn icon_exists(name: &str) -> bool {
        for dir in icon_dirs() {
            for size in ["32x32", "48x48", "64x64", "128x128", "256x256", "scalable"] {
                for ext in ["png", "svg", "xpm"] {
                    if dir
                        .join(size)
                        .join("apps")
                        .join(format!("{name}.{ext}"))
                        .is_file()
                    {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Icon theme roots searched for the banner icon, user scope first.
    fn icon_dirs() -> Vec<std::path::PathBuf> {
        let mut dirs = Vec::new();
        if let Some(data_home) = std::env::var_os("XDG_DATA_HOME")
            .map(std::path::PathBuf::from)
            .filter(|path| !path.as_os_str().is_empty())
        {
            dirs.push(data_home.join("icons"));
        } else if let Some(home) = std::env::var_os("HOME") {
            dirs.push(
                std::path::PathBuf::from(home)
                    .join(".local")
                    .join("share")
                    .join("icons"),
            );
        }
        if let Some(data_dirs) = std::env::var_os("XDG_DATA_DIRS") {
            for dir in std::env::split_paths(&data_dirs) {
                dirs.push(dir.join("icons"));
            }
        }
        dirs.push(std::path::PathBuf::from("/usr/local/share/icons"));
        dirs.push(std::path::PathBuf::from("/usr/share/icons"));
        dirs
    }

    /// Translates a dispatch failure into an actionable message. A missing
    /// notification daemon is the common AppImage case (minimal window
    /// managers, daemons not on the session bus).
    fn map_show_error(err: notify_rust::error::Error) -> String {
        let message = err.to_string();
        let lowered = message.to_lowercase();
        if lowered.contains("zbus")
            || lowered.contains("z-bus")
            || lowered.contains("d-bus")
            || lowered.contains("dbus")
            || lowered.contains("not connected")
            || lowered.contains("connection")
            || lowered.contains("service unknown")
            || lowered.contains("org.freedesktop.notifications")
        {
            return format!(
                "notification daemon unavailable (org.freedesktop.Notifications not on D-Bus): {message}. \
                 Start your desktop's notification service and retry; the in-app cue stands in meanwhile"
            );
        }
        if lowered.contains("timed out") || lowered.contains("timeout") {
            return format!("notification dispatch timed out: {message}");
        }
        format!("notification failed: {message}")
    }

    /// The freedesktop spec parses the body as a subset of HTML.
    fn escape_markup(text: &str) -> String {
        let mut out = String::with_capacity(text.len());
        for ch in text.chars() {
            match ch {
                '&' => out.push_str("&amp;"),
                '<' => out.push_str("&lt;"),
                '>' => out.push_str("&gt;"),
                _ => out.push(ch),
            }
        }
        out
    }

    pub(super) fn open_settings(_app: &AppHandle) -> Result<(), String> {
        // Linux has no single notifications settings URL. Try the panel of
        // the running desktop; otherwise tell the user where to look.
        // `xdg-open` is intentionally the host's (the bundle prunes its own
        // copy in `scripts/repack-appimage.sh`), but no `settings://` scheme
        // is standard, so DE binaries are tried directly.
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();
        let mut attempts: Vec<(&str, Vec<&str>)> = Vec::new();
        if desktop.contains("gnome") {
            attempts.push(("gnome-control-center", vec!["notifications"]));
        } else if desktop.contains("kde") {
            attempts.push(("systemsettings", vec!["kcm_notifications"]));
            attempts.push(("kcmshell6", vec!["kcm_notifications"]));
            attempts.push(("kcmshell5", vec!["kcm_notifications"]));
        } else if desktop.contains("xfce") {
            attempts.push(("xfce4-notifyd-config", vec![]));
        }
        for (cmd, args) in &attempts {
            if std::process::Command::new(cmd).args(args).spawn().is_ok() {
                return Ok(());
            }
        }
        Err("no notification settings panel found: enable notifications in your desktop's settings \
             (GNOME: Settings > Notifications; KDE: System Settings > Notifications), then return here"
            .into())
    }

    #[cfg(test)]
    mod tests {
        use super::{escape_markup, icon_dirs, map_show_error, resolve_icon};

        #[test]
        fn escapes_markup_in_bodies() {
            assert_eq!(
                escape_markup("<b>x</b> & y"),
                "&lt;b&gt;x&lt;/b&gt; &amp; y"
            );
        }

        #[test]
        fn outcome_reports_no_os_sound_on_linux() {
            let outcome = super::super::ShowOutcome { os_sound: false };
            assert_eq!(
                serde_json::to_value(outcome).unwrap(),
                serde_json::json!({ "osSound": false })
            );
        }

        #[test]
        fn icon_lookup_covers_both_installed_names() {
            // No assertion on the host's icon theme: the lookup must simply
            // return one of the two known names, or nothing, never a third.
            assert!(resolve_icon().is_none_or(|name| {
                name == super::DESKTOP_ENTRY || name == super::ICON_FALLBACK
            }));
            assert!(!icon_dirs().is_empty());
        }

        #[test]
        fn daemon_errors_stay_actionable() {
            let message =
                map_show_error(notify_rust::error::Error::from("zbus: connection closed"));
            assert!(
                message.contains("notification daemon unavailable"),
                "unexpected: {message}"
            );
            let message = map_show_error(notify_rust::error::Error::from(
                "org.freedesktop.DBus.Error.ServiceUnknown",
            ));
            assert!(
                message.contains("notification daemon unavailable"),
                "unexpected: {message}"
            );
            let message = map_show_error(notify_rust::error::Error::from("some other failure"));
            assert!(
                message.starts_with("notification failed:"),
                "unexpected: {message}"
            );
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
mod platform {
    use tauri::AppHandle;

    use super::Permission;

    pub(super) async fn permission(_app: &AppHandle) -> Permission {
        Permission::Unsupported
    }

    pub(super) async fn request_permission(_app: &AppHandle) -> Permission {
        Permission::Unsupported
    }

    pub(super) async fn show(
        _app: &AppHandle,
        _session_id: &str,
        _title: &str,
        _subtitle: &str,
        _body: &str,
        _sound: bool,
    ) -> Result<(), String> {
        Err("notifications are not supported on this platform".into())
    }

    pub(super) fn open_settings(_app: &AppHandle) -> Result<(), String> {
        Err("notifications are not supported on this platform".into())
    }
}
