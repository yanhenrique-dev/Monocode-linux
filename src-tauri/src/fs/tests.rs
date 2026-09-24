use super::git::*;
use super::github::*;
use super::omp::*;
use super::path::*;
use super::read::*;
use super::write::*;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::dirs_home;
use std::sync::atomic::{AtomicU64, Ordering};

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

fn assistant_text(text: &str, concat: &str) -> OmpAssistantText {
    OmpAssistantText {
        text: text.into(),
        concat: concat.into(),
    }
}

#[test]
fn omp_active_assistant_texts_keep_active_message_order_with_both_forms() {
    let dir = tmp("omp-active-texts");
    let path = dir.0.join("session.jsonl");
    let records = [
        serde_json::json!({"type":"message","id":"u","message":{"role":"user","content":"User only"}}),
        serde_json::json!({"type":"message","id":"abandoned","parentId":"u","message":{"role":"assistant","content":"Off branch"}}),
        serde_json::json!({"type":"message","id":"a","parentId":"u","message":{"role":"assistant","content":[{"type":"text","text":"First."},{"type":"thinking","thinking":"Hidden"},{"type":"text","text":"Second."}]}}),
        serde_json::json!({"type":"message","id":"tool","parentId":"a","message":{"role":"assistant","content":[{"type":"toolCall","name":"read"}]}}),
        serde_json::json!({"type":"message","id":"b","parentId":"tool","message":{"role":"assistant","content":"Plain"}}),
        serde_json::json!({"type":"custom_message","id":"note","parentId":"b","content":"Note only"}),
    ];
    let jsonl = records.iter().map(|v| format!("{v}\n")).collect::<String>();
    std::fs::write(&path, jsonl).unwrap();
    assert_eq!(
        active_omp_assistant_texts(&path).unwrap(),
        [
            assistant_text("First.\nSecond.", "First.Second."),
            assistant_text("Plain", "Plain"),
        ]
    );
}

#[test]
fn omp_active_assistant_texts_repeat_equal_messages_in_file_order() {
    let dir = tmp("omp-active-texts-repeats");
    let path = dir.0.join("session.jsonl");
    let records = [
        serde_json::json!({"type":"message","id":"a","message":{"role":"assistant","content":"First."}}),
        serde_json::json!({"type":"message","id":"off","parentId":"a","message":{"role":"assistant","content":"First.Second."}}),
        serde_json::json!({"type":"message","id":"b","parentId":"a","message":{"role":"assistant","content":[{"type":"text","text":"Second."}]}}),
        serde_json::json!({"type":"message","id":"c","parentId":"b","message":{"role":"assistant","content":"First.Second."}}),
        serde_json::json!({"type":"message","id":"d","parentId":"c","message":{"role":"assistant","content":"First.Second."}}),
    ];
    std::fs::write(
        &path,
        records.iter().map(|v| format!("{v}\n")).collect::<String>(),
    )
    .unwrap();
    assert_eq!(
        active_omp_assistant_texts(&path).unwrap(),
        [
            assistant_text("First.", "First."),
            assistant_text("Second.", "Second."),
            assistant_text("First.Second.", "First.Second."),
            assistant_text("First.Second.", "First.Second."),
        ]
    );
}

#[test]
fn omp_interjections_require_displayed_assistant_anchors() {
    let dir = tmp("omp-interjections");
    let path = dir.0.join("session.jsonl");
    std::fs::write(
            &path,
            concat!(
                "{\"type\":\"message\",\"id\":\"u\",\"message\":{\"role\":\"user\",\"content\":\"Go\"}}\n",
                "{\"type\":\"custom_message\",\"id\":\"orphan\",\"parentId\":\"u\",\"display\":true}\n",
                "{\"type\":\"message\",\"id\":\"a1\",\"parentId\":\"orphan\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Answer\"}]}}\n",
                "{\"type\":\"custom_message\",\"id\":\"hidden\",\"parentId\":\"a1\",\"display\":false}\n",
                "invalid partial line\n",
                "{\"type\":\"message\",\"id\":\"a2\",\"parentId\":\"hidden\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Answer\"}]}}\n",
                "{\"type\":\"custom_message\",\"id\":\"review\",\"parentId\":\"a2\",\"display\":true,\"customType\":\"advisor\",\"details\":{\"notes\":[{\"note\":\"First\",\"severity\":\"nit\"},{\"note\":\"Second\",\"severity\":\"blocker\"}]}}\n",
                "{\"type\":\"message\",\"id\":\"a3\",\"parentId\":\"review\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Checked\"}]}}\n",
            ),
        )
        .unwrap();
    let anchors = parse_omp_interjections(&path).unwrap();
    assert_eq!(anchors.len(), 1);
    assert_eq!(anchors[0].after_assistant_text, "Answer");
    assert_eq!(anchors[0].after_occurrence, 2);
    assert_eq!(
        anchors[0].following_assistant_text.as_deref(),
        Some("Checked")
    );
    assert_eq!(anchors[0].text, "First\n\nSecond");
    assert_eq!(anchors[0].severity.as_deref(), Some("blocker"));
}

#[test]
fn omp_interjections_do_not_coalesce_across_reasoning() {
    let dir = tmp("omp-interjections-reasoning");
    let path = dir.0.join("session.jsonl");
    std::fs::write(
            &path,
            concat!(
                "{\"type\":\"message\",\"id\":\"a\",\"message\":{\"role\":\"assistant\",\"content\":\"Answer\"}}\n",
                "{\"type\":\"custom_message\",\"id\":\"review\",\"parentId\":\"a\",\"display\":true,\"content\":\"Check\"}\n",
                "{\"type\":\"message\",\"id\":\"b\",\"parentId\":\"review\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"thinking\",\"thinking\":\"Wait\"},{\"type\":\"text\",\"text\":\"Checked\"}]}}\n",
            ),
        )
        .unwrap();
    let anchors = parse_omp_interjections(&path).unwrap();
    assert_eq!(anchors[0].following_assistant_text, None);
    assert_eq!(anchors[0].text, "Check");
}
#[test]
fn omp_interjections_follow_active_ancestry_and_keep_text_forms() {
    let dir = tmp("omp-interjections-ancestry");
    let path = dir.0.join("session.jsonl");
    std::fs::write(
            &path,
            concat!(
                "{\"type\":\"message\",\"id\":\"a\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"One\"},{\"type\":\"text\",\"text\":\"Two\"}]}}\n",
                "{\"type\":\"custom_message\",\"id\":\"abandoned\",\"parentId\":\"a\",\"display\":true,\"content\":\"Wrong branch\"}\n",
                "{\"type\":\"message\",\"id\":\"t\",\"parentId\":\"a\",\"message\":{\"role\":\"toolResult\",\"content\":\"Done\"}}\n",
                "{\"type\":\"custom_message\",\"id\":\"first\",\"parentId\":\"t\",\"display\":true,\"content\":\"First\"}\n",
                "{\"type\":\"custom_message\",\"id\":\"second\",\"parentId\":\"first\",\"display\":true,\"content\":\"Second\"}\n",
                "{\"type\":\"compaction\",\"id\":\"meta\",\"parentId\":\"second\"}\n",
                "{\"type\":\"custom_message\",\"id\":\"third\",\"parentId\":\"meta\",\"display\":true,\"content\":\"Third\"}\n",
                "{\"type\":\"message\",\"id\":\"b\",\"parentId\":\"third\",\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Three\"},{\"type\":\"text\",\"text\":\"Four\"}]}}\n",
            ),
        )
        .unwrap();
    let anchors = parse_omp_interjections(&path).unwrap();
    assert_eq!(
        anchors.iter().map(|a| a.id.as_str()).collect::<Vec<_>>(),
        ["first", "second", "third"]
    );
    for anchor in &anchors {
        assert_eq!(anchor.after_assistant_text, "One\nTwo");
        assert_eq!(anchor.after_assistant_text_concat, "OneTwo");
        assert_eq!(anchor.after_occurrence, 1);
        assert_eq!(anchor.after_concat_occurrence, 1);
    }
    assert_eq!(anchors[0].following_assistant_text, None);
    assert_eq!(anchors[1].following_assistant_text, None);
    assert_eq!(
        anchors[2].following_assistant_text.as_deref(),
        Some("Three\nFour")
    );
    assert_eq!(
        anchors[2].following_assistant_text_concat.as_deref(),
        Some("ThreeFour")
    );
}

#[test]
fn omp_interjections_do_not_cross_users_or_empty_assistant_messages() {
    let dir = tmp("omp-interjections-barriers");
    let path = dir.0.join("session.jsonl");
    for role in ["user", "assistant"] {
        let records = [
            serde_json::json!({"type":"message","id":"a","message":{"role":"assistant","content":"Earlier"}}),
            serde_json::json!({"type":"message","id":"barrier","parentId":"a","message":{"role":role,"content":[]}}),
            serde_json::json!({"type":"message","id":"tool","parentId":"barrier","message":{"role":"toolResult","content":"Done"}}),
            serde_json::json!({"type":"custom_message","id":"note","parentId":"tool","display":true,"content":"Note"}),
        ];
        let jsonl = records.map(|record| record.to_string()).join("\n");
        std::fs::write(&path, jsonl).unwrap();
        assert!(parse_omp_interjections(&path).unwrap().is_empty());
    }
}

#[test]
fn stat_files_returns_mtime_for_existing_files_only() {
    let dir = tmp("stat-files");
    let path = dir.0.join("notes.md");
    std::fs::write(&path, "hi\n").unwrap();
    let path_string = path.to_string_lossy().into_owned();
    let missing = dir.0.join("gone.md").to_string_lossy().into_owned();

    let stats = stat_files(vec![path_string.clone(), missing.clone()]).unwrap();
    assert_eq!(stats.len(), 2);
    assert_eq!(stats[0].path, path_string);
    assert!(stats[0].mtime_ms.is_some());
    assert_eq!(stats[1].path, missing);
    assert!(stats[1].mtime_ms.is_none());
}

