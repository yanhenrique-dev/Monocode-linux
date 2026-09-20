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
