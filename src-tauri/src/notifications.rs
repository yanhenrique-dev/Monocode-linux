//! Desktop notifications for turns that end or stall while the window is in
//! the background.
//!
//! macOS goes through `UNUserNotificationCenter` directly: the app already
//! links it for the Dock badge, it reports the real authorization state, and
//! a delegate turns a click into a jump back to the session. Linux uses the
//! freedesktop notification bus, which has no permission model. Windows uses
//! the WinRT toast API via `tauri-winrt-notification`, which likewise has no
//! runtime permission prompt: toasts are controlled from Windows Settings.

use serde::Serialize;
use tauri::AppHandle;

/// Emitted to every window when the user clicks a notification. Payload is
/// the session id; the window that owns that session handles it.
#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
pub const CLICK_EVENT: &str = "monocode:notification-click";

#[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
fn handle_click(app: &AppHandle, identifier: &str) {
    use tauri::Emitter;
    if let Some(reminder) = identifier.strip_prefix(crate::reminders::NOTIFICATION_PREFIX) {
        crate::reminders::open_from_notification(app, reminder);
    } else {
        let _ = app.emit(CLICK_EVENT, identifier);
    }
}

#[cfg(target_os = "macos")]
pub use platform::install_delegate;

/// Each platform constructs only the variants it can reach, so the lint is
/// silenced for the whole enum rather than per target.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Permission {
    /// Never asked, or not yet answered.
    Prompt,
    Granted,
    /// Declined at the prompt, or alerts switched off in System Settings.
    Denied,
    /// No notification backend on this platform.
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
    const { osSound } = await invoke<{ osSound: boolean }>("show_notification", {
      sessionId: session.id,
      title,
      subtitle,
      body,
      sound: loadSoundsEnabled(),
    });
    return osSound;
    platform::show(&app, &session_id, &title, &subtitle, &body, sound).await
}

/// Opens the app's page in the OS notification settings, where the user can
/// re-enable alerts after declining the prompt.
#[tauri::command]
pub fn open_notification_settings(app: AppHandle) -> Result<(), String> {
    platform::open_settings(&app)
}

#[cfg(target_os = "macos")]
mod platform {
    use std::cell::RefCell;
    use std::ptr::NonNull;
    use std::sync::mpsc;
    use std::time::Duration;

    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{Bool, NSObject, NSObjectProtocol, ProtocolObject};
    use objc2::{define_class, AnyThread, DefinedClass, MainThreadMarker};
    use objc2_foundation::{NSArray, NSError, NSSet, NSString};
    use objc2_user_notifications::{
        UNAlertStyle, UNAuthorizationOptions, UNAuthorizationStatus, UNMutableNotificationContent,
        UNNotification, UNNotificationAction, UNNotificationActionOptions, UNNotificationCategory,
        UNNotificationCategoryOptions, UNNotificationPresentationOptions, UNNotificationRequest,
        UNNotificationResponse, UNNotificationSetting, UNNotificationSettings, UNNotificationSound,
        UNUserNotificationCenter, UNUserNotificationCenterDelegate,
    };
    use tauri::AppHandle;

    use super::Permission;

    /// Request identifiers carry the session so a click can find it without
    /// touching `userInfo`. Each request gets a fresh suffix: reusing one
    /// replaces the previous banner, and macOS drops replacements that land
    /// while the app is frontmost.
    const ID_PREFIX: &str = "session:";

    fn request_identifier(session_id: &str) -> String {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        format!("{ID_PREFIX}{session_id}/{nanos}")
    }

    fn session_from_identifier(identifier: &str) -> Option<&str> {
        let rest = identifier.strip_prefix(ID_PREFIX)?;
        Some(rest.split('/').next().unwrap_or(rest))
    }

    /// Category with a single "Show" button, so the banner offers the jump
    /// explicitly instead of relying on a click on the body.
    const CATEGORY: &str = "monocode.session";
    const SHOW_ACTION: &str = "monocode.session.show";