#[test]
fn editor_text_files_round_trip_without_leaving_a_temporary_file() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("monocode-editor-{}-{stamp}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("example.rs");
    std::fs::write(&path, "fn old() {}\n").unwrap();
    let path_string = path.to_string_lossy().into_owned();

    assert_eq!(read_text_file_sync(&path_string).unwrap(), "fn old() {}\n");
    write_text_file_sync(&path_string, "fn new() {}\n").unwrap();
    assert_eq!(read_text_file_sync(&path_string).unwrap(), "fn new() {}\n");

    let names: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert_eq!(names, vec![std::ffi::OsString::from("example.rs")]);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn binary_reads_return_bytes_and_refuse_directories() {
    let dir = tmp("binary-read");
    let file = dir.0.join("shot.png");
    std::fs::write(&file, [0x89, b'P', b'N', b'G', 0x0d]).unwrap();

    let bytes = read_binary_file_sync(&file.to_string_lossy()).unwrap();
    assert_eq!(bytes, vec![0x89, b'P', b'N', b'G', 0x0d]);
    assert!(read_binary_file_sync(&dir.0.to_string_lossy()).is_err());
}

#[test]
fn inspect_paths_reports_files_and_directories() {
    let dir = tmp("inspect-paths");
    let file = dir.0.join("notes.md");
    std::fs::write(&file, "hello\n").unwrap();
    let infos = inspect_paths(vec![
        file.to_string_lossy().into_owned(),
        dir.0.to_string_lossy().into_owned(),
    ]);
    assert_eq!(infos.len(), 2);
    let notes = infos.iter().find(|info| info.name == "notes.md").unwrap();
    assert!(!notes.is_dir);
    assert_eq!(notes.size, 6);
    let folder = infos.iter().find(|info| info.is_dir).unwrap();
    assert_eq!(folder.path, path_to_js(&dir.0));
}

#[test]
fn preview_truncates_on_char_boundaries() {
    let dir = tmp("preview-truncate");
    // Byte 199 lands inside the 2-byte 'é' (bytes 198..200): truncating by
    // byte index would panic, so the preview must cut on a char boundary.
    let line = format!("{}é{}", "a".repeat(198), "b".repeat(50));
    let file = dir.0.join("notes.txt");
    std::fs::write(&file, format!("{line}\nshort\n")).unwrap();

    let preview = read_file_preview(file.to_string_lossy().into_owned(), 12, None).unwrap();
    assert_eq!(preview.len(), 2);
    assert_eq!(preview[0].chars().count(), 200);
    assert!(preview[0].ends_with('…'));
    assert_eq!(preview[1], "short");

    // Pure-ASCII behavior is unchanged: 199 chars + ellipsis.
    let ascii = "x".repeat(250);
    let file = dir.0.join("ascii.txt");
    std::fs::write(&file, format!("{ascii}\n")).unwrap();
    let preview = read_file_preview(file.to_string_lossy().into_owned(), 12, None).unwrap();
    assert_eq!(preview[0], format!("{}…", "x".repeat(199)));
}

#[test]
fn attachment_bytes_round_trip_through_temp_dir() {
    let encoded =
        read_file_base64_sync(&write_attachment_sync("shot.png", "aGVsbG8=").unwrap()).unwrap();
    assert_eq!(encoded, "aGVsbG8=");
    assert_eq!(safe_attachment_name("../../secret.png"), "secret.png");
    assert_eq!(safe_attachment_name(""), "attachment");
}

struct Tmp(PathBuf);
impl Drop for Tmp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn tmp(label: &str) -> Tmp {
    loop {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "monocode-{label}-{}-{stamp}-{seq}",
            std::process::id()
        ));
        match std::fs::create_dir(&dir) {
            Ok(()) => return Tmp(dir),
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => panic!("{}", error),
        }
    }
}

#[test]
fn split_stem_ext_keeps_dotfiles_whole() {
    assert_eq!(split_stem_ext("foo.ts"), ("foo", ".ts"));
    assert_eq!(split_stem_ext("foo.d.ts"), ("foo.d", ".ts"));
    assert_eq!(split_stem_ext(".gitignore"), (".gitignore", ""));
    assert_eq!(split_stem_ext("Makefile"), ("Makefile", ""));
}

#[test]
fn rename_delete_and_copy_round_trip() {
    let dir = tmp("tree");
    let file = dir.0.join("notes.md");
    std::fs::write(&file, "hi\n").unwrap();
    let file_s = file.to_string_lossy().into_owned();
    let parent = dir.0.to_string_lossy().into_owned();

    let renamed = rename_path_sync(&file_s, "readme.md").unwrap();
    assert!(Path::new(&renamed).ends_with("readme.md"));
    assert!(!file.exists());
    assert_eq!(std::fs::read_to_string(&renamed).unwrap(), "hi\n");

    let copied = copy_path_sync(&renamed, &parent).unwrap();
    assert!(Path::new(&copied).ends_with("readme copy.md"));
    assert_eq!(std::fs::read_to_string(&copied).unwrap(), "hi\n");

    let nested = dir.0.join("docs");
    std::fs::create_dir(&nested).unwrap();
    let moved = move_path_sync(&copied, &nested.to_string_lossy()).unwrap();
    assert!(Path::new(&moved).ends_with("docs/readme copy.md"));
    assert!(!Path::new(&copied).exists());

    delete_path_sync(&renamed).unwrap();
    assert!(!Path::new(&renamed).exists());
    delete_path_sync(&nested.to_string_lossy()).unwrap();
    assert!(!nested.exists());
}

#[test]
fn copy_folder_gets_a_unique_name_and_rejects_paste_into_self() {
    let dir = tmp("folder");
    let src = dir.0.join("src");
    std::fs::create_dir(&src).unwrap();
    std::fs::write(src.join("a.rs"), "fn a() {}\n").unwrap();
    let parent = dir.0.to_string_lossy().into_owned();
    let src_s = src.to_string_lossy().into_owned();

    let copied = copy_path_sync(&src_s, &parent).unwrap();
    assert!(Path::new(&copied).ends_with("src copy"));
    assert!(Path::new(&copied).join("a.rs").exists());

    let err = copy_path_sync(&src_s, &src_s).unwrap_err();
    assert!(err.contains("itself"));
}

#[cfg(unix)]
#[test]
fn copy_rejects_paste_into_self_through_a_symlink_alias() {
    let dir = tmp("folder-alias");
    let src = dir.0.join("src");
    std::fs::create_dir(&src).unwrap();
    std::fs::write(src.join("a.rs"), "fn a() {}\n").unwrap();
    let alias = dir.0.join("alias");
    std::os::unix::fs::symlink(&src, &alias).unwrap();
    let src_s = src.to_string_lossy().into_owned();
    let alias_s = alias.to_string_lossy().into_owned();

    let err = copy_path_sync(&src_s, &alias_s).unwrap_err();
    assert!(err.contains("itself"));
    let err = move_path_sync(&src_s, &alias_s).unwrap_err();
    assert!(err.contains("itself"));
}

#[cfg(unix)]
#[test]
fn create_path_rejects_a_symlinked_parent() {
    let dir = tmp("create-symlink-parent");
    let outside = tmp("create-symlink-outside");
    std::os::unix::fs::symlink(&outside.0, dir.0.join("escape")).unwrap();

    let err = create_path(
        dir.0.to_string_lossy().into_owned(),
        "escape/new.txt".into(),
        false,
    )
    .unwrap_err();
    assert!(err.contains("symlink") || err.contains("path"));
    assert!(!outside.0.join("new.txt").exists());
}

#[cfg(unix)]
#[test]
fn write_text_file_rejects_a_symlinked_parent() {
    let dir = tmp("write-symlink-parent");
    let outside = tmp("write-symlink-outside");
    std::os::unix::fs::symlink(&outside.0, dir.0.join("escape")).unwrap();

    let path = dir.0.join("escape/new.txt");
    let err = write_text_file_sync(&path.to_string_lossy(), "secret\n").unwrap_err();
    assert!(err.contains("symlink") || err.contains("path"));
    assert!(!outside.0.join("new.txt").exists());
}

#[cfg(unix)]
#[test]
fn copy_and_move_reject_a_symlinked_destination_parent() {
    let dir = tmp("copy-move-symlink-parent");
    let outside = tmp("copy-move-symlink-outside");
    let source = dir.0.join("source.txt");
    std::fs::write(&source, "content\n").unwrap();
    let alias = dir.0.join("escape");
    std::os::unix::fs::symlink(&outside.0, &alias).unwrap();

    let copy_err = copy_path_sync(&source.to_string_lossy(), &alias.to_string_lossy()).unwrap_err();
    assert!(copy_err.contains("symlink") || copy_err.contains("path"));

    let move_err = move_path_sync(&source.to_string_lossy(), &alias.to_string_lossy()).unwrap_err();
    assert!(move_err.contains("symlink") || move_err.contains("path"));
    assert!(!outside.0.join("source.txt").exists());
}

#[cfg(unix)]
#[test]
fn rename_and_delete_reject_a_symlinked_parent() {
    let dir = tmp("rename-delete-symlink-parent");
    let outside = tmp("rename-delete-symlink-outside");
    let source = dir.0.join("source.txt");
    std::fs::write(&source, "content\n").unwrap();
    let outside_file = outside.0.join("outside.txt");
    std::fs::write(&outside_file, "keep\n").unwrap();
    let alias = dir.0.join("escape");
    std::os::unix::fs::symlink(&outside.0, &alias).unwrap();

    let rename_err = rename_path_sync(&source.to_string_lossy(), "escape/renamed.txt").unwrap_err();
    assert!(rename_err.contains("symlink") || rename_err.contains("path"));

    let delete_err = delete_path_sync(&alias.join("outside.txt").to_string_lossy()).unwrap_err();
    assert!(delete_err.contains("symlink") || delete_err.contains("path"));
    assert!(outside_file.exists());
}

#[cfg(unix)]
#[test]
fn git_file_diff_rejects_a_symlink_to_outside_the_repo() {
    let repo = tmp("git-symlink-read");
    let outside = tmp("git-symlink-outside");
    if !init_git(&repo.0, "main", None) {
        return;
    }
    let outside_file = outside.0.join("secret.txt");
    std::fs::write(&outside_file, "secret\n").unwrap();
    std::os::unix::fs::symlink(&outside_file, repo.0.join("secret-link.txt")).unwrap();

    let err = git_file_diff_for(&repo.0, "secret-link.txt", false).unwrap_err();
    assert!(err.contains("outside") || err.contains("path") || err.contains("symlink"));
}

fn relative_paths(files: &[ProjectFile]) -> Vec<&str> {
    files.iter().map(|f| f.relative.as_str()).collect()
}

#[test]
fn walk_skips_vendor_dirs_and_gitignore_names() {
    let dir = tmp("index-walk");
    std::fs::write(dir.0.join("app.ts"), "x\n").unwrap();
    std::fs::create_dir_all(dir.0.join("src")).unwrap();
    std::fs::write(dir.0.join("src").join("main.ts"), "x\n").unwrap();
    std::fs::create_dir_all(dir.0.join("node_modules").join("pkg")).unwrap();
    std::fs::write(
        dir.0.join("node_modules").join("pkg").join("index.js"),
        "x\n",
    )
    .unwrap();
    std::fs::write(dir.0.join(".gitignore"), "secret.txt\n").unwrap();
    std::fs::write(dir.0.join("secret.txt"), "nope\n").unwrap();

    let files = walk_project_files(&dir.0);
    let paths = relative_paths(&files);
    assert!(paths.contains(&"app.ts"));
    assert!(paths.contains(&"src/main.ts"));
    assert!(paths.contains(&".gitignore"));
    assert!(!paths.iter().any(|r| r.contains("node_modules")));
    assert!(!paths.contains(&"secret.txt"));
}

