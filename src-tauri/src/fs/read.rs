use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use super::constants::{MAX_ATTACHMENT_EMBED_BYTES, MAX_PREVIEW_BYTES, MAX_TEXT_FILE_BYTES};
use super::git::git_cmd;
use super::path::{expand_home, path_to_js};
use super::write::project_root;
use crate::dirs_home;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    ignored: bool,
}

/// Immediate children of `path` (project tree). Folders first, then files.
#[tauri::command(async)]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let dir = expand_home(&path);
    let reader = std::fs::read_dir(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let ignore = Ignore::load(&dir);

    let mut out = Vec::new();
    for ent in reader {
        let Ok(ent) = ent else { continue };
        let name = ent.file_name();
        let Some(name) = name.to_str() else { continue };
        if name == ".DS_Store" {
            continue;
        }
        let path = ent.path();
        let is_dir = ent
            .file_type()
            .map(|t| t.is_dir() || (t.is_symlink() && path.is_dir()))
            .unwrap_or_else(|_| path.is_dir());
        out.push(DirEntry {
            ignored: ignore.matches(name),
            name: name.to_string(),
            path: path_to_js(&path),
            is_dir,
        });
    }

    out.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| {
            a.name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase())
        })
    });
    Ok(out)
}

const MAX_PROJECT_FILES: usize = 20_000;
const MAX_WALK_DIRS: usize = 4_000;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) relative: String,
}

