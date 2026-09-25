//! Native settings store.
//!
//! Settings used to live only in the webview's `localStorage`: roughly seventy
//! keys spread across thirty modules, each with its own `load*`/`save*`/
//! `subscribe*` trio, no shared type, no validation, and no single place to look
//! at what the app had stored. This module is the other half of the move --
//! one file, one schema, one place to read.
//!
//! It is wired to the frontend in a later step. Until then nothing calls it,
//! which is deliberate: the persistence layer can be reviewed and tested on
//! its own before any key starts migrating out of `localStorage`.
//!
//! ## Schema, not migration
//!
//! `schema` gates the file. A value that is not [`SCHEMA`] is discarded and
//! defaults are returned, rather than migrated field by field. The app is in
//! Alpha, the store is new, and a version gate that throws away a shape it
//! does not recognise is simpler to reason about than a migration table that
//! only ever runs once.
//!
//! ## Three tiers
//!
//! [`Prefs`] is what the user chose and the settings UI searches.
//! [`View`] is window and pane state -- remembered, not surfaced.
//! [`Runtime`] is caches and timestamps, safe to lose at any time.
//! The split is the point: it is what lets the search index be derived from
//! `prefs` alone instead of hand-maintained against a key list that nothing
//! validates.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[cfg(unix)]
use std::os::unix::fs::DirBuilderExt;

/// Bump when the shape changes. A stored file carrying anything else is
/// discarded on load.
pub const SCHEMA: u32 = 1;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub schema: u32,
    pub prefs: Prefs,
    pub view: View,
    pub runtime: Runtime,
}

impl Settings {
    /// What a fresh install, or an unreadable file, resolves to.
    pub fn defaults() -> Self {
        Self {
            schema: SCHEMA,
            ..Self::default()
        }
    }

    /// True when the stored shape is one this build understands.
    fn is_current(&self) -> bool {
        self.schema == SCHEMA
    }

    /// Reject values that would break the UI rather than persist them.
    ///
    /// The frontend clamps before it writes, so this is a backstop for a
    /// hand-edited file, an import, or a field that lost its clamp. The
    /// alternative -- store whatever arrived -- turns a bad number into a
    /// permanently broken sidebar that no amount of toggling recovers.
    pub fn validate(&self) -> Result<(), String> {
        if self.prefs.appearance.theme_hue > 360 {
            return Err(format!(
                "themeHue must be 0-360, got {}",
                self.prefs.appearance.theme_hue
            ));
        }
        if self.prefs.appearance.sidebar_opacity > 100 {
            return Err(format!(
                "sidebarOpacity must be 0-100, got {}",
                self.prefs.appearance.sidebar_opacity
            ));
        }
        if self.view.sidebar_tab_order.len() > 16 {
            return Err("sidebarTabOrder has more entries than there are tabs".into());
        }
        // Enforced here as well as in the UI, so an import or a hand-edited
        // file cannot store a selection the bar could never render.
        if self.prefs.chat.next_steps.enabled && !self.prefs.chat.next_steps.actions.any_enabled() {
            return Err("nextSteps.actions cannot be empty while nextSteps.enabled is on".into());
        }
        Ok(())
    }
}

/// What the user chose. This is the tier the settings UI searches.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Prefs {
    pub general: GeneralPrefs,
    pub appearance: AppearancePrefs,
    pub chat: ChatPrefs,
    pub diagnostics: DiagnosticsPrefs,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneralPrefs {
    /// "en" or "pt-BR". An unknown value falls back at read time, not here.
    pub locale: String,
}