#[test]
fn walk_skips_app_bundles() {
    let dir = tmp("index-bundle");
    std::fs::write(dir.0.join("app.ts"), "x\n").unwrap();
    let bundle = dir.0.join("Some.app").join("Contents");
    std::fs::create_dir_all(&bundle).unwrap();
    std::fs::write(bundle.join("Info.plist"), "x\n").unwrap();

    let files = walk_project_files(&dir.0);
    let paths = relative_paths(&files);
    assert!(paths.contains(&"app.ts"));
    assert!(!paths.iter().any(|r| r.contains("Some.app")));
}

#[test]
fn home_root_is_not_indexed() {
    let Some(home) = dirs_home() else { return };
    let files = list_project_files_sync(&home).unwrap();
    assert!(files.is_empty());
    assert!(list_project_files_sync("~").unwrap().is_empty());
    assert!(!is_indexable_root(Path::new("/")));
}

#[test]
fn project_dirs_stay_indexable() {
    let dir = tmp("index-root");
    assert!(is_indexable_root(&dir.0));
}

#[test]
fn git_ls_files_includes_untracked_and_drops_ignored() {
    let dir = tmp("index-git");
    std::fs::write(dir.0.join("tracked.ts"), "x\n").unwrap();
    std::fs::write(dir.0.join("loose.ts"), "x\n").unwrap();
    std::fs::write(dir.0.join(".gitignore"), "ignored.ts\nnode_modules\n").unwrap();
    std::fs::write(dir.0.join("ignored.ts"), "x\n").unwrap();
    std::fs::create_dir_all(dir.0.join("node_modules")).unwrap();
    std::fs::write(dir.0.join("node_modules").join("pkg.js"), "x\n").unwrap();

    let init = Command::new("git")
        .args(["init"])
        .current_dir(&dir.0)
        .output();
    let Ok(init) = init else { return };
    if !init.status.success() {
        return;
    }
    let add = Command::new("git")
        .args(["add", "tracked.ts", ".gitignore"])
        .current_dir(&dir.0)
        .status();
    if add.map(|s| !s.success()).unwrap_or(true) {
        return;
    }

    let files = list_project_files_sync(&dir.0.to_string_lossy()).unwrap();
    let paths = relative_paths(&files);
    assert!(paths.contains(&"tracked.ts"));
    assert!(paths.contains(&"loose.ts"));
    assert!(!paths.contains(&"ignored.ts"));
    assert!(!paths.iter().any(|r| r.contains("node_modules")));
}

fn init_git(dir: &Path, branch: &str, origin: Option<&str>) -> bool {
    let init = Command::new("git").args(["init"]).current_dir(dir).output();
    let Ok(init) = init else { return false };
    if !init.status.success() {
        return false;
    }
    let head = Command::new("git")
        .args(["symbolic-ref", "HEAD", &format!("refs/heads/{branch}")])
        .current_dir(dir)
        .status();
    if head.map(|status| !status.success()).unwrap_or(true) {
        return false;
    }
    if let Some(url) = origin {
        let remote = Command::new("git")
            .args(["remote", "add", "origin", url])
            .current_dir(dir)
            .status();
        if remote.map(|status| !status.success()).unwrap_or(true) {
            return false;
        }
    }
    git(dir, &["config", "user.name", "MonoCode"])
        && git(dir, &["config", "user.email", "monocode@test"])
        && git(dir, &["config", "commit.gpgsign", "false"])
        && git(dir, &["config", "core.autocrlf", "false"])
}

#[test]
fn git_info_reads_branch_and_origin_repo() {
    let dir = tmp("git-info");
    if !init_git(
        &dir.0,
        "fix-sidebar",
        Some("https://github.com/acme/widget.git"),
    ) {
        return;
    }
    let info = git_info_for(&dir.0);
    assert_eq!(info.branch.as_deref(), Some("fix-sidebar"));
    assert_eq!(info.repo.as_deref(), Some("widget"));
}

#[test]
fn git_info_falls_back_to_folder_name_without_origin() {
    let dir = tmp("git-info-local");
    if !init_git(&dir.0, "main", None) {
        return;
    }
    let info = git_info_for(&dir.0);
    assert_eq!(info.branch.as_deref(), Some("main"));
    assert_eq!(
        info.repo.as_deref(),
        dir.0.file_name().and_then(|name| name.to_str())
    );
}

fn git(dir: &Path, args: &[&str]) -> bool {
    Command::new("git")
        .args([
            "-c",
            "user.name=MonoCode",
            "-c",
            "user.email=monocode@test",
            "-c",
            "commit.gpgsign=false",
        ])
        .args(args)
        .current_dir(dir)
        .env("GIT_AUTHOR_NAME", "MonoCode")
        .env("GIT_AUTHOR_EMAIL", "monocode@test")
        .env("GIT_COMMITTER_NAME", "MonoCode")
        .env("GIT_COMMITTER_EMAIL", "monocode@test")
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn init_git_commit(dir: &Path, files: &[(&str, &str)]) -> bool {
    if !init_git(dir, "main", None) {
        return false;
    }
    for (name, contents) in files {
        if std::fs::write(dir.join(name), contents).is_err() {
            return false;
        }
    }
    git(dir, &["add", "."]) && git(dir, &["commit", "-m", "init"])
}

#[test]
fn git_diff_stats_are_zero_outside_a_repo() {
    let dir = tmp("git-diff-none");
    std::fs::write(dir.0.join("notes.txt"), "hello\n").unwrap();
    assert_eq!(
        git_diff_stats_for(&dir.0),
        GitDiffStats {
            files: 0,
            additions: 0,
            deletions: 0
        }
    );
}

#[test]
fn git_diff_stats_count_unstaged_and_untracked() {
    let dir = tmp("git-diff-dirty");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\nbeta\ngamma\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "alpha\ngamma\ndelta\n").unwrap();
    std::fs::write(dir.0.join("new.txt"), "hello\nworld\n").unwrap();
    std::fs::write(dir.0.join("ignored.txt"), "nope\n").unwrap();
    std::fs::write(dir.0.join(".gitignore"), "ignored.txt\n").unwrap();

    let stats = git_diff_stats_for(&dir.0);
    // a.txt: -beta +delta; new.txt: +2; .gitignore: +1 untracked
    assert_eq!(stats.files, 3);
    assert_eq!(stats.additions, 4);
    assert_eq!(stats.deletions, 1);
}

#[test]
fn git_diff_stats_are_zero_when_clean() {
    let dir = tmp("git-diff-clean");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    assert_eq!(
        git_diff_stats_for(&dir.0),
        GitDiffStats {
            files: 0,
            additions: 0,
            deletions: 0
        }
    );
}

#[test]
fn git_diff_index_lists_modified_and_untracked() {
    let dir = tmp("git-diff-index");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\nbeta\ngamma\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "alpha\ngamma\ndelta\n").unwrap();
    std::fs::write(dir.0.join("new.txt"), "hello\nworld\n").unwrap();

    let index = git_diff_index_for(&dir.0);
    assert_eq!(index.branch.as_deref(), Some("main"));
    assert_eq!(index.files.len(), 2);

    let modified = index
        .files
        .iter()
        .find(|file| file.relative == "a.txt")
        .unwrap();
    assert_eq!(modified.status, "modified");
    assert_eq!(modified.additions, 1);
    assert_eq!(modified.deletions, 1);

    let untracked = index
        .files
        .iter()
        .find(|file| file.relative == "new.txt")
        .unwrap();
    assert_eq!(untracked.status, "untracked");
    assert_eq!(untracked.additions, 2);
    assert_eq!(untracked.deletions, 0);
}

#[test]
fn git_file_diff_returns_both_sides() {
    let dir = tmp("git-file-diff");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\nbeta\ngamma\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "alpha\ngamma\ndelta\n").unwrap();

    let diff = git_file_diff_for(&dir.0, "a.txt", false).unwrap();
    assert_eq!(diff.status, "modified");
    assert_eq!(diff.original, "alpha\nbeta\ngamma\n");
    assert_eq!(diff.current, "alpha\ngamma\ndelta\n");
    assert!(!diff.binary);
    assert!(!diff.too_large);
}

#[test]
fn git_file_diff_staged_reads_head_and_index() {
    let dir = tmp("git-file-diff-staged");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();

    let diff = git_file_diff_for(&dir.0, "a.txt", true).unwrap();
    assert_eq!(diff.status, "modified");
    assert_eq!(diff.original, "alpha\n");
    assert_eq!(diff.current, "beta\n");
}

#[test]
fn git_file_diff_staged_handles_additions_and_deletions() {
    let dir = tmp("git-file-diff-staged-status");
    if !init_git_commit(&dir.0, &[("gone.txt", "old\n")]) {
        return;
    }
    std::fs::write(dir.0.join("new.txt"), "new\n").unwrap();
    std::fs::remove_file(dir.0.join("gone.txt")).unwrap();
    assert!(git(&dir.0, &["add", "-A"]));

    let added = git_file_diff_for(&dir.0, "new.txt", true).unwrap();
    assert_eq!(added.status, "added");
    assert_eq!(added.original, "");
    assert_eq!(added.current, "new\n");

    let deleted = git_file_diff_for(&dir.0, "gone.txt", true).unwrap();
    assert_eq!(deleted.status, "deleted");
    assert_eq!(deleted.original, "old\n");
    assert_eq!(deleted.current, "");
}

#[test]
fn git_file_diff_separates_staged_and_unstaged_changes() {
    let dir = tmp("git-file-diff-partial");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\nbeta\ngamma\ndelta\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "alpha\nBETA\ngamma\nDELTA\n").unwrap();
    git_stage_contents_for(&dir.0, "a.txt", b"alpha\nBETA\ngamma\ndelta\n").unwrap();

    let staged = git_file_diff_for(&dir.0, "a.txt", true).unwrap();
    assert_eq!(staged.original, "alpha\nbeta\ngamma\ndelta\n");
    assert_eq!(staged.current, "alpha\nBETA\ngamma\ndelta\n");

    let unstaged = git_file_diff_for(&dir.0, "a.txt", false).unwrap();
    assert_eq!(unstaged.original, "alpha\nBETA\ngamma\ndelta\n");
    assert_eq!(unstaged.current, "alpha\nBETA\ngamma\nDELTA\n");
}

#[test]
fn git_file_diff_untracked_has_empty_original() {
    let dir = tmp("git-file-diff-new");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("new.txt"), "hello\n").unwrap();

    let diff = git_file_diff_for(&dir.0, "new.txt", false).unwrap();
    assert_eq!(diff.status, "untracked");
    assert_eq!(diff.original, "");
    assert_eq!(diff.current, "hello\n");
}

#[test]
fn git_file_diff_deleted_has_empty_current() {
    let dir = tmp("git-file-diff-del");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::remove_file(dir.0.join("a.txt")).unwrap();

    let diff = git_file_diff_for(&dir.0, "a.txt", false).unwrap();
    assert_eq!(diff.status, "deleted");
    assert_eq!(diff.original, "alpha\n");
    assert_eq!(diff.current, "");
}

