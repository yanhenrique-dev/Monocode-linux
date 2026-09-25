use std::path::{Path, PathBuf};

use crate::dirs_home;

pub(crate) fn expand_home(path: &str) -> PathBuf {
    if path == "~" {
        return dirs_home()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(path));
    }
    let rest = path.strip_prefix("~/").or_else(|| {
        if cfg!(windows) {
            path.strip_prefix("~\\")
        } else {
            None
        }
    });
    if let Some(rest) = rest {
        if let Some(home) = dirs_home() {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

pub(crate) fn reject_symlink_components(path: &Path) -> Result<(), String> {
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component.as_os_str());
        match std::fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("Path contains a symlink".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("{}: {error}", current.display())),
        }
    }
    Ok(())
}

pub(crate) fn canonicalize_with_missing(path: &Path) -> Result<PathBuf, String> {
    let mut existing = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| format!("{}: {error}", path.display()))?
            .join(path)
    };
    let mut missing = Vec::new();
    loop {
        match std::fs::symlink_metadata(&existing) {
            Ok(_) => break,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let name = existing
                    .file_name()
                    .ok_or_else(|| "Invalid path".to_string())?
                    .to_os_string();
                missing.push(name);
                if !existing.pop() {
                    return Err("Invalid path".into());
                }
            }
            Err(error) => return Err(format!("{}: {error}", existing.display())),
        }
    }

    let mut resolved = std::fs::canonicalize(&existing)
        .map_err(|error| format!("{}: {error}", existing.display()))?;
    for part in missing.iter().rev() {
        resolved.push(part);
    }
    Ok(resolved)
}

pub(crate) fn path_to_js(path: &Path) -> String {
    let text = path.to_string_lossy();
    if cfg!(windows) {
        text.replace('\\', "/")
    } else {
        text.into_owned()
    }
}

#[cfg(all(test, unix))]
#[test]
fn preserves_unix_backslash_filenames() {
    assert_eq!(path_to_js(Path::new(r"/tmp/a\b.txt")), r"/tmp/a\b.txt");
    assert_eq!(expand_home(r"~\literal"), PathBuf::from(r"~\literal"));
}

#[test]
fn canonicalize_missing_accepts_relative_paths() {
    let resolved = canonicalize_with_missing(Path::new("relative/missing/file.txt")).unwrap();
    assert!(resolved.is_absolute());
    assert!(resolved.ends_with("relative/missing/file.txt"));
}
