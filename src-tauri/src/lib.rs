use tauri::Manager;

mod chat_background;
mod checkpoint;
mod clipboard;
mod composer_draft;
mod control;
pub mod control_cli;
mod cursor_store;
mod external_editor;
mod external_url;
mod fs;
mod gitlab;
mod harness;
mod host;
mod inbox_media;
mod linear;
mod link_preview;
mod notes;
mod notifications;
mod project_logo;
mod pty;
mod rate_limits;
mod reminders;
mod search;
mod session_store;
mod skills;
mod window;
mod window_transfer;
mod worktree_lifecycle;
mod worktrees;

// Phase 1 seam: spawn / kill harness children per MonoCode thread.
// Adapters own the protocol; this host only supervises processes.

/// Project directory for new sessions — prefer cwd, else home.
#[tauri::command]
fn default_cwd() -> String {
    if let Ok(cwd) = std::env::current_dir() {
        return fs::path_to_js(&cwd);
    }
    dirs_home()
        .map(|home| fs::path_to_js(std::path::Path::new(&home)))
        .unwrap_or_else(|| "~".into())
}

#[tauri::command]
fn home_dir() -> String {
    dirs_home()
        .map(|home| fs::path_to_js(std::path::Path::new(&home)))
        .unwrap_or_else(|| "~".into())
}

pub(crate) struct PasswdIdentity {
    pub home: String,
    pub user: String,
    pub shell: String,
}

pub(crate) fn dirs_home() -> Option<String> {
    for key in ["HOME", "USERPROFILE"] {
        if let Some(home) = std::env::var_os(key) {
            let home = home.to_string_lossy().into_owned();
            if !home.is_empty() {
                return Some(home);
            }
        }
    }
    passwd_identity().map(|id| id.home)
}

/// Finder-launched .app bundles often omit HOME/USER/SHELL. Fall back to the
/// passwd database so harness CLIs still find `~/.fx` and the login keychain.
pub(crate) fn passwd_identity() -> Option<PasswdIdentity> {
    #[cfg(unix)]
    {
        let uid = unsafe { libc::getuid() };
        let mut buf = vec![0u8; 4096];
        let mut pwd = unsafe { std::mem::zeroed::<libc::passwd>() };
        let mut result = std::ptr::null_mut::<libc::passwd>();
        let rc = unsafe {
            libc::getpwuid_r(
                uid,
                &mut pwd,
                buf.as_mut_ptr() as *mut libc::c_char,
                buf.len(),
                &mut result,
            )
        };
        if rc != 0 || result.is_null() {
            return None;
        }
        unsafe {
            let user = std::ffi::CStr::from_ptr(pwd.pw_name)
                .to_string_lossy()
                .into_owned();
            let home = std::ffi::CStr::from_ptr(pwd.pw_dir)
                .to_string_lossy()
                .into_owned();
            let shell = std::ffi::CStr::from_ptr(pwd.pw_shell)
                .to_string_lossy()
                .into_owned();
            if user.is_empty() || home.is_empty() {
                return None;
            }
            Some(PasswdIdentity { home, user, shell })
        }
    }
    #[cfg(not(unix))]
    {
        None
    }
}