#[test]
fn git_file_diff_rejects_path_escape() {
    let dir = tmp("git-file-diff-escape");
    assert!(git_file_diff_for(&dir.0, "../secret.txt", false).is_err());
}

#[test]
fn git_file_diff_rejects_outside_a_repo() {
    let dir = tmp("git-file-diff-none");
    std::fs::write(dir.0.join("notes.txt"), "hello\n").unwrap();
    assert!(git_file_diff_for(&dir.0, "notes.txt", false).is_err());
}

#[test]
fn parse_git_decorations_classifies_head_local_remote_and_tags() {
    let remotes = vec!["origin".to_string()];
    let (head, refs) = parse_git_decorations(
        "HEAD -> main, origin/main, origin/HEAD, tag: v0.1.30, fix/foo",
        Some("abc"),
        "abc",
        &remotes,
    );
    assert!(head);
    assert_eq!(
        refs,
        vec![
            GitHistoryRef {
                name: "main".into(),
                kind: "local".into()
            },
            GitHistoryRef {
                name: "origin/main".into(),
                kind: "remote".into()
            },
            GitHistoryRef {
                name: "v0.1.30".into(),
                kind: "tag".into()
            },
            GitHistoryRef {
                name: "fix/foo".into(),
                kind: "local".into()
            },
        ]
    );
}

#[test]
fn git_history_lists_commits_parents_and_head() {
    let dir = tmp("git-history");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "second"]));

    let history = git_history_for(&dir.0, Some(10)).unwrap();
    assert_eq!(history.commits.len(), 2);
    assert_eq!(history.commits[0].subject, "second");
    assert_eq!(history.commits[1].subject, "init");
    assert_eq!(
        history.commits[0].parents,
        vec![history.commits[1].sha.clone()]
    );
    assert!(history.commits[0].head);
    assert!(!history.commits[1].head);
    assert!(history.commits[0]
        .refs
        .iter()
        .any(|r| r.kind == "local" && r.name == "main"));
}

#[test]
fn git_history_empty_outside_a_repo() {
    let dir = tmp("git-history-none");
    assert_eq!(
        git_history_for(&dir.0, None).unwrap(),
        GitHistory::default()
    );
}

#[test]
fn git_commit_diff_reads_parent_and_current() {
    let dir = tmp("git-commit-diff");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "update a"]));
    let history = git_history_for(&dir.0, Some(1)).unwrap();
    let sha = &history.commits[0].sha;

    let files = git_commit_files_for(&dir.0, sha).unwrap();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].relative, "a.txt");
    assert_eq!(files[0].status, "modified");
    assert_eq!(files[0].path, path_to_js(&dir.0.join("a.txt")));

    let diff = git_commit_file_diff_for(&dir.0, sha, "a.txt").unwrap();
    assert_eq!(diff.original, "alpha\n");
    assert_eq!(diff.current, "beta\n");
    assert_eq!(diff.status, "modified");
    assert_eq!(diff.path, path_to_js(&dir.0.join("a.txt")));
}

#[test]
fn git_commit_diff_root_commit_is_added() {
    let dir = tmp("git-commit-root");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    let history = git_history_for(&dir.0, Some(1)).unwrap();
    let sha = &history.commits[0].sha;
    let files = git_commit_files_for(&dir.0, sha).unwrap();
    assert_eq!(files[0].status, "added");
    let diff = git_commit_file_diff_for(&dir.0, sha, "a.txt").unwrap();
    assert_eq!(diff.original, "");
    assert_eq!(diff.current, "alpha\n");
    assert_eq!(diff.status, "added");
}

#[test]
fn git_commit_diff_rejects_bad_sha_and_path() {
    let dir = tmp("git-commit-bad");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    assert!(git_commit_files_for(&dir.0, "../oops").is_err());
    assert!(git_commit_files_for(&dir.0, "not-hex!").is_err());
    let history = git_history_for(&dir.0, Some(1)).unwrap();
    let sha = &history.commits[0].sha;
    assert!(git_commit_file_diff_for(&dir.0, sha, "../secret.txt").is_err());
}

#[test]
fn git_history_records_merge_parents() {
    let dir = tmp("git-history-merge");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    assert!(git(&dir.0, &["checkout", "-b", "feature"]));
    std::fs::write(dir.0.join("feat.txt"), "one\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "feature work"]));
    assert!(git(&dir.0, &["checkout", "main"]));
    std::fs::write(dir.0.join("main.txt"), "two\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "main work"]));
    assert!(git(
        &dir.0,
        &["merge", "feature", "--no-ff", "-m", "Merge feature"]
    ));

    let history = git_history_for(&dir.0, Some(20)).unwrap();
    let merge = history
        .commits
        .iter()
        .find(|commit| commit.subject == "Merge feature")
        .unwrap();
    assert_eq!(merge.parents.len(), 2);
}

#[test]
fn git_history_skips_stash_and_unmerged_branches() {
    let dir = tmp("git-history-auto");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    assert!(git(&dir.0, &["checkout", "-b", "feature"]));
    std::fs::write(dir.0.join("feat.txt"), "one\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "feature only"]));
    std::fs::write(dir.0.join("wip.txt"), "stash me\n").unwrap();
    assert!(git(&dir.0, &["stash", "push", "-u", "-m", "wip stash"]));
    assert!(git(&dir.0, &["checkout", "main"]));
    std::fs::write(dir.0.join("main.txt"), "two\n").unwrap();
    assert!(git(&dir.0, &["add", "."]));
    assert!(git(&dir.0, &["commit", "-m", "main only"]));

    let history = git_history_for(&dir.0, Some(20)).unwrap();
    let subjects: Vec<&str> = history
        .commits
        .iter()
        .map(|commit| commit.subject.as_str())
        .collect();
    assert!(subjects.contains(&"main only"));
    assert!(subjects.contains(&"init"));
    assert!(!subjects.iter().any(|s| s.contains("feature only")));
    assert!(!subjects
        .iter()
        .any(|s| s.contains("wip stash") || s.contains("WIP on")));
    assert!(!history
        .commits
        .iter()
        .any(|commit| commit.refs.iter().any(|r| r.name.contains("stash"))));
}

#[test]
fn git_stage_and_unstage_file() {
    let dir = tmp("git-stage");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    let staged = git_diff_index_for(&dir.0)
        .files
        .into_iter()
        .find(|file| file.relative == "a.txt")
        .unwrap();
    assert!(staged.staged);
    assert!(!staged.unstaged);

    git_unstage_file_for(&dir.0, "a.txt").unwrap();
    let unstaged = git_diff_index_for(&dir.0)
        .files
        .into_iter()
        .find(|file| file.relative == "a.txt")
        .unwrap();
    assert!(!unstaged.staged);
    assert!(unstaged.unstaged);
}

#[test]
fn git_stage_contents_stages_partial_hunk() {
    let dir = tmp("git-stage-contents");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\nbeta\ngamma\ndelta\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "alpha\nBETA\ngamma\nDELTA\n").unwrap();
    git_stage_contents_for(&dir.0, "a.txt", b"alpha\nBETA\ngamma\ndelta\n").unwrap();

    let file = git_diff_index_for(&dir.0)
        .files
        .into_iter()
        .find(|file| file.relative == "a.txt")
        .unwrap();
    assert!(file.staged);
    assert!(file.unstaged);

    let diff = git_file_diff_for(&dir.0, "a.txt", false).unwrap();
    assert_eq!(diff.original, "alpha\nBETA\ngamma\ndelta\n");
    assert_eq!(diff.current, "alpha\nBETA\ngamma\nDELTA\n");
}

#[test]
fn git_discard_restores_tracked_and_deletes_untracked() {
    let dir = tmp("git-discard");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    std::fs::write(dir.0.join("new.txt"), "hello\n").unwrap();

    git_discard_file_for(&dir.0, "a.txt").unwrap();
    git_discard_file_for(&dir.0, "new.txt").unwrap();

    assert_eq!(
        std::fs::read_to_string(dir.0.join("a.txt")).unwrap(),
        "alpha\n"
    );
    assert!(!dir.0.join("new.txt").exists());
    assert!(git_diff_index_for(&dir.0).files.is_empty());
}

#[test]
fn git_discard_all_restores_unstaged_and_keeps_staged() {
    let dir = tmp("git-discard-all");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n"), ("b.txt", "one\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    std::fs::write(dir.0.join("b.txt"), "two\n").unwrap();
    git_stage_file_for(&dir.0, "b.txt").unwrap();
    std::fs::write(dir.0.join("b.txt"), "three\n").unwrap();
    std::fs::write(dir.0.join("new.txt"), "hello\n").unwrap();

    git_discard_all_for(&dir.0).unwrap();

    assert_eq!(
        std::fs::read_to_string(dir.0.join("a.txt")).unwrap(),
        "alpha\n"
    );
    assert_eq!(
        std::fs::read_to_string(dir.0.join("b.txt")).unwrap(),
        "two\n"
    );
    assert!(!dir.0.join("new.txt").exists());
    let file = git_diff_index_for(&dir.0)
        .files
        .into_iter()
        .find(|file| file.relative == "b.txt")
        .unwrap();
    assert!(file.staged);
    assert!(!file.unstaged);
    assert!(git_diff_index_for(&dir.0)
        .files
        .iter()
        .all(|file| !file.unstaged));
}

#[test]
fn git_discard_keeps_staged_hunks() {
    let dir = tmp("git-discard-staged");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    std::fs::write(dir.0.join("a.txt"), "gamma\n").unwrap();
    git_discard_file_for(&dir.0, "a.txt").unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.0.join("a.txt")).unwrap(),
        "beta\n"
    );
    let file = git_diff_index_for(&dir.0)
        .files
        .into_iter()
        .find(|file| file.relative == "a.txt")
        .unwrap();
    assert!(file.staged);
    assert!(!file.unstaged);
}

#[test]
fn git_commit_clears_staged_files() {
    let dir = tmp("git-commit");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    git_commit_for(&dir.0, "update a").unwrap();
    let index = git_diff_index_for(&dir.0);
    assert!(index.files.is_empty());
    assert_eq!(index.head, git_stdout(&dir.0, &["rev-parse", "HEAD"]));
    assert_eq!(
        git_stdout(&dir.0, &["log", "-1", "--pretty=%s"]).as_deref(),
        Some("update a")
    );
}

#[test]
fn git_commit_rejects_empty_message() {
    let dir = tmp("git-commit-empty");
    assert!(git_commit_for(&dir.0, "   ").is_err());
}

#[test]
fn git_commit_amend_rewrites_head_with_staged_changes() {
    let dir = tmp("git-commit-amend");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    git_commit_amend_for(&dir.0, "amended").unwrap();
    assert!(git_diff_index_for(&dir.0).files.is_empty());
    assert_eq!(
        git_stdout(&dir.0, &["rev-list", "--count", "HEAD"]).as_deref(),
        Some("1")
    );
    assert_eq!(
        git_stdout(&dir.0, &["log", "-1", "--pretty=%s"]).as_deref(),
        Some("amended")
    );
    assert_eq!(
        git_stdout(&dir.0, &["show", "HEAD:a.txt"]).as_deref(),
        Some("beta")
    );
}