/// Workspace files for Quick Open. Prefer `git ls-files` (gitignore-aware,
/// index-backed); otherwise a bounded walk that never descends into vendor dirs.
#[tauri::command]
pub async fn list_project_files(cwd: String) -> Result<Vec<ProjectFile>, String> {
    tauri::async_runtime::spawn_blocking(move || list_project_files_sync(&cwd))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn list_project_files_sync(cwd: &str) -> Result<Vec<ProjectFile>, String> {
    let root = expand_home(cwd);
    if !root.is_dir() {
        return Err(format!("{}: Not a directory", root.display()));
    }
    if !is_indexable_root(&root) {
        return Ok(Vec::new());
    }
    if let Some(files) = git_ls_files(&root) {
        return Ok(files);
    }
    Ok(walk_project_files(&root))
}

fn git_ls_files(root: &Path) -> Option<Vec<ProjectFile>> {
    let output = git_cmd()
        .arg("-C")
        .arg(root)
        .args(["ls-files", "-co", "--exclude-standard", "-z"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let mut files = Vec::new();
    for rel in output.stdout.split(|b| *b == 0) {
        if rel.is_empty() {
            continue;
        }
        let relative = path_to_js(Path::new(String::from_utf8_lossy(rel).as_ref()));
        if relative.ends_with('/') || path_has_skipped_dir(&relative) {
            continue;
        }
        let path = root.join(&relative);
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name == ".DS_Store" {
            continue;
        }
        files.push(ProjectFile {
            name: name.to_string(),
            path: path_to_js(&path),
            relative,
        });
        if files.len() >= MAX_PROJECT_FILES {
            break;
        }
    }
    Some(files)
}

pub(crate) fn walk_project_files(root: &Path) -> Vec<ProjectFile> {
    let ignore = Ignore::load(root);
    let mut files = Vec::new();
    let mut dirs = vec![root.to_path_buf()];
    let mut visited = 0usize;

    while let Some(dir) = dirs.pop() {
        visited += 1;
        if visited > MAX_WALK_DIRS || files.len() >= MAX_PROJECT_FILES {
            break;
        }
        let Ok(reader) = std::fs::read_dir(&dir) else {
            continue;
        };
        for ent in reader {
            let Ok(ent) = ent else { continue };
            let name = ent.file_name();
            let Some(name) = name.to_str() else { continue };
            if name == ".DS_Store" {
                continue;
            }
            let path = ent.path();
            let is_dir = match ent.file_type() {
                Ok(t) if t.is_symlink() => continue,
                Ok(t) => t.is_dir(),
                Err(_) => path.is_dir(),
            };
            if is_dir {
                if skip_walk_dir_name(name) || ignore.matches(name) || is_private_dir(&path) {
                    continue;
                }
                dirs.push(path);
                continue;
            }
            if ignore.matches(name) {
                continue;
            }
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            let relative = path_to_js(relative);
            files.push(ProjectFile {
                name: name.to_string(),
                path: path_to_js(&path),
                relative,
            });
            if files.len() >= MAX_PROJECT_FILES {
                break;
            }
        }
    }
    files
}

fn skip_walk_dir_name(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | "out"
            | ".next"
            | ".nuxt"
            | ".output"
            | ".cache"
            | ".turbo"
            | ".parcel-cache"
            | ".vercel"
            | ".svelte-kit"
            | "coverage"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".tox"
            | ".mypy_cache"
            | ".pytest_cache"
            | ".gradle"
            | ".idea"
            | "Pods"
            | "vendor"
            | "bower_components"
            | ".yarn"
            | ".pnpm-store"
    )
}

fn path_has_skipped_dir(relative: &str) -> bool {
    relative
        .split(std::path::is_separator)
        .any(skip_walk_dir_name)
}

/// Directories the OS guards behind a consent prompt. macOS pops "would like to
/// access data from other apps" the first time a process reads another app's
/// container, and the grant is per-folder — so a walk that brushes past a few of
/// them prompts again on every launch. Nothing in here is a user project, so the
/// indexer treats them as if they did not exist.
fn is_private_dir(path: &Path) -> bool {
    if path.extension().is_some_and(|ext| ext == "app") {
        return true;
    }
    if !cfg!(target_os = "macos") {
        return false;
    }
    let guarded = [
        dirs_home().map(|home| PathBuf::from(home).join("Library")),
        dirs_home().map(|home| PathBuf::from(home).join(".Trash")),
        Some(PathBuf::from("/Library")),
        Some(PathBuf::from("/System")),
    ];
    guarded
        .iter()
        .flatten()
        .any(|guarded| path == guarded.as_path())
}

/// Roots too broad to index. Walking a home or volume root is never useful for
/// Quick Open — it buries project files under tens of thousands of dotfiles and
/// caches — and it is the one thing guaranteed to reach a private dir.
pub(crate) fn is_indexable_root(root: &Path) -> bool {
    if is_private_dir(root) {
        return false;
    }
    if root.parent().is_none() {
        return false;
    }
    let too_broad = [
        dirs_home().map(PathBuf::from),
        Some(PathBuf::from("/Users")),
        Some(PathBuf::from("/Applications")),
        Some(PathBuf::from("/Volumes")),
        Some(PathBuf::from("/home")),
    ];
    !too_broad
        .iter()
        .flatten()
        .any(|broad| root == broad.as_path())
}

struct Ignore {
    exact: HashSet<String>,
    suffixes: Vec<String>,
}

impl Ignore {
    fn load(from: &Path) -> Self {
        let mut exact = HashSet::from([".git".into()]);
        let mut suffixes = Vec::new();
        let root = project_root(from);
        if let Ok(text) = std::fs::read_to_string(root.join(".gitignore")) {
            for raw in text.lines() {
                let line = raw.trim();
                if line.is_empty() || line.starts_with('#') || line.starts_with('!') {
                    continue;
                }
                let line = line.trim_end_matches('/');
                if line.contains('/') {
                    continue;
                }
                if let Some(ext) = line.strip_prefix("*.") {
                    if !ext.is_empty() && !ext.contains('*') {
                        suffixes.push(format!(".{ext}"));
                    }
                    continue;
                }
                exact.insert(line.to_string());
            }
        }
        Self { exact, suffixes }
    }

    fn matches(&self, name: &str) -> bool {
        self.exact.contains(name) || self.suffixes.iter().any(|s| name.ends_with(s))
    }
}

/// First few lines of a text file for tool previews.
#[tauri::command(async)]
pub fn read_file_preview(
    path: String,
    max_lines: usize,
    start_line: Option<usize>,
) -> Result<Vec<String>, String> {
    use std::io::{BufRead, BufReader};

    let path = expand_home(&path);
    let meta = std::fs::metadata(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }

    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let limit = max_lines.clamp(1, 12);
    let start = start_line.unwrap_or(1).max(1);
    let mut lines = Vec::new();
    for (i, line) in reader.lines().enumerate() {
        let line_no = i + 1;
        if line_no < start {
            continue;
        }
        if lines.len() >= limit {
            break;
        }
        let mut line = line.map_err(|e| e.to_string())?;
        if line.contains('\0') {
            return Err("Binary file".into());
        }
        if line.len() > 200 {
            line.truncate(199);
            line.push('…');
        }
        lines.push(line);
    }
    Ok(lines)
}

const MAX_STAT_FILES: usize = 64;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMtime {
    pub(crate) path: String,
    pub(crate) mtime_ms: Option<u64>,
}

fn file_mtime_ms(meta: &std::fs::Metadata) -> Option<u64> {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// Metadata only — used to notice disk changes on currently open editors.
#[tauri::command(async)]
pub fn stat_files(paths: Vec<String>) -> Result<Vec<FileMtime>, String> {
    if paths.len() > MAX_STAT_FILES {
        return Err("Too many paths".into());
    }
    Ok(paths
        .into_iter()
        .map(|path| {
            let expanded = expand_home(&path);
            let mtime_ms = std::fs::metadata(&expanded)
                .ok()
                .filter(|meta| meta.is_file())
                .and_then(|meta| file_mtime_ms(&meta));
            FileMtime { path, mtime_ms }
        })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
}

/// Metadata for files the composer is attaching (picker, drop, paste).
#[tauri::command(async)]
pub fn inspect_paths(paths: Vec<String>) -> Vec<PathInfo> {
    paths
        .into_iter()
        .filter_map(|path| inspect_path_sync(&path))
        .collect()
}

fn inspect_path_sync(path: &str) -> Option<PathInfo> {
    let path = expand_home(path);
    let meta = std::fs::metadata(&path).ok()?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path.to_str().unwrap_or("attachment"))
        .to_string();
    Some(PathInfo {
        path: path_to_js(&path),
        name,
        size: meta.len(),
        is_dir: meta.is_dir(),
    })
}

/// Base64-encode a file so vision images can be sent inline over ACP.
#[tauri::command]
pub async fn read_file_base64(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || read_file_base64_sync(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn read_file_base64_sync(path: &str) -> Result<String, String> {
    let path = expand_home(path);
    let meta = std::fs::metadata(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }
    if meta.len() > MAX_ATTACHMENT_EMBED_BYTES {
        return Err(format!(
            "File is too large to attach inline (maximum {} MB).",
            MAX_ATTACHMENT_EMBED_BYTES / 1024 / 1024
        ));
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    ))
}

/// Read a file as raw bytes for the image viewer.
///
/// Returns an `ipc::Response`, which reaches the webview as an ArrayBuffer, so
/// previews skip the 33% base64 inflation that inline attachments pay. The
/// caller decides what the bytes are by sniffing them; this only guards size.
#[tauri::command]
pub async fn read_binary_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || read_binary_file_sync(&path))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

pub(crate) fn read_binary_file_sync(path: &str) -> Result<Vec<u8>, String> {
    let path = expand_home(path);
    let meta = std::fs::metadata(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }
    if meta.len() > MAX_PREVIEW_BYTES {
        return Err(format!(
            "File is too large to preview (maximum {} MB).",
            MAX_PREVIEW_BYTES / 1024 / 1024
        ));
    }
    std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))
}

/// Read a reasonably sized UTF-8 file for the editor.
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || read_text_file_sync(&path))
        .await
        .map_err(|e| e.to_string())?
}

pub(crate) fn read_text_file_sync(path: &str) -> Result<String, String> {
    let path = expand_home(path);
    let meta = std::fs::metadata(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }
    if meta.len() > MAX_TEXT_FILE_BYTES {
        return Err(format!(
            "File is too large to edit (maximum {} MB).",
            MAX_TEXT_FILE_BYTES / 1024 / 1024
        ));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if bytes.contains(&0) {
        return Err("Binary files cannot be edited.".into());
    }
    String::from_utf8(bytes).map_err(|_| "File is not valid UTF-8.".into())
}
