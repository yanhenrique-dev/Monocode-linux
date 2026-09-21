use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;

use crate::{fs::expand_home, harness};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalEditor {
    id: &'static str,
    name: &'static str,
}

struct EditorDefinition {
    id: &'static str,
    name: &'static str,
    commands: &'static [&'static str],
}

const EDITORS: &[EditorDefinition] = &[
    EditorDefinition {
        id: "vscode",
        name: "Visual Studio Code",
        commands: &["code"],
    },
    EditorDefinition {
        id: "vscode-insiders",
        name: "Visual Studio Code Insiders",
        commands: &["code-insiders"],
    },
    EditorDefinition {
        id: "vscodium",
        name: "VSCodium",
        commands: &["codium"],
    },
    EditorDefinition {
        id: "cursor",
        name: "Cursor",
        commands: &["cursor"],
    },
    EditorDefinition {
        id: "zed",
        name: "Zed",
        commands: &["zed"],
    },
    EditorDefinition {
        id: "windsurf",
        name: "Windsurf",
        commands: &["windsurf"],
    },
    EditorDefinition {
        id: "sublime-text",
        name: "Sublime Text",
        commands: &["subl", "sublime_text"],
    },
];

fn definition(id: &str) -> Option<&'static EditorDefinition> {
    EDITORS.iter().find(|editor| editor.id == id)
}

fn resolve_editor(editor: &EditorDefinition) -> Option<PathBuf> {
    editor
        .commands
        .iter()
        .find_map(|command| harness::resolve_gui_binary(command))
}

fn installed_editors_sync() -> Vec<ExternalEditor> {
    EDITORS
        .iter()
        .filter(|editor| resolve_editor(editor).is_some())
        .map(|editor| ExternalEditor {
            id: editor.id,
            name: editor.name,
        })
        .collect()
}

#[tauri::command(async)]
pub async fn list_external_editors() -> Result<Vec<ExternalEditor>, String> {
    tauri::async_runtime::spawn_blocking(installed_editors_sync)
        .await
        .map_err(|error| error.to_string())
}

fn launch_editor_sync(editor_id: &str, cwd: &str) -> Result<(), String> {
    let editor = definition(editor_id).ok_or_else(|| "Unknown external editor.".to_string())?;
    let cwd = expand_home(cwd);
    if !cwd.is_dir() {
        return Err(format!("{} is not a folder.", cwd.display()));
    }
    let program =
        resolve_editor(editor).ok_or_else(|| format!("{} is no longer installed.", editor.name))?;

    // Sandboxed: external editors are host applications.
    let mut command = crate::host::command(&program);
    command.arg(&cwd);

    harness::apply_gui_env(&mut command);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open {}: {error}", editor.name))
}

#[tauri::command(async)]
pub async fn open_in_external_editor(editor_id: String, cwd: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || launch_editor_sync(&editor_id, &cwd))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editor_ids_and_names_are_unique() {
        let mut ids = std::collections::HashSet::new();
        let mut names = std::collections::HashSet::new();
        for editor in EDITORS {
            assert!(ids.insert(editor.id), "duplicate editor id: {}", editor.id);
            assert!(
                names.insert(editor.name),
                "duplicate editor name: {}",
                editor.name
            );
            assert!(!editor.commands.is_empty());
        }
    }

    #[test]
    fn unknown_editor_is_rejected_before_launch() {
        let error = launch_editor_sync("not-an-editor", ".").unwrap_err();
        assert_eq!(error, "Unknown external editor.");
    }
}