#[test]
fn git_commit_amend_rewords_without_staged_changes() {
    let dir = tmp("git-commit-reword");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    git_commit_amend_for(&dir.0, "reworded").unwrap();
    assert_eq!(
        git_stdout(&dir.0, &["rev-list", "--count", "HEAD"]).as_deref(),
        Some("1")
    );
    assert_eq!(
        git_stdout(&dir.0, &["log", "-1", "--pretty=%s"]).as_deref(),
        Some("reworded")
    );
}

#[test]
fn git_head_message_returns_subject_and_body() {
    let dir = tmp("git-head-message");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    git_commit_for(&dir.0, "Subject line\n\nBody text").unwrap();
    assert_eq!(
        git_head_message_for(&dir.0).unwrap(),
        "Subject line\n\nBody text"
    );
}

#[test]
fn git_head_message_fails_without_commits() {
    let dir = tmp("git-head-message-empty");
    if !init_git(&dir.0, "main", None) {
        return;
    }
    assert!(git_head_message_for(&dir.0).is_err());
}

#[test]
fn git_staged_context_reads_cached_diff() {
    let dir = tmp("git-staged-context");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&dir.0, "a.txt").unwrap();
    let context = git_staged_context_for(&dir.0).unwrap();
    assert_eq!(context.branch.as_deref(), Some("main"));
    assert!(context.summary.contains("a.txt"));
    assert!(context.patch.contains("beta"));
}

#[test]
fn git_staged_context_falls_back_to_unstaged() {
    let dir = tmp("git-staged-unstaged");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "gamma\n").unwrap();
    let context = git_staged_context_for(&dir.0).unwrap();
    assert!(context.patch.contains("gamma"));
}

#[test]
fn git_sync_counts_unpushed_commits() {
    let repo = tmp("git-ahead-repo");
    let origin = tmp("git-ahead-origin");
    if !init_git_commit(&repo.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    if Command::new("git")
        .args(["init", "--bare"])
        .current_dir(&origin.0)
        .status()
        .map(|status| !status.success())
        .unwrap_or(true)
    {
        return;
    }
    let origin_url = origin.0.to_string_lossy().into_owned();
    if !git(&repo.0, &["remote", "add", "origin", &origin_url])
        || !git(&repo.0, &["push", "-u", "origin", "main"])
    {
        return;
    }
    std::fs::write(repo.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&repo.0, "a.txt").unwrap();
    git_commit_for(&repo.0, "second").unwrap();
    let index = git_diff_index_for(&repo.0);
    assert_eq!(index.remote.as_deref(), Some("origin"));
    assert_eq!(index.upstream.as_deref(), Some("origin/main"));
    assert_eq!(index.default_branch.as_deref(), Some("main"));
    assert_eq!(index.ahead, 1);
    assert_eq!(index.behind, 0);
    assert_eq!(index.ahead_of_default, 1);
}

#[test]
fn git_sync_counts_feature_branch_without_upstream() {
    let repo = tmp("git-feature-repo");
    let origin = tmp("git-feature-origin");
    if !init_git_commit(&repo.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    if Command::new("git")
        .args(["init", "--bare"])
        .current_dir(&origin.0)
        .status()
        .map(|status| !status.success())
        .unwrap_or(true)
    {
        return;
    }
    let origin_url = origin.0.to_string_lossy().into_owned();
    if !git(&repo.0, &["remote", "add", "origin", &origin_url])
        || !git(&repo.0, &["push", "-u", "origin", "main"])
        || !git(&repo.0, &["checkout", "-b", "feature"])
    {
        return;
    }
    std::fs::write(repo.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&repo.0, "a.txt").unwrap();
    git_commit_for(&repo.0, "feature work").unwrap();
    let index = git_diff_index_for(&repo.0);
    assert_eq!(index.branch.as_deref(), Some("feature"));
    assert_eq!(index.upstream, None);
    assert_eq!(index.ahead, 1);
    assert_eq!(index.ahead_of_default, 1);
    let range = git_range_context_for(&repo.0).unwrap();
    assert_eq!(range.base, "main");
    assert_eq!(range.head, "feature");
    assert!(range.commit_summary.contains("feature work"));
}

#[test]
fn git_sync_marks_head_pushed_without_upstream() {
    let repo = tmp("git-pushed-repo");
    let origin = tmp("git-pushed-origin");
    if !init_git_commit(&repo.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    if Command::new("git")
        .args(["init", "--bare"])
        .current_dir(&origin.0)
        .status()
        .map(|status| !status.success())
        .unwrap_or(true)
    {
        return;
    }
    let origin_url = origin.0.to_string_lossy().into_owned();
    if !git(&repo.0, &["remote", "add", "origin", &origin_url])
        || !git(&repo.0, &["push", "-u", "origin", "main"])
        || !git(&repo.0, &["checkout", "-b", "feature"])
    {
        return;
    }
    std::fs::write(repo.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&repo.0, "a.txt").unwrap();
    git_commit_for(&repo.0, "feature work").unwrap();
    assert!(!git_diff_index_for(&repo.0).head_pushed);
    if !git(&repo.0, &["push", "origin", "feature"]) {
        return;
    }
    let index = git_diff_index_for(&repo.0);
    assert_eq!(index.upstream, None);
    assert!(index.head_pushed);
}

#[test]
fn git_sync_pulls_then_pushes() {
    let origin = tmp("git-sync-origin");
    let a = tmp("git-sync-a");
    let b = tmp("git-sync-b");
    if !init_git_commit(&a.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    if Command::new("git")
        .args(["init", "--bare"])
        .current_dir(&origin.0)
        .status()
        .map(|status| !status.success())
        .unwrap_or(true)
    {
        return;
    }
    let origin_url = origin.0.to_string_lossy().into_owned();
    if !git(&a.0, &["remote", "add", "origin", &origin_url])
        || !git(&a.0, &["push", "-u", "origin", "main"])
        || !git(&origin.0, &["symbolic-ref", "HEAD", "refs/heads/main"])
        || Command::new("git")
            .args(["clone", "-b", "main", &origin_url, "."])
            .current_dir(&b.0)
            .status()
            .map(|status| !status.success())
            .unwrap_or(true)
        || !git(&b.0, &["config", "user.name", "MonoCode"])
        || !git(&b.0, &["config", "user.email", "monocode@test"])
        || !git(&b.0, &["config", "commit.gpgsign", "false"])
        || !git(&b.0, &["config", "core.autocrlf", "false"])
        || !git(&b.0, &["checkout", "--", "."])
    {
        return;
    }

    std::fs::write(a.0.join("a.txt"), "beta\n").unwrap();
    git_stage_file_for(&a.0, "a.txt").unwrap();
    git_commit_for(&a.0, "from-a").unwrap();
    git_sync_changes_for(&a.0).unwrap();

    git_sync_changes_for(&b.0).unwrap();
    assert_eq!(
        std::fs::read_to_string(b.0.join("a.txt")).unwrap(),
        "beta\n"
    );
    assert_eq!(git_diff_index_for(&b.0).ahead, 0);
    assert_eq!(git_diff_index_for(&b.0).behind, 0);

    std::fs::write(b.0.join("b.txt"), "from-b\n").unwrap();
    git_stage_file_for(&b.0, "b.txt").unwrap();
    git_commit_for(&b.0, "from-b").unwrap();
    std::fs::write(a.0.join("c.txt"), "from-a-again\n").unwrap();
    git_stage_file_for(&a.0, "c.txt").unwrap();
    git_commit_for(&a.0, "from-a-again").unwrap();
    git_sync_changes_for(&a.0).unwrap();
    git_sync_changes_for(&b.0).unwrap();
    assert!(b.0.join("c.txt").exists());
    git_sync_changes_for(&a.0).unwrap();
    assert!(a.0.join("b.txt").exists());
}

#[test]
fn parse_gh_pr_list_prefers_open() {
    let json = r#"[{"number":2,"title":"Old","url":"https://example.com/2","state":"MERGED"},{"number":3,"title":"Now","url":"https://example.com/3","state":"OPEN"}]"#;
    let pr = parse_gh_pr_list(json).unwrap();
    assert_eq!(pr.number, 3);
    assert_eq!(pr.state, "open");
    assert_eq!(pr.title, "Now");
}

#[test]
fn pr_head_filter_qualifies_branch_with_repo_owner() {
    assert_eq!(
        github_pr_head_filter("yanhenrique-dev/Monocode-linux", "main").as_deref(),
        Some("yanhenrique-dev:main")
    );
}

#[test]
fn parse_github_repositories_includes_a_forks_parent() {
    let json = r#"{
            "nameWithOwner": "exemplo/monocode-exemplo",
            "parent": {
                "name": "Monocode-linux",
                "owner": { "login": "yanhenrique-dev" }
            }
        }"#;
    assert_eq!(
        parse_github_repositories(json).unwrap(),
        vec!["exemplo/monocode-exemplo", "yanhenrique-dev/Monocode-linux"]
    );
}

#[test]
fn slug_from_github_remote_url_accepts_https_ssh_and_bare_forms() {
    assert_eq!(
        slug_from_github_remote_url("https://github.com/yanhenrique-dev/Monocode-linux.git")
            .as_deref(),
        Some("yanhenrique-dev/monocode-linux")
    );
    assert_eq!(
        slug_from_github_remote_url("https://github.com/yanhenrique-dev/Monocode-linux").as_deref(),
        Some("yanhenrique-dev/monocode-linux")
    );
    assert_eq!(
        slug_from_github_remote_url("git@github.com:yanhenrique-dev/Monocode-linux.git").as_deref(),
        Some("yanhenrique-dev/monocode-linux")
    );
    assert_eq!(
        slug_from_github_remote_url("https://github.com/yanhenrique-dev/Monocode-linux/")
            .as_deref(),
        Some("yanhenrique-dev/monocode-linux")
    );
    // An explicit :443 is still github.com.
    assert_eq!(
        slug_from_github_remote_url("https://github.com:443/acme/web.git").as_deref(),
        Some("acme/web")
    );
}

#[test]
fn slug_from_github_remote_url_rejects_non_github_and_malformed_urls() {
    assert_eq!(
        slug_from_github_remote_url("https://gitlab.com/acme/web.git"),
        None
    );
    assert_eq!(
        slug_from_github_remote_url("git@gitlab.com:acme/web.git"),
        None
    );
    // An embedded github.com path on another host must not produce a slug.
    assert_eq!(
        slug_from_github_remote_url("https://gitlab.example/github.com/acme/web.git"),
        None
    );
    assert_eq!(
        slug_from_github_remote_url("git@gitlab.example:github.com/acme/web.git"),
        None
    );
    assert_eq!(slug_from_github_remote_url(""), None);
    assert_eq!(
        slug_from_github_remote_url("https://github.com/only-owner"),
        None
    );
    assert_eq!(
        slug_from_github_remote_url("https://github.com/a/b/c"),
        None
    );
    assert_eq!(slug_from_github_remote_url("not a url at all"), None);
}

#[test]
fn repo_view_args_pins_the_origin_slug_when_known() {
    assert_eq!(
        repo_view_args(
            &Some("yanhenrique-dev/Monocode-linux".to_string()),
            "nameWithOwner,parent"
        ),
        vec![
            "repo",
            "view",
            "yanhenrique-dev/Monocode-linux",
            "--json",
            "nameWithOwner,parent"
        ]
    );
    assert_eq!(
        repo_view_args(&None, "nameWithOwner"),
        vec!["repo", "view", "--json", "nameWithOwner"]
    );
}

#[test]
fn parse_github_repositories_keeps_a_normal_repo_single() {
    let json = r#"{
            "nameWithOwner": "yanhenrique-dev/Monocode-linux",
            "parent": null
        }"#;
    assert_eq!(
        parse_github_repositories(json).unwrap(),
        vec!["yanhenrique-dev/Monocode-linux"]
    );
}

#[test]
fn parse_github_work_items_maps_issue_fields() {
    let json = r#"[{
            "number": 5138,
            "title": "Promo codes fail to apply",
            "url": "https://github.com/acme/web/issues/5138",
            "state": "OPEN",
            "createdAt": "2026-08-20T09:00:00Z",
            "updatedAt": "2026-08-27T08:00:00Z",
            "labels": [{"name": "bug", "color": "d73a4a"}],
            "assignees": [{"login": "maya"}]
        }]"#;
    let items = parse_github_work_items(json, "issue", "acme/web").unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].kind, "issue");
    assert_eq!(items[0].number, 5138);
    assert_eq!(items[0].state, "open");
    assert_eq!(items[0].repo, "acme/web");
    assert_eq!(items[0].labels[0].name, "bug");
    assert_eq!(items[0].assignees[0].login, "maya");
    assert_eq!(
        items[0].assignees[0].avatar_url,
        "https://avatars.githubusercontent.com/maya?s=64"
    );
    assert!(!items[0].draft);
    let payload = serde_json::to_value(&items[0]).unwrap();
    assert_eq!(payload["createdAt"], "2026-08-20T09:00:00Z");
    assert_eq!(payload["updatedAt"], "2026-08-27T08:00:00Z");
}