    fn options() -> UNAuthorizationOptions {
        UNAuthorizationOptions::Alert
            | UNAuthorizationOptions::Sound
            | UNAuthorizationOptions::Badge
    }

    fn map_permission(
        authorization: UNAuthorizationStatus,
        alert_setting: UNNotificationSetting,
        alert_style: UNAlertStyle,
    ) -> Permission {
        match authorization {
            UNAuthorizationStatus::NotDetermined => Permission::Prompt,
            UNAuthorizationStatus::Denied => Permission::Denied,
            // Authorization alone does not guarantee a visible alert on
            // macOS: users can leave alerts enabled but select no alert style.
            _ if alert_setting == UNNotificationSetting::Disabled
                || alert_style == UNAlertStyle::None =>
            {
                Permission::Denied
            }
            _ => Permission::Granted,
        }
    }

    fn map_settings(settings: &UNNotificationSettings) -> Permission {
        map_permission(
            settings.authorizationStatus(),
            settings.alertSetting(),
            settings.alertStyle(),
        )
    }

    /// Completion handlers run on a UN background queue. The ObjC objects
    /// are released before any `.await` so the command future stays `Send`;
    /// only the channel crosses into the async runtime.
    fn query_permission() -> mpsc::Receiver<Permission> {
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
            let settings = unsafe { settings.as_ref() };
            let _ = tx.send(map_settings(settings));
        });
        UNUserNotificationCenter::currentNotificationCenter()
            .getNotificationSettingsWithCompletionHandler(&handler);
        rx
    }

    fn start_request() -> mpsc::Receiver<()> {
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |_granted: Bool, _error: *mut NSError| {
            let _ = tx.send(());
        });
        UNUserNotificationCenter::currentNotificationCenter()
            .requestAuthorizationWithOptions_completionHandler(options(), &handler);
        rx
    }

    /// A dispatch still unanswered by now has already lost to the in-app cue,
    /// so the caller gives up rather than leaving the turn silent.
    const DISPATCH_TIMEOUT: Duration = Duration::from_secs(5);

    /// `None` waits indefinitely, which is what the permission prompt needs:
    /// its handler does not run until the user answers the system dialog.
    async fn wait<T: Send + 'static>(
        rx: mpsc::Receiver<T>,
        timeout: Option<Duration>,
    ) -> Option<T> {
        tauri::async_runtime::spawn_blocking(move || match timeout {
            Some(timeout) => rx.recv_timeout(timeout).ok(),
            None => rx.recv().ok(),
        })
        .await
        .ok()
        .flatten()
    }

    pub(super) async fn permission(_app: &AppHandle) -> Permission {
        wait(query_permission(), None)
            .await
            .unwrap_or(Permission::Denied)
    }

    pub(super) async fn request_permission(app: &AppHandle) -> Permission {
        wait(start_request(), None).await;
        permission(app).await
    }

    /// Hands the request to the center and reports what its completion
    /// handler says. Authorization is settled before this runs, so an
    /// undetermined status never turns a finished turn into a system prompt.
    fn start_show(
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> mpsc::Receiver<Result<(), String>> {
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(title));
        content.setSubtitle(&NSString::from_str(subtitle));
        content.setBody(&NSString::from_str(body));
        content.setCategoryIdentifier(&NSString::from_str(CATEGORY));
        if sound {
            content.setSound(Some(&UNNotificationSound::defaultSound()));
        }
        let identifier = NSString::from_str(&request_identifier(session_id));
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &identifier,
            &content,
            None,
        );
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |error: *mut NSError| {
            let result = match NonNull::new(error) {
                Some(error) => Err(format!("notification rejected: {}", unsafe {
                    error.as_ref()
                })),
                None => Ok(()),
            };
            let _ = tx.send(result);
        });
        UNUserNotificationCenter::currentNotificationCenter()
            .addNotificationRequest_withCompletionHandler(&request, Some(&handler));
        rx
    }

    pub(super) async fn show(
        _app: &AppHandle,
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> Result<super::ShowOutcome, String> {
        // Asked here rather than trusted from the frontend, whose cached
        // permission goes stale when alerts are switched off in System
        // Settings and whose badge-only case the center accepts silently.
        if wait(query_permission(), Some(DISPATCH_TIMEOUT)).await != Some(Permission::Granted) {
            return Err("notifications are not authorized".into());
        }
        wait(
            start_show(session_id, title, subtitle, body, sound),
            Some(DISPATCH_TIMEOUT),
        )
        .await
        .unwrap_or_else(|| Err("notification dispatch timed out".into()))
        .map(|()| super::ShowOutcome { os_sound: sound })
    }

    pub(super) fn open_settings(app: &AppHandle) -> Result<(), String> {
        let url = format!(
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id={}",
            app.config().identifier
        );
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    struct DelegateIvars {
        app: AppHandle,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "MonoCodeNotificationDelegate"]
        #[ivars = DelegateIvars]
        struct Delegate;

        unsafe impl NSObjectProtocol for Delegate {}

        unsafe impl UNUserNotificationCenterDelegate for Delegate {
            /// Without this macOS drops banners while the app is frontmost,
            /// and a finished background session deserves one either way.
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                completion.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List
                    | UNNotificationPresentationOptions::Sound,));
            }

            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &block2::DynBlock<dyn Fn()>,
            ) {
                let identifier = response.notification().request().identifier().to_string();
                if let Some(session_id) = session_from_identifier(&identifier) {
                    super::handle_click(&self.ivars().app, session_id);
                }
                completion.call(());
            }
        }
    );

    thread_local! {
        static DELEGATE: RefCell<Option<Retained<Delegate>>> = const { RefCell::new(None) };
    }

    /// Must run on the main thread once the app is ready; the center keeps a
    /// weak reference, so the delegate is retained here for the app lifetime.
    pub fn install_delegate(app: &AppHandle) {
        if MainThreadMarker::new().is_none() {
            return;
        }
        let delegate = Delegate::alloc().set_ivars(DelegateIvars { app: app.clone() });
        let delegate: Retained<Delegate> = unsafe { objc2::msg_send![super(delegate), init] };
        let center = UNUserNotificationCenter::currentNotificationCenter();
        center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        DELEGATE.with(|slot| *slot.borrow_mut() = Some(delegate));

        let show = UNNotificationAction::actionWithIdentifier_title_options(
            &NSString::from_str(SHOW_ACTION),
            &NSString::from_str("Show"),
            UNNotificationActionOptions::Foreground,
        );
        let category =
            UNNotificationCategory::categoryWithIdentifier_actions_intentIdentifiers_options(
                &NSString::from_str(CATEGORY),
                &NSArray::from_retained_slice(&[show]),
                &NSArray::new(),
                UNNotificationCategoryOptions::empty(),
            );
        center.setNotificationCategories(&NSSet::from_retained_slice(&[category]));
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use objc2::runtime::AnyProtocol;
        use objc2::{sel, ClassType};

        #[test]
        fn identifier_round_trips_the_session() {
            let id = request_identifier("549ae7ac");
            assert_eq!(session_from_identifier(&id), Some("549ae7ac"));
            assert_eq!(session_from_identifier("other"), None);
        }

        #[test]
        fn permission_requires_a_visible_alert_style() {
            assert_eq!(
                map_permission(
                    UNAuthorizationStatus::Authorized,
                    UNNotificationSetting::Enabled,
                    UNAlertStyle::None,
                ),
                Permission::Denied,
            );
            assert_eq!(
                map_permission(
                    UNAuthorizationStatus::Authorized,
                    UNNotificationSetting::Enabled,
                    UNAlertStyle::Banner,
                ),
                Permission::Granted,
            );
        }

        #[test]
        fn wait_reports_what_the_completion_handler_sent() {
            let (tx, rx) = mpsc::channel();
            tx.send(Err::<(), String>("rejected".into())).unwrap();
            let got = tauri::async_runtime::block_on(wait(rx, None));
            assert_eq!(got, Some(Err("rejected".into())));
        }

        #[test]
        fn wait_gives_up_when_the_completion_handler_never_runs() {
            let (tx, rx) = mpsc::channel::<Result<(), String>>();
            let got = tauri::async_runtime::block_on(wait(rx, Some(Duration::from_millis(20))));
            assert_eq!(got, None);
            drop(tx);
        }

        #[test]
        fn delegate_registers_protocol_methods() {
            let cls = Delegate::class();
            let proto =
                AnyProtocol::get(c"UNUserNotificationCenterDelegate").expect("protocol loaded");
            assert!(cls.conforms_to(proto));
            assert!(cls.responds_to(sel!(
                userNotificationCenter:willPresentNotification:withCompletionHandler:
            )));
            assert!(cls.responds_to(sel!(
                userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
            )));
        }
    }
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

