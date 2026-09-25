//! Filesystem operations, split by domain.
//!
//! Tauri command entry points live in these modules; `lib.rs` registers them
//! as `fs::<module>::<command>` (the `__cmd__` glue is generated where each
//! function is defined). Only items referenced elsewhere in the crate via
//! `crate::fs::<item>` are re-exported here; everything else is reached
//! through its own module.

pub(crate) mod constants;
pub(crate) mod git;
pub(crate) mod github;
pub(crate) mod omp;
pub(crate) mod path;
pub(crate) mod read;
pub(crate) mod secure;
pub(crate) mod write;

#[cfg(test)]
mod tests;

pub use git::{GitChangedFile, GitDiffIndex};

pub(crate) use constants::{MAX_PREVIEW_BYTES, MAX_TEXT_FILE_BYTES};
pub(crate) use git::{git_checked, git_diff_files_for, git_info_for, resolve_repo_path};
pub(crate) use path::{expand_home, path_to_js};
pub(crate) use read::list_project_files_sync;