#[test]
fn parse_github_work_items_reads_draft_prs() {
    let json = r#"[{
            "number": 12,
            "title": "WIP checkout",
            "url": "https://github.com/acme/web/pull/12",
            "state": "OPEN",
            "isDraft": true
        }]"#;
    let items = parse_github_work_items(json, "pr", "acme/web").unwrap();
    assert_eq!(items[0].kind, "pr");
    assert!(items[0].draft);
    assert!(items[0].labels.is_empty());
    assert_eq!(items[0].repo, "acme/web");
}

#[test]
fn github_work_item_creation_time_reaches_frontend() {
    for (kind, resource) in [("pr", "pull"), ("issue", "issues")] {
        let json = r#"{
            "number": 12,
            "title": "Checkout",
            "url": "https://github.com/acme/web/pull/12",
            "state": "OPEN",
            "createdAt": "2026-09-01T08:00:00Z",
            "updatedAt": "2026-09-11T08:00:00Z"
        }"#;
        let json = json.replace("/pull/", &format!("/{resource}/"));
        let item = parse_github_work_item(&json, kind, "acme/web").unwrap();
        let payload = serde_json::to_value(item).unwrap();
        assert_eq!(payload["kind"], kind);
        assert_eq!(payload["createdAt"], "2026-09-01T08:00:00Z");
        assert_eq!(payload["updatedAt"], "2026-09-11T08:00:00Z");
    }
}

#[test]
fn parse_github_work_item_reads_view_shape() {
    let json = r#"{
            "number": 12,
            "title": "WIP checkout",
            "url": "https://github.com/acme/web/pull/12",
            "state": "OPEN",
            "isDraft": true
        }"#;
    let item = parse_github_work_item(json, "pr", "acme/web").unwrap();
    assert_eq!(item.number, 12);
    assert_eq!(item.kind, "pr");
    assert_eq!(item.repo, "acme/web");
    assert!(item.draft);
}

#[test]
fn parse_github_work_item_details_reads_body_and_author() {
    let json = r#"{
            "body": "Steps to reproduce",
            "author": {"login": "maya"}
        }"#;
    let details = parse_github_work_item_details(json).unwrap();
    assert_eq!(details.body, "Steps to reproduce");
    assert_eq!(details.author, "maya");
    assert_eq!(
        details.author_avatar_url,
        "https://avatars.githubusercontent.com/maya?s=64"
    );
    assert_eq!(details.base_ref_name, "");
    assert_eq!(details.review_decision, "");
}

#[test]
fn parse_github_work_item_details_reads_pr_review_meta() {
    let json = r#"{
            "body": "Move the banner",
            "author": {"login": "ayush-porwal"},
            "baseRefName": "main",
            "headRefName": "agent-terminal",
            "reviewDecision": "REVIEW_REQUIRED"
        }"#;
    let details = parse_github_work_item_details(json).unwrap();
    assert_eq!(details.base_ref_name, "main");
    assert_eq!(details.head_ref_name, "agent-terminal");
    assert_eq!(details.review_decision, "REVIEW_REQUIRED");
}

#[test]
fn split_github_repo_reads_owner_and_name() {
    assert_eq!(
        split_github_repo(" yanhenrique-dev/Monocode-linux ").unwrap(),
        ("yanhenrique-dev".into(), "Monocode-linux".into())
    );
    assert!(split_github_repo("monocode").is_err());
    assert!(split_github_repo("acme/web extra").is_err());
}

#[test]
fn github_pr_actions_map_to_non_interactive_gh_commands() {
    assert_eq!(
        github_pr_action_args("acme/web", 42, "squash").unwrap(),
        ["pr", "merge", "42", "--repo", "acme/web", "--squash"]
    );
    assert_eq!(
        github_pr_action_args("acme/web", 42, "draft").unwrap(),
        ["pr", "ready", "42", "--repo", "acme/web", "--undo"]
    );
    assert_eq!(
        github_pr_action_args("acme/web", 42, "reopen").unwrap(),
        ["pr", "reopen", "42", "--repo", "acme/web"]
    );
    assert!(github_pr_action_args("acme/web", 42, "delete").is_err());
    assert!(github_pr_action_args("acme/web", 0, "merge").is_err());
    assert!(github_pr_action_args("invalid", 42, "merge").is_err());
}