impl Default for GeneralPrefs {
    fn default() -> Self {
        Self {
            locale: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearancePrefs {
    pub color_scheme: String,
    pub theme_hue: u16,
    /// Percent, so the wire format has no float rounding to argue about.
    pub sidebar_opacity: u8,
}

impl Default for AppearancePrefs {
    fn default() -> Self {
        Self {
            color_scheme: "dark".to_string(),
            theme_hue: 240,
            sidebar_opacity: 85,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ChatPrefs {
    pub next_steps: NextStepsPrefs,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NextStepsPrefs {
    pub enabled: bool,
    /// The model call, separable from the bar: the shortcuts are free and
    /// local, the suggestions are a side-channel call per completed turn.
    pub suggest: bool,
    pub actions: NextStepActions,
}

impl Default for NextStepsPrefs {
    fn default() -> Self {
        Self {
            enabled: false,
            suggest: true,
            actions: NextStepActions::default(),
        }
    }
}

/// One flag per action rather than a count: the old `2 | 3` selector sliced
/// before it filtered, so the number it promised was not the number rendered.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NextStepActions {
    pub jump_to_bottom: bool,
    pub search_transcript: bool,
    pub review_changes: bool,
}

impl Default for NextStepActions {
    fn default() -> Self {
        Self {
            jump_to_bottom: true,
            search_transcript: true,
            review_changes: false,
        }
    }
}

impl NextStepActions {
    /// The last one standing cannot be switched off: an all-off selection
    /// makes the master switch meaningless, since the bar could never render.
    pub fn any_enabled(&self) -> bool {
        self.jump_to_bottom || self.search_transcript || self.review_changes
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DiagnosticsPrefs {
    /// Empty means debug output is off. `*` means everything.
    pub debug_scopes: Vec<String>,
}

/// Window and pane state. Remembered, not searched.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct View {
    pub project_rail_open: bool,
    pub settings_section: String,
    pub sidebar_tab_order: Vec<String>,
}

/// Caches and timestamps. Losing any of this is harmless by construction.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Runtime {
    /// Epoch millis of the last successful update check, or 0 for never.
    pub last_update_check: u64,
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(SETTINGS_FILE))
}

fn ensure_data_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        // The parent also holds the session database, which can hold secrets.
        // 0700 regardless of the process umask, matching session_store.
        std::fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(parent)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Read the file, or return defaults.
///
/// Never fails. A missing file, a file this build does not recognise, a
/// truncated write, or outright garbage all resolve to the defaults, because
/// a settings store that can brick the app on a bad byte is worse than one
/// that forgets.
pub fn load(app: &AppHandle) -> Settings {
    let Ok(path) = settings_path(app) else {
        return Settings::defaults();
    };
    read_settings(&path)
}

fn read_settings(path: &Path) -> Settings {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return Settings::defaults();
    };
    let Ok(parsed) = serde_json::from_str::<Settings>(&raw) else {
        return Settings::defaults();
    };
    if !parsed.is_current() {
        return Settings::defaults();
    }
    parsed
}

/// Write atomically: a crash mid-write leaves the previous file, never a half
/// written one that would read back as garbage and reset every preference.
fn write_settings(path: &Path, settings: &Settings) -> Result<(), String> {
    ensure_data_dir(path)?;
    let temp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;

    write_file_mode(&temp, json.as_bytes())?;
    match std::fs::rename(&temp, path) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = std::fs::remove_file(&temp);
            Err(format!("{}: {error}", path.display()))
        }
    }
}

/// 0600 from the start rather than set after the fact, so the contents are
/// never briefly world-readable.
fn write_file_mode(path: &Path, bytes: &[u8]) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| format!("{}: {e}", path.display()))?;
        file.write_all(bytes)
            .map_err(|e| format!("{}: {e}", path.display()))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, bytes).map_err(|e| format!("{}: {e}", path.display()))
    }
}