#[cfg(target_os = "windows")]
mod platform {
    use tauri::AppHandle;

    use super::{handle_click, Permission};

    /// Action payload for the explicit "Show" button. The body click carries
    /// no arguments, so the session id is also captured in the activation
    /// closure; the payload is a fallback for routing, not the primary path.
    /// Reminder identifiers (`reminder:<session>:<due>`) flow through the
    /// same path and are routed by `handle_click`.
    const SHOW_ACTION_PREFIX: &str = "show:";

    /// Wraps the session id in the "Show" button's activation payload.
    fn show_action(session_id: &str) -> String {
        format!("{SHOW_ACTION_PREFIX}{session_id}")
    }

    /// Reads the session id back out of a "Show" button payload.
    fn session_from_action(action: &str) -> Option<&str> {
        action.strip_prefix(SHOW_ACTION_PREFIX)
    }

    /// Collapses the WinRT setting onto the frontend's decision. Only
    /// `Enabled` is unblocked; `None` is "could not ask" and defers to the
    /// dispatch.
    fn blocked_from_setting(
        setting: Option<windows::UI::Notifications::NotificationSetting>,
    ) -> Option<bool> {
        use windows::UI::Notifications::NotificationSetting;
        match setting {
            Some(NotificationSetting::Enabled) => Some(false),
            // DisabledForApplication / ForUser / ByGroupPolicy / ByManifest.
            Some(_) => Some(true),
            None => None,
        }
    }