#[test]
fn parse_github_work_item_thread_merges_conversation() {
    let json = r#"{
            "data": {
                "repository": {
                    "pullRequest": {
                        "reviewDecision": "APPROVED",
                        "baseRefName": "main",
                        "headRefName": "agent-terminal",
                        "commits": {
                            "totalCount": 2,
                            "nodes": [
                                {
                                    "commit": {
                                        "oid": "abcdef123456",
                                        "messageHeadline": "Show linked activity",
                                        "committedDate": "2026-08-31T11:45:00Z",
                                        "url": "https://github.com/acme/web/commit/abcdef123456",
                                        "author": {
                                            "name": "Maya Smith",
                                            "user": {"login": "maya"}
                                        }
                                    }
                                }
                            ]
                        },
                        "comments": {
                            "totalCount": 50,
                            "nodes": [
                                {
                                    "id": "IC_1",
                                    "author": {"login": "maya"},
                                    "body": "Looks good",
                                    "createdAt": "2026-08-31T10:00:00Z",
                                    "url": "https://github.com/acme/web/pull/1#issuecomment-1",
                                    "isMinimized": false
                                },
                                {
                                    "id": "IC_hidden",
                                    "author": {"login": "bot"},
                                    "body": "hidden",
                                    "createdAt": "2026-08-31T10:05:00Z",
                                    "isMinimized": true
                                }
                            ]
                        },
                        "reviews": {
                            "totalCount": 2,
                            "nodes": [
                                {
                                    "id": "PRR_empty",
                                    "author": {"login": "ada"},
                                    "body": "",
                                    "state": "COMMENTED",
                                    "submittedAt": "2026-08-31T11:00:00Z"
                                },
                                {
                                    "id": "PRR_2",
                                    "author": {"login": "ada"},
                                    "body": "Ship it",
                                    "state": "APPROVED",
                                    "submittedAt": "2026-08-31T12:00:00Z",
                                    "url": "https://github.com/acme/web/pull/1#pullrequestreview-2"
                                }
                            ]
                        },
                        "reviewThreads": {
                            "totalCount": 1,
                            "nodes": [
                                {
                                    "id": "PRRT_1",
                                    "isResolved": true,
                                    "path": "src/app.ts",
                                    "comments": {
                                        "totalCount": 2,
                                        "nodes": [
                                            {
                                                "id": "PRRC_1",
                                                "author": {"login": "lin"},
                                                "body": "Nit: name",
                                                "createdAt": "2026-08-31T11:30:00Z",
                                                "url": "https://github.com/acme/web/pull/1#discussion_r1",
                                                "path": "src/app.ts",
                                                "line": 12,
                                                "isMinimized": false
                                            },
                                            {
                                                "id": "PRRC_2",
                                                "author": {"login": "maya"},
                                                "body": "Fixed",
                                                "createdAt": "2026-08-31T11:40:00Z",
                                                "path": "src/app.ts",
                                                "line": 12,
                                                "isMinimized": false
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }"#;
    let thread = parse_github_work_item_thread(json, "pr").unwrap();
    assert!(thread.truncated);
    assert_eq!(thread.review_decision, "APPROVED");
    assert_eq!(thread.base_ref_name, "main");
    assert_eq!(thread.head_ref_name, "agent-terminal");
    assert_eq!(thread.commits.len(), 1);
    assert_eq!(thread.commits[0].oid, "abcdef123456");
    assert_eq!(thread.commits[0].message_headline, "Show linked activity");
    assert_eq!(thread.commits[0].author, "maya");
    assert_eq!(
        thread
            .comments
            .iter()
            .map(|comment| comment.id.as_str())
            .collect::<Vec<_>>(),
        ["IC_1", "PRRC_1", "PRR_2"]
    );
    assert_eq!(thread.comments[1].kind, "review_comment");
    assert_eq!(thread.comments[1].path, "src/app.ts");
    assert_eq!(thread.comments[1].line, Some(12));
    assert_eq!(thread.comments[1].thread_id, "PRRT_1");
    assert!(thread.comments[1].resolved);
    assert_eq!(thread.comments[1].replies.len(), 1);
    assert_eq!(thread.comments[1].replies[0].author, "maya");
    assert_eq!(thread.comments[1].replies[0].thread_id, "PRRT_1");
    assert_eq!(thread.comments[2].kind, "review");
    assert_eq!(thread.comments[2].state, "APPROVED");
}

#[test]
fn parse_github_work_item_thread_reads_issue_comments() {
    let json = r#"{
            "data": {
                "repository": {
                    "issue": {
                        "comments": {
                            "totalCount": 1,
                            "nodes": [
                                {
                                    "id": "IC_9",
                                    "author": {"login": "maya"},
                                    "body": "Still happens",
                                    "createdAt": "2026-08-31T09:00:00Z"
                                }
                            ]
                        }
                    }
                }
            }
        }"#;
    let thread = parse_github_work_item_thread(json, "issue").unwrap();
    assert!(!thread.truncated);
    assert_eq!(thread.comments.len(), 1);
    assert_eq!(thread.comments[0].author, "maya");
    assert_eq!(thread.comments[0].body, "Still happens");
}

#[test]
fn github_comment_input_rejects_empty_or_unknown() {
    assert_eq!(
        github_comment_input("issue", 12, "Looks good").unwrap(),
        ("issue", "Looks good")
    );
    assert!(github_comment_input("issue", 12, "  ").is_err());
    assert!(github_comment_input("gist", 12, "Hi").is_err());
    assert!(github_comment_input("pr", 0, "Hi").is_err());
}

#[test]
fn valid_github_node_id_allows_graphql_ids() {
    assert!(valid_github_node_id("PRRT_kwDOBQfyJc5nX8x-"));
    assert!(valid_github_node_id("IC_kwDOA=="));
    assert!(!valid_github_node_id(""));
    assert!(!valid_github_node_id("thread id"));
    assert!(!valid_github_node_id("id\nPRRT_1"));
}

#[test]
fn github_url_from_output_reads_the_last_http_line() {
    assert_eq!(
        github_url_from_output(
            "Posted\nhttps://github.com/acme/web/issues/1#issuecomment-9\n",
            "missing"
        )
        .unwrap(),
        "https://github.com/acme/web/issues/1#issuecomment-9"
    );
    assert_eq!(
        github_url_from_output("", "GitHub did not return a comment URL").unwrap_err(),
        "GitHub did not return a comment URL"
    );
}

#[test]
fn parse_github_review_reply_url_reads_graphql() {
    let json = r#"{
            "data": {
                "addPullRequestReviewThreadReply": {
                    "comment": { "url": "https://github.com/acme/web/pull/1#discussion_r9" }
                }
            }
        }"#;
    assert_eq!(
        parse_github_review_reply_url(json).unwrap(),
        "https://github.com/acme/web/pull/1#discussion_r9"
    );
    let error = parse_github_review_reply_url(
        r#"{"data":null,"errors":[{"message":"Could not resolve to a node"}]}"#,
    )
    .unwrap_err();
    assert!(error.contains("Could not resolve to a node"));
}

#[test]
fn parse_github_pr_merge_info_reads_permission_and_merge_state() {
    let json = r#"{
            "data": {
                "repository": {
                    "viewerPermission": "WRITE",
                    "pullRequest": {
                        "mergeable": "MERGEABLE",
                        "mergeStateStatus": "CLEAN"
                    }
                }
            }
        }"#;
    assert_eq!(
        parse_github_pr_merge_info(json).unwrap(),
        GitHubPrMergeInfo {
            viewer_permission: Some("WRITE".into()),
            mergeable: Some("MERGEABLE".into()),
            merge_state_status: Some("CLEAN".into()),
        }
    );
}

#[test]
fn parse_github_pr_merge_info_tolerates_partial_responses() {
    // Older `gh` or a missing PR: unknown fields stay unknown so the UI
    // keeps actions enabled instead of hiding them.
    let json = r#"{
            "data": {
                "repository": {
                    "viewerPermission": "READ",
                    "pullRequest": null
                }
            }
        }"#;
    assert_eq!(
        parse_github_pr_merge_info(json).unwrap(),
        GitHubPrMergeInfo {
            viewer_permission: Some("READ".into()),
            mergeable: None,
            merge_state_status: None,
        }
    );
    let error = parse_github_pr_merge_info(
        r#"{"data":null,"errors":[{"message":"Could not resolve to a Repository"}]}"#,
    )
    .unwrap_err();
    assert!(error.contains("Could not resolve to a Repository"));
}

fn work_item_fixture(number: i64, updated_at: &str) -> GitHubWorkItem {
    GitHubWorkItem {
        kind: "pr".into(),
        number,
        title: format!("PR {number}"),
        url: format!("https://github.com/acme/app/pull/{number}"),
        state: "open".into(),
        created_at: "2026-01-01T00:00:00Z".into(),
        updated_at: updated_at.into(),
        labels: vec![],
        assignees: vec![],
        draft: false,
        repo: "acme/app".into(),
    }
}

#[test]
fn merge_work_items_dedupes_review_requested_without_losing_assigned() {
    let assigned = vec![
        work_item_fixture(1, "2026-09-20T10:00:00Z"),
        work_item_fixture(2, "2026-09-20T10:00:00Z"),
    ];
    let review_requested = vec![
        work_item_fixture(2, "2026-09-20T10:00:00Z"),
        work_item_fixture(3, "2026-09-21T10:00:00Z"),
    ];
    let merged = merge_work_items(assigned, review_requested);
    assert_eq!(
        merged.iter().map(|item| item.number).collect::<Vec<_>>(),
        vec![3, 2, 1]
    );
}

#[test]
fn merge_work_items_prefers_fresher_snapshot_for_duplicates() {
    let assigned = vec![work_item_fixture(7, "2026-09-20T10:00:00Z")];
    let review_requested = vec![work_item_fixture(7, "2026-09-22T10:00:00Z")];
    let merged = merge_work_items(assigned, review_requested);
    assert_eq!(merged.len(), 1);
    assert_eq!(merged[0].updated_at, "2026-09-22T10:00:00Z");
}

#[test]
fn parse_github_pr_checks_reads_runs_and_status_contexts() {
    let json = r#"{
            "data": {
                "repository": {
                    "pullRequest": {
                        "commits": {
                            "nodes": [{
                                "commit": {
                                    "statusCheckRollup": {
                                        "state": "PENDING",
                                        "contexts": {
                                            "nodes": [
                                                {
                                                    "name": "CI / check (pull_request)",
                                                    "status": "IN_PROGRESS",
                                                    "conclusion": null,
                                                    "detailsUrl": "https://github.com/acme/app/actions/runs/1",
                                                    "startedAt": "2026-09-22T10:00:00Z"
                                                },
                                                {
                                                    "name": "CodeRabbit",
                                                    "status": "COMPLETED",
                                                    "conclusion": "SUCCESS",
                                                    "detailsUrl": "https://github.com/acme/app/pull/130",
                                                    "startedAt": "2026-09-22T09:00:00Z"
                                                },
                                                {
                                                    "context": "legacy-lint",
                                                    "state": "FAILURE",
                                                    "targetUrl": "https://ci.example.com/9",
                                                    "createdAt": "2026-09-22T08:00:00Z"
                                                }
                                            ]
                                        }
                                    }
                                }
                            }]
                        }
                    }
                }
            }
        }"#;
    let checks = parse_github_pr_checks(json).unwrap();
    assert_eq!(checks.state, "PENDING");
    assert_eq!(checks.checks.len(), 3);
    let running = checks
        .checks
        .iter()
        .find(|check| check.name == "CI / check (pull_request)")
        .unwrap();
    assert_eq!(running.status, "IN_PROGRESS");
    assert_eq!(running.conclusion, None);
    assert_eq!(running.started_at, "2026-09-22T10:00:00Z");
    let legacy = checks
        .checks
        .iter()
        .find(|check| check.name == "legacy-lint")
        .unwrap();
    assert_eq!(legacy.status, "COMPLETED");
    assert_eq!(legacy.conclusion, Some("FAILURE".into()));
}

#[test]
fn parse_github_pr_checks_tolerates_missing_rollup() {
    let json = r#"{"data": {"repository": {"pullRequest": {"commits": {"nodes": []}}}}}"#;
    let checks = parse_github_pr_checks(json).unwrap();
    assert_eq!(checks.state, "UNKNOWN");
    assert!(checks.checks.is_empty());
}

#[test]
fn parse_github_work_item_thread_reads_graphql_errors() {
    let json = r#"{
            "data": {"repository": null},
            "errors": [{"message": "Could not resolve to a Repository"}]
        }"#;
    let error = parse_github_work_item_thread(json, "pr").unwrap_err();
    assert!(error.contains("Could not resolve to a Repository"));
}

#[test]
fn github_avatar_url_encodes_bot_logins() {
    assert_eq!(
        github_avatar_url("dependabot[bot]"),
        "https://avatars.githubusercontent.com/dependabot%5Bbot%5D?s=64"
    );
    assert_eq!(github_avatar_url("  "), "");
}

#[test]
fn parse_github_pr_diff_meta_reads_files_and_totals() {
    let json = r#"{
            "additions": 971,
            "deletions": 225,
            "files": [
                {"path": "next.config.ts", "additions": 4, "deletions": 0},
                {"path": "package.json", "additions": 2, "deletions": 2}
            ]
        }"#;
    let diff = parse_github_pr_diff_meta(json).unwrap();
    assert_eq!(diff.additions, 971);
    assert_eq!(diff.deletions, 225);
    assert_eq!(diff.files.len(), 2);
    assert_eq!(diff.files[0].path, "next.config.ts");
    assert_eq!(diff.files[0].additions, 4);
    assert_eq!(diff.patch, "");
    assert!(!diff.truncated);
}

#[test]
fn parse_github_pr_oids_reads_base_and_head() {
    let json = r#"{
            "baseRefOid": "aaa111",
            "headRefOid": "bbb222",
            "files": []
        }"#;
    assert_eq!(
        parse_github_pr_oids(json).unwrap(),
        ("aaa111".into(), "bbb222".into())
    );
}

#[test]
fn git_diff_full_context_includes_distant_lines() {
    let dir = tmp("git-full-context");
    let original = (1..=40)
        .map(|i| format!("line-{i}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    if !init_git_commit(&dir.0, &[("big.txt", &original)]) {
        return;
    }
    let base = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    let updated = original.replace("line-30", "LINE-30");
    std::fs::write(dir.0.join("big.txt"), &updated).unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "edit"]) {
        return;
    }
    let head = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    let (patch, truncated) = git_diff_full_context(&dir.0, &base, &head).unwrap();
    assert!(!truncated);
    assert!(
        patch.contains("line-1"),
        "expected distant context in patch:\n{patch}"
    );
    assert!(patch.contains("LINE-30"), "expected changed line:\n{patch}");
    let default = git_run(&dir.0, &["diff", &base, &head]).unwrap_or_default();
    assert!(
        !default.contains("line-1"),
        "default context should omit distant lines"
    );
}