#[tauri::command]
fn open_new_window(app: tauri::AppHandle) -> Result<(), String> {
    window::open_new_window(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Flathub forbids self-updaters: the sandbox build skips the updater
    // plugin entirely (the frontend also hides its update UI — see
    // `flatpak_sandboxed`). Native AppImage builds keep it.
    let builder = tauri::Builder::default().plugin(tauri_plugin_process::init());
    let builder = if host::in_flatpak() {
        builder
    } else {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    };
    let app = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(harness::HarnessHost::new())
        .manage(pty::PtyHost::new())
        .manage(window_transfer::WindowTransferState::new())
        .setup(|app| {
            harness::reap_orphaned_harness_processes();
            session_store::init(app.handle())?;
            control::init(app.handle())?;
            reminders::init(app.handle());
            checkpoint::init(app.handle())?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            control::control_enable,
            control::control_disable,
            control::control_reply,
            control::control_save,
            control::control_load,
            control::control_scopes,
            control::control_write_path,
            control::control_attach_worker,
            control::control_authorize_turn,
            control::control_turn_finished,
            default_cwd,
            home_dir,
            host::flatpak_sandboxed,
            notifications::notification_permission,
            notifications::request_notification_permission,
            notifications::show_notification,
            notifications::open_notification_settings,
            reminders::reminder_list,
            reminders::reminder_set,
            reminders::reminder_clear,
            reminders::reminder_configure,
            reminders::reminder_take_open,
            reminders::reminder_register_window,
            reminders::reminder_open,
            external_editor::list_external_editors,
            external_editor::open_in_external_editor,
            external_url::open_external_url,
            fs::read::list_dir,
            fs::read::list_project_files,
            fs::git::git_diff_stats,
            fs::git::git_diff_index,
            fs::git::git_diff_files,
            fs::git::git_file_diff,
            fs::git::git_history,
            fs::git::git_commit_files,
            fs::git::git_commit_file_diff,
            fs::git::git_stage_file,
            fs::git::git_stage_contents,
            fs::git::git_unstage_file,
            fs::git::git_discard_file,
            fs::git::git_discard_all,
            fs::git::git_stage_all,
            fs::git::git_unstage_all,
            fs::git::git_commit,
            fs::git::git_head_message,
            fs::git::git_staged_context,
            fs::git::git_push,
            fs::git::git_pull,
            fs::git::git_sync,
            fs::git::git_range_context,
            fs::github::git_pr_status,
            fs::github::git_pr_create,
            fs::github::git_github_status,
            fs::github::git_github_repo,
            fs::github::git_github_repositories,
            fs::github::git_github_work_item,
            fs::github::git_github_work_items,
            fs::github::git_github_work_item_details,
            fs::github::git_github_work_item_thread,
            fs::github::git_github_work_item_comment,
            fs::github::git_github_pr_action,
            fs::github::git_github_pr_merge_info,
            fs::github::git_github_pr_diff,
            inbox_media::fetch_inbox_media,
            gitlab::gitlab_status,
            gitlab::gitlab_set_config,
            gitlab::gitlab_repo,
            gitlab::gitlab_list_work_items,
            gitlab::gitlab_list_todos,
            gitlab::gitlab_work_item_details,
            gitlab::gitlab_work_item_thread,
            gitlab::gitlab_work_item_comment,
            gitlab::gitlab_mr_diff,
            linear::linear_status,
            linear::linear_set_token,
            linear::linear_list_teams,
            linear::linear_list_issues,
            linear::linear_issue_details,
            linear::linear_issue_thread,
            linear::linear_issue_comment,
            link_preview::fetch_link_preview,
            fs::git::git_branches,
            fs::git::git_checkout,
            fs::git::git_create_branch,
            fs::git::git_stash,
            worktrees::git_worktrees,
            worktrees::git_worktree_create,
            worktrees::git_worktree_rename_branch,
            worktrees::git_worktree_check_remove,
            worktrees::git_worktree_remove,
            fs::write::create_path,
            fs::write::rename_path,
            fs::write::delete_path,
            fs::write::copy_path,
            fs::write::move_path,
            fs::write::reveal_path,
            clipboard::clipboard_file_paths,
            clipboard::copy_file_to_clipboard,
            fs::write::clone_repo,
            fs::read::read_file_preview,
            fs::read::stat_files,
            fs::read::inspect_paths,
            fs::read::read_file_base64,
            fs::read::read_binary_file,
            fs::write::write_attachment,
            fs::read::read_text_file,
            fs::omp::omp_session_interjections,
            fs::omp::omp_active_assistant_texts,
            fs::write::write_text_file,
            skills::list_skills,
            search::search_project,
            cursor_store::cursor_tool_calls,
            cursor_store::cursor_subagent_runs,
            harness::harness_resolve_cursor,
            harness::harness_resolve_codex,
            harness::harness_resolve_opencode,
            harness::harness_resolve_claude,
            harness::harness_resolve_omp,
            harness::harness_resolve_pi,
            harness::harness_resolve_fx,
            harness::harness_resolve_grok,
            harness::harness_resolve_mcode,
            harness::harness_resolve_hermes,
            harness::harness_resolve_antigravity,
            harness::harness_free_port,
            harness::harness_spawn,
            harness::harness_write,
            harness::harness_kill,
            harness::harness_kill_all,
            harness::harness_http,
            harness::harness_sse_open,
            harness::harness_sse_close,
            harness::harness_exec,
            rate_limits::fetch_claude_usage,
            rate_limits::fetch_opencode_go_usage,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_status,
            pty::pty_kill,
            pty::pty_kill_all,
            session_store::session_upsert,
            session_store::session_list_by_project,
            session_store::session_list_linked,
            session_store::session_search,
            session_store::session_get,
            session_store::session_delete,
            session_store::session_set_archived,
            session_store::session_set_pinned,
            session_store::session_set_in_flight,
            session_store::session_list_in_flight,
            session_store::session_take_in_flight,
            session_store::workspace_set_snapshot,
            session_store::workspace_get_snapshot,
            composer_draft::composer_draft_get,
            composer_draft::composer_draft_set,
            notes::notes_list,
            notes::notes_get,
            notes::notes_upsert,
            notes::notes_delete,
            notes::notes_save_image,
            notes::notes_image_path,
            checkpoint::session_checkpoint_ensure,
            checkpoint::session_checkpoint_prepare,
            checkpoint::session_checkpoint_capture,
            checkpoint::session_checkpoint_adopt,
            checkpoint::session_checkpoint_status,
            checkpoint::session_checkpoint_file_diff,
            checkpoint::session_checkpoint_undo,
            checkpoint::session_checkpoint_keep,
            clipboard::clipboard_file_paths,
            clipboard::copy_file_to_clipboard,
            open_new_window,
            window::destroy_window,
            window::quit_poll_reply,
            window::quit_decision,
            window::quit_ready,
            window_transfer::stage_window_transfer,
            window_transfer::take_window_transfer,
            chat_background::save_chat_background,
            chat_background::remove_chat_background,
            chat_background::save_project_chat_background,
            chat_background::remove_project_chat_background,
            project_logo::save_project_logo,
            project_logo::remove_project_logo,
            project_logo::forget_logo_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building MonoCode");

    app.run(|handle, event| match event {
        tauri::RunEvent::Ready => {
            window::ensure_launch_window_visible(handle);
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } => {
            window::forget_quit_window(handle, &label);
            let other_window = handle.webview_windows().keys().any(|name| name != &label);
            control::window_closed(handle, &label);
            if !other_window {
                reap_harness_children(handle);
            }
        }
        tauri::RunEvent::ExitRequested { api, code, .. } => {
            if window::allow_exit() {
                return;
            }
            api.prevent_exit();
            // Last window destroyed (red button).
            if code.is_none() {
                window::request_quit(handle);
            }
        }
        tauri::RunEvent::Exit => {
            reap_harness_children(handle);
        }
        _ => {}
    });
}

fn reap_harness_children(handle: &tauri::AppHandle) {
    if let Some(host) = handle.try_state::<harness::HarnessHost>() {
        host.kill_all();
    }
    if let Some(host) = handle.try_state::<pty::PtyHost>() {
        host.kill_all();
    }
}