    /// Whether Windows blocks toasts for this AppUserModelID. `None` means the
    /// system could not be asked — an unknown ID (`tauri dev` before the
    /// shortcut exists) or a WinRT failure — and the dispatch itself decides.
    fn toasts_blocked(app_id: &str) -> Option<bool> {
        use windows::core::HSTRING;
        use windows::UI::Notifications::ToastNotificationManager;
        let notifier =
            ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app_id)).ok()?;
        blocked_from_setting(notifier.Setting().ok())
    }

    /// Asks the toast system, which reflects the per-app toggle, the user-wide
    /// switch and group policy. There is no prompt to show, so a request just
    /// re-reads the same state.
    pub(super) async fn permission(app: &AppHandle) -> Permission {
        let app_id = app.config().identifier.clone();
        let blocked = tauri::async_runtime::spawn_blocking(move || toasts_blocked(&app_id))
            .await
            .ok()
            .flatten();
        if blocked == Some(true) {
            Permission::Denied
        } else {
            Permission::Granted
        }
    }

    pub(super) async fn request_permission(app: &AppHandle) -> Permission {
        // Windows has no authorization dialog; Settings owns the decision.
        permission(app).await
    }

    pub(super) async fn show(
        app: &AppHandle,
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> Result<super::ShowOutcome, String> {
        // `Toast` is `!Send`, so construct and dispatch it inside the blocking
        // thread; only owned `Send` data crosses into the closure.
        let app = app.clone();
        let app_id = app.config().identifier.clone();
        let session_id = session_id.to_string();
        let title = title.to_string();
        let subtitle = subtitle.to_string();
        let body = body.to_string();
        tauri::async_runtime::spawn_blocking(move || {
            show_blocking(&app, &app_id, &session_id, &title, &subtitle, &body, sound)
        })
        .await
        .map_err(|err| err.to_string())??;
        Ok(super::ShowOutcome { os_sound: sound })
    }

    /// Dispatches on the blocking thread a `Toast` needs, honouring a Windows
    /// block first so the caller's in-app cue stands in when no banner shows.
    fn show_blocking(
        app: &AppHandle,
        app_id: &str,
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> Result<(), String> {
        use tauri_winrt_notification::Toast;

        if toasts_blocked(app_id) == Some(true) {
            return Err("notifications are disabled in Windows settings".into());
        }

        // Installed NSIS builds resolve the bundle identifier through the
        // Start Menu shortcut's AppUserModelID. `tauri dev` has no shortcut,
        // so fall back to the PowerShell host ID (wrong branding, but visible)
        // when the real ID fails.
        match show_with_app_id(app, app_id, session_id, title, subtitle, body, sound) {
            Ok(()) => Ok(()),
            Err(first) if app_id != Toast::POWERSHELL_APP_ID => show_with_app_id(
                app,
                Toast::POWERSHELL_APP_ID,
                session_id,
                title,
                subtitle,
                body,
                sound,
            )
            .map_err(|fallback| format!("{first}; dev fallback: {fallback}")),
            Err(first) => Err(first),
        }
    }

    /// Builds and shows one toast under `app_id`, wiring the "Show" button to
    /// the shared click router.
    fn show_with_app_id(
        app: &AppHandle,
        app_id: &str,
        session_id: &str,
        title: &str,
        subtitle: &str,
        body: &str,
        sound: bool,
    ) -> Result<(), String> {
        use tauri_winrt_notification::{Sound, Toast};

        let app = app.clone();
        let owned_session = session_id.to_string();
        let sound = if sound { Some(Sound::Default) } else { None };
        // The default icon comes from the AppUserModelID registration; an
        // explicit icon needs an absolute non-UNC path and is left out for v1.
        Toast::new(app_id)
            .title(title)
            .text1(subtitle)
            .text2(body)
            .sound(sound)
            .add_button("Show", &show_action(session_id))
            .on_activated(move |action| {
                let session = action
                    .as_deref()
                    .and_then(session_from_action)
                    .unwrap_or(&owned_session)
                    .to_string();
                handle_click(&app, session.as_str());
                Ok(())
            })
            .show()
            .map_err(|err| err.to_string())
    }

    /// Opens Settings > System > Notifications, where the per-app toggle lives.
    pub(super) fn open_settings(_app: &AppHandle) -> Result<(), String> {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", "ms-settings:notifications"]);
        crate::hide_window_console(&mut cmd);
        cmd.spawn().map(|_| ()).map_err(|err| err.to_string())
    }

    #[cfg(test)]
    mod tests {
        use windows::UI::Notifications::NotificationSetting;

        use super::{blocked_from_setting, session_from_action, show_action};

        #[test]
        fn show_action_round_trips_the_session() {
            let action = show_action("549ae7ac");
            assert_eq!(session_from_action(&action), Some("549ae7ac"));
            assert_eq!(session_from_action("other"), None);
        }

        #[test]
        fn show_action_preserves_reminder_identifiers() {
            let action = show_action("reminder:549ae7ac:1700000000");
            assert_eq!(
                session_from_action(&action),
                Some("reminder:549ae7ac:1700000000")
            );
        }

        #[test]
        fn only_an_enabled_setting_is_unblocked() {
            assert_eq!(
                blocked_from_setting(Some(NotificationSetting::Enabled)),
                Some(false)
            );
            assert_eq!(
                blocked_from_setting(Some(NotificationSetting::DisabledForApplication)),
                Some(true)
            );
            assert_eq!(
                blocked_from_setting(Some(NotificationSetting::DisabledForUser)),
                Some(true)
            );
            assert_eq!(
                blocked_from_setting(Some(NotificationSetting::DisabledByGroupPolicy)),
                Some(true)
            );
            assert_eq!(blocked_from_setting(None), None);
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