#[test]
fn git_diff_full_context_uses_canonical_plain_output() {
    let dir = tmp("git-full-context-canonical");
    if !init_git_commit(&dir.0, &[("file.txt", "alpha\n")]) {
        return;
    }
    let base = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    std::fs::write(dir.0.join("file.txt"), "beta\n").unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "edit"]) {
        return;
    }
    let head = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    let helper = dir.0.join("ext-diff.sh");
    std::fs::write(&helper, "#!/bin/sh\necho EXTERNAL\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(&helper).unwrap().permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&helper, permissions).unwrap();
    }
    if !git(&dir.0, &["config", "color.ui", "always"])
        || !git(&dir.0, &["config", "color.diff", "always"])
        || !git(&dir.0, &["config", "diff.noprefix", "true"])
        || !git(
            &dir.0,
            &["config", "diff.external", &helper.to_string_lossy()],
        )
    {
        return;
    }
    let raw = git_run(&dir.0, &["diff", &format!("{base}...{head}")]).unwrap_or_default();
    assert!(
        raw.contains("EXTERNAL") || !raw.contains("diff --git a/file.txt b/file.txt"),
        "hostile git settings should change a default diff:\n{raw}"
    );
    let (patch, truncated) = git_diff_full_context(&dir.0, &base, &head).unwrap();
    assert!(!truncated);
    assert!(
        patch.contains("diff --git a/file.txt b/file.txt"),
        "expected canonical prefixes:\n{patch}"
    );
    assert!(
        !patch.contains('\u{1b}') && !patch.contains("EXTERNAL"),
        "expected plain git diff output:\n{patch}"
    );
}

#[test]
fn git_diff_full_context_errors_without_a_merge_base() {
    let dir = tmp("git-full-context-unrelated");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    let base = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    if !git(&dir.0, &["checkout", "--orphan", "other"]) {
        return;
    }
    let _ = std::fs::remove_file(dir.0.join("a.txt"));
    std::fs::write(dir.0.join("b.txt"), "beta\n").unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "other"]) {
        return;
    }
    let head = git_run(&dir.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    assert!(git_run(&dir.0, &["merge-base", &base, &head]).is_none());
    let two_dot = git_run(&dir.0, &["diff", &base, &head]).unwrap_or_default();
    assert!(
        two_dot.contains("alpha") || two_dot.contains("beta"),
        "two-dot should invent a comparison:\n{two_dot}"
    );
    let err = git_diff_full_context(&dir.0, &base, &head).unwrap_err();
    assert!(
        err.to_lowercase().contains("merge base"),
        "expected merge-base error, got {err}"
    );
}

#[test]
fn ensure_git_commit_fetches_from_gh_resolved_remote() {
    let remote = tmp("git-full-context-upstream");
    if !init_git_commit(&remote.0, &[("note.txt", "hello\n")]) {
        return;
    }
    let oid = git_run(&remote.0, &["rev-parse", "HEAD"])
        .unwrap()
        .trim()
        .to_string();
    let decoy = tmp("git-full-context-origin");
    if !init_git_commit(&decoy.0, &[("other.txt", "decoy\n")]) {
        return;
    }
    let local = tmp("git-full-context-local");
    if !init_git_commit(&local.0, &[("local.txt", "local\n")]) {
        return;
    }
    let upstream_url = remote.0.to_string_lossy().into_owned();
    let origin_url = decoy.0.to_string_lossy().into_owned();
    if !git(&local.0, &["remote", "add", "origin", &origin_url])
        || !git(&local.0, &["remote", "add", "upstream", &upstream_url])
        || !git(&local.0, &["config", "remote.upstream.gh-resolved", "base"])
    {
        return;
    }
    assert_eq!(github_fetch_remote(&local.0).as_deref(), Some("upstream"));
    let spec = format!("{oid}^{{commit}}");
    assert!(git_output(&local.0, &["cat-file", "-e", &spec]).is_none());
    ensure_git_commit(&local.0, &oid).unwrap();
    assert!(git_output(&local.0, &["cat-file", "-e", &spec]).is_some());
}

#[test]
fn git_output_capped_stops_before_buffering_the_rest() {
    let dir = tmp("git-output-capped");
    let big = "x".repeat(80_000);
    if !init_git_commit(&dir.0, &[("big.txt", &format!("{big}\n"))]) {
        return;
    }
    std::fs::write(dir.0.join("big.txt"), format!("y{big}\n")).unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "edit"]) {
        return;
    }
    let (bytes, truncated) = git_output_capped(&dir.0, &["diff", "HEAD~1", "HEAD"], 1024).unwrap();
    assert!(truncated);
    assert!(bytes.len() <= 1024);
    let (head, truncated) = git_output_capped(&dir.0, &["rev-parse", "HEAD"], 1024).unwrap();
    assert!(!truncated);
    assert!(!head.is_empty());
}

#[test]
fn git_stage_rejects_path_escape() {
    let dir = tmp("git-stage-escape");
    assert!(git_stage_file_for(&dir.0, "../secret.txt").is_err());
    assert!(git_discard_file_for(&dir.0, "../secret.txt").is_err());
}

#[test]
fn git_branches_empty_outside_a_repo() {
    let dir = tmp("git-branches-none");
    std::fs::write(dir.0.join("notes.txt"), "hello\n").unwrap();
    assert_eq!(git_branches_for(&dir.0), GitBranches::default());
}

#[test]
fn git_branches_lists_unborn_head() {
    let dir = tmp("git-branches-unborn");
    if !init_git(&dir.0, "main", None) {
        return;
    }
    let listed = git_branches_for(&dir.0);
    assert_eq!(listed.current.as_deref(), Some("main"));
    assert!(!listed.detached);
    assert!(listed
        .branches
        .iter()
        .any(|branch| { branch.name == "main" && branch.current && branch.remote.is_none() }));
}

#[test]
fn git_create_and_checkout_branch() {
    let dir = tmp("git-branch-switch");
    if !init_git_commit(&dir.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    assert_eq!(
        git_create_branch_for(&dir.0, "feat/picker").unwrap(),
        "feat/picker"
    );
    let listed = git_branches_for(&dir.0);
    assert_eq!(listed.current.as_deref(), Some("feat/picker"));
    assert_eq!(git_checkout_for(&dir.0, "main", None).unwrap(), "main");
    assert_eq!(git_head_branch(&dir.0).as_deref(), Some("main"));
    assert!(git_create_branch_for(&dir.0, "feat/picker").is_err());
    assert!(git_create_branch_for(&dir.0, "bad name").is_err());
    assert!(git_checkout_for(&dir.0, "missing", None).is_err());
}

#[test]
fn git_stash_lets_checkout_proceed() {
    let dir = tmp("git-stash-checkout");
    if !init_git_commit(&dir.0, &[("a.txt", "main\n")]) {
        return;
    }
    if git_create_branch_for(&dir.0, "feature").is_err() {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "feature\n").unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "feature"]) {
        return;
    }
    if git_checkout_for(&dir.0, "main", None).is_err() {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "dirty\n").unwrap();
    let err = git_checkout_for(&dir.0, "feature", None).unwrap_err();
    assert!(checkout_blocked_by_changes(&err), "{err}");
    git_stash_for(&dir.0, Some("wip")).unwrap();
    assert_eq!(
        git_checkout_for(&dir.0, "feature", None).unwrap(),
        "feature"
    );
    assert_eq!(
        std::fs::read_to_string(dir.0.join("a.txt")).unwrap(),
        "feature\n"
    );
}

#[test]
fn git_stash_includes_untracked_that_block_checkout() {
    let dir = tmp("git-stash-untracked");
    if !init_git_commit(&dir.0, &[("a.txt", "main\n")]) {
        return;
    }
    if git_create_branch_for(&dir.0, "feature").is_err() {
        return;
    }
    std::fs::write(dir.0.join("new.txt"), "on-feature\n").unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "add new"]) {
        return;
    }
    if git_checkout_for(&dir.0, "main", None).is_err() {
        return;
    }
    std::fs::write(dir.0.join("new.txt"), "untracked\n").unwrap();
    let err = git_checkout_for(&dir.0, "feature", None).unwrap_err();
    assert!(checkout_blocked_by_changes(&err), "{err}");
    git_stash_for(&dir.0, None).unwrap();
    assert_eq!(
        git_checkout_for(&dir.0, "feature", None).unwrap(),
        "feature"
    );
    assert_eq!(
        std::fs::read_to_string(dir.0.join("new.txt")).unwrap(),
        "on-feature\n"
    );
}

#[test]
fn git_commit_lets_checkout_proceed() {
    let dir = tmp("git-commit-checkout");
    if !init_git_commit(&dir.0, &[("a.txt", "main\n")]) {
        return;
    }
    if git_create_branch_for(&dir.0, "feature").is_err() {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "feature\n").unwrap();
    if !git(&dir.0, &["add", "."]) || !git(&dir.0, &["commit", "-m", "feature"]) {
        return;
    }
    if git_checkout_for(&dir.0, "main", None).is_err() {
        return;
    }
    std::fs::write(dir.0.join("a.txt"), "dirty\n").unwrap();
    git_checked(&dir.0, &["add", "-A", "--", "."]).unwrap();
    git_commit_for(&dir.0, "save dirty").unwrap();
    assert_eq!(
        git_checkout_for(&dir.0, "feature", None).unwrap(),
        "feature"
    );
    assert_eq!(
        std::fs::read_to_string(dir.0.join("a.txt")).unwrap(),
        "feature\n"
    );
}

#[test]
fn git_branches_lists_remote_only_branch() {
    let repo = tmp("git-branch-remote-repo");
    let origin = tmp("git-branch-remote-origin");
    if !init_git_commit(&repo.0, &[("a.txt", "alpha\n")]) {
        return;
    }
    if Command::new("git")
        .args(["init", "--bare"])
        .current_dir(&origin.0)
        .status()
        .map(|status| !status.success())
        .unwrap_or(true)
    {
        return;
    }
    let origin_url = origin.0.to_string_lossy().into_owned();
    if !git(&repo.0, &["remote", "add", "origin", &origin_url])
        || !git(&repo.0, &["push", "-u", "origin", "main"])
        || git_create_branch_for(&repo.0, "feature").is_err()
        || !git(&repo.0, &["push", "-u", "origin", "feature"])
        || git_checkout_for(&repo.0, "main", None).is_err()
        || !git(&repo.0, &["branch", "-D", "feature"])
    {
        return;
    }
    let listed = git_branches_for(&repo.0);
    assert_eq!(listed.current.as_deref(), Some("main"));
    let remote = listed
        .branches
        .iter()
        .find(|branch| branch.name == "feature")
        .unwrap();
    assert_eq!(remote.remote.as_deref(), Some("origin"));
    assert!(!listed
        .branches
        .iter()
        .any(|branch| branch.name == "main" && branch.remote.is_some()));
    assert_eq!(
        git_checkout_for(&repo.0, "feature", Some("origin")).unwrap(),
        "feature"
    );
    assert_eq!(git_head_branch(&repo.0).as_deref(), Some("feature"));
}
