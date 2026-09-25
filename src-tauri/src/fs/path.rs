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
        let Ok(metadata) = std::fs::symlink_metadata(&current) else {
            // Missing components (e.g. new file name) carry no symlink risk.
            // Other I/O errors surface on the actual operation.
            match std::fs::symlink_metadata(&current) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("{}: {error}", current.display())),
                Ok(_) => {}
            }
            continue;
        };
        if !metadata.file_type().is_symlink() {
            continue;
        }
        // Allow symlinks whose target stays inside the immediate parent
        // (system ancestors like /var -> /private/var, /home -> var/home,
        // and an explicitly chosen aliased base pointing at a sibling dir).
        // Reject symlinks escaping outside (project escape -> outside).
        if symlink_target_stays_under_parent(&current) {
            continue;
        }
        return Err("Path contains a symlink".into());
    }
    Ok(())
}

fn symlink_target_stays_under_parent(link: &Path) -> bool {
    let Some(parent) = link.parent() else {
        return false;
    };
    let Ok(target) = std::fs::read_link(link) else {
        return false;
    };
    let abs_target = if target.is_absolute() {
        target
    } else {
        parent.join(target)
    };
    // Canonicalize parent (resolves system ancestors) and target when possible.
    // Fall back to lexical normalization for dangling/missing targets.
    let canon_parent = std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
    if let Ok(canon_target) = std::fs::canonicalize(&abs_target) {
        return canon_target.starts_with(&canon_parent);
    }
    let normalized = normalize_lexically(&abs_target);
    normalized.starts_with(&canon_parent)
}

fn normalize_lexically(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                out.pop();
            }
            std::path::Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
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