#[tauri::command]
pub async fn settings_load(app: AppHandle) -> Result<Settings, String> {
    tauri::async_runtime::spawn_blocking(move || load(&app))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn settings_save(app: AppHandle, settings: Settings) -> Result<(), String> {
    settings.validate()?;
    tauri::async_runtime::spawn_blocking(move || {
        let path = settings_path(&app)?;
        write_settings(&path, &settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Forget everything. Absence already means defaults, so this removes the file
/// rather than writing a defaults document that would have to be kept in sync.
#[tauri::command]
pub async fn settings_reset(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = settings_path(&app)?;
        match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("{}: {error}", path.display())),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("monocode-settings-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn defaults_carry_the_current_schema() {
        let defaults = Settings::defaults();
        assert_eq!(defaults.schema, SCHEMA);
        assert!(defaults.is_current());
    }

    #[test]
    fn roundtrips_through_the_file() {
        let dir = temp_dir("roundtrip");
        let path = dir.join(SETTINGS_FILE);

        let mut saved = Settings::defaults();
        saved.prefs.general.locale = "pt-BR".to_string();
        saved.prefs.appearance.theme_hue = 100;
        saved.prefs.chat.next_steps.enabled = true;
        saved.prefs.chat.next_steps.actions.review_changes = true;
        saved.prefs.diagnostics.debug_scopes = vec!["harness".to_string()];
        saved.view.project_rail_open = true;
        saved.runtime.last_update_check = 1_700_000_000_000;

        write_settings(&path, &saved).expect("write");
        assert_eq!(read_settings(&path), saved);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_file_reads_as_defaults() {
        let dir = temp_dir("missing");
        assert_eq!(
            read_settings(&dir.join(SETTINGS_FILE)),
            Settings::defaults()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_empty_file_reads_as_defaults() {
        let dir = temp_dir("empty");
        let path = dir.join(SETTINGS_FILE);
        std::fs::write(&path, "").expect("write");
        assert_eq!(read_settings(&path), Settings::defaults());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // The schema gate is the whole migration story: a shape we do not
    // recognise is thrown away, not half-understood.
    #[test]
    fn an_unknown_schema_reads_as_defaults() {
        let dir = temp_dir("schema");
        let path = dir.join(SETTINGS_FILE);
        std::fs::write(
            &path,
            r#"{"schema":999,"prefs":{"general":{"locale":"pt-BR"}}}"#,
        )
        .expect("write");
        let loaded = read_settings(&path);
        assert_eq!(loaded, Settings::defaults());
        assert_eq!(loaded.prefs.general.locale, "en");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_newer_schema_reads_as_defaults() {
        let dir = temp_dir("newer");
        let path = dir.join(SETTINGS_FILE);
        std::fs::write(&path, r#"{"schema":2}"#).expect("write");
        assert_eq!(read_settings(&path), Settings::defaults());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn garbage_reads_as_defaults_instead_of_panicking() {
        for (tag, body) in [
            ("truncated", r#"{"schema":1,"prefs":{"gene"#),
            ("not-json", "this is not json at all"),
            ("array", "[1,2,3]"),
            ("null", "null"),
            ("wrong-type", r#"{"schema":"one"}"#),
        ] {
            let dir = temp_dir(tag);
            let path = dir.join(SETTINGS_FILE);
            std::fs::write(&path, body).expect("write");
            assert_eq!(read_settings(&path), Settings::defaults(), "{tag}");
            let _ = std::fs::remove_dir_all(&dir);
        }
    }

    // A file missing a field this build expects must not wipe everything else:
    // the per-field defaults are what make an additive schema change safe.
    #[test]
    fn a_partial_file_keeps_what_it_has() {
        let dir = temp_dir("partial");
        let path = dir.join(SETTINGS_FILE);
        std::fs::write(
            &path,
            r#"{"schema":1,"prefs":{"general":{"locale":"pt-BR"}}}"#,
        )
        .expect("write");
        let loaded = read_settings(&path);
        assert_eq!(loaded.prefs.general.locale, "pt-BR");
        // Everything absent fell back rather than being dropped.
        assert_eq!(loaded.prefs.appearance.theme_hue, 240);
        assert!(loaded.prefs.chat.next_steps.actions.jump_to_bottom);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_temp_file_does_not_survive_a_successful_write() {
        let dir = temp_dir("temp");
        let path = dir.join(SETTINGS_FILE);
        write_settings(&path, &Settings::defaults()).expect("write");
        assert!(!path.with_extension("json.tmp").exists());
        assert!(path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn validation_rejects_values_that_would_break_the_ui() {
        let mut settings = Settings::defaults();
        assert!(settings.validate().is_ok());

        settings.prefs.appearance.theme_hue = 400;
        assert!(settings.validate().is_err());

        let mut settings = Settings::defaults();
        settings.prefs.appearance.sidebar_opacity = 200;
        assert!(settings.validate().is_err());

        let mut settings = Settings::defaults();
        settings.view.sidebar_tab_order = (0..40).map(|i| format!("tab-{i}")).collect();
        assert!(settings.validate().is_err());
    }

    #[test]
    fn validation_rejects_an_enabled_bar_with_no_actions() {
        let mut settings = Settings::defaults();
        settings.prefs.chat.next_steps.enabled = true;
        settings.prefs.chat.next_steps.actions.jump_to_bottom = false;
        settings.prefs.chat.next_steps.actions.search_transcript = false;
        settings.prefs.chat.next_steps.actions.review_changes = false;
        assert!(settings.validate().is_err());
    }

    #[test]
    fn an_all_off_selection_is_fine_while_the_bar_is_off() {
        let mut settings = Settings::defaults();
        settings.prefs.chat.next_steps.enabled = false;
        settings.prefs.chat.next_steps.actions.jump_to_bottom = false;
        settings.prefs.chat.next_steps.actions.search_transcript = false;
        settings.prefs.chat.next_steps.actions.review_changes = false;
        assert!(settings.validate().is_ok());
    }

    #[test]
    fn an_all_off_action_selection_is_recognised_as_unusable() {
        let mut actions = NextStepActions::default();
        assert!(actions.any_enabled());
        actions.jump_to_bottom = false;
        actions.search_transcript = false;
        actions.review_changes = false;
        assert!(!actions.any_enabled());
    }

    #[cfg(unix)]
    #[test]
    fn the_settings_file_is_not_world_readable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("mode");
        let path = dir.join(SETTINGS_FILE);
        write_settings(&path, &Settings::defaults()).expect("write");
        let mode = std::fs::metadata(&path).expect("stat").permissions().mode();
        assert_eq!(mode & 0o077, 0, "expected 0600-ish, got {mode:o}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn the_data_directory_is_not_world_readable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_dir("dirmode");
        let nested = dir.join("fresh").join("deeper");
        ensure_data_dir(&nested.join(SETTINGS_FILE)).expect("ensure");
        let mode = std::fs::metadata(dir.join("fresh"))
            .expect("stat")
            .permissions()
            .mode();
        assert_eq!(mode & 0o077, 0, "expected 0700-ish, got {mode:o}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
