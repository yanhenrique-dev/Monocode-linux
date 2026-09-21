use std::collections::HashMap;
use std::io::{Read, Write};
use std::os::unix::io::AsRawFd;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::dirs_home;
use crate::fs::expand_home;

const DATA_EVENT: &str = "pty-data";
const EXIT_EVENT: &str = "pty-exit";
const READ_CHUNK: usize = 32 * 1024;
/// Cap how often a busy PTY hops the webview. Each `emit` is a JS eval; a
/// flood of small reads was thousands per second and froze input.
const PTY_COALESCE: Duration = Duration::from_millis(8);
const KILL_ESCALATE: Duration = Duration::from_secs(1);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PtyData {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PtyExit {
    id: String,
    code: Option<i32>,
}

struct LivePty {
    cwd: std::path::PathBuf,
    writer: Mutex<Box<dyn Write + Send>>,
    master_fd: i32,
    pid: u32,
}

pub struct PtyHost {
    sessions: Mutex<HashMap<String, Arc<LivePty>>>,
}

impl PtyHost {
    pub(crate) fn has_working_dir(&self, path: &std::path::Path) -> bool {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .any(|live| crate::worktrees::contains_working_dir(path, &live.cwd))
    }

    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn insert(&self, id: String, live: Arc<LivePty>) -> Option<Arc<LivePty>> {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id, live)
    }

    fn get(&self, id: &str) -> Option<Arc<LivePty>> {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(id)
            .cloned()
    }

    fn remove(&self, id: &str) -> Option<Arc<LivePty>> {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id)
    }

    fn remove_if_pid(&self, id: &str, pid: u32) -> Option<Arc<LivePty>> {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        if sessions.get(id).map(|live| live.pid) != Some(pid) {
            return None;
        }
        sessions.remove(id)
    }

    pub(crate) fn kill_all(&self) {
        let kids: Vec<Arc<LivePty>> = {
            let mut map = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
            map.drain().map(|(_, live)| live).collect()
        };
        let pids: Vec<u32> = kids.iter().map(|live| live.pid).collect();
        for live in kids {
            hangup(live.pid);
            close_fd(live.master_fd);
        }
        // Quit and `Drop` both exit the process, so the SIGKILL has to land
        // before this returns. `terminate`'s detached escalate thread never gets
        // to run, and every shell is its own `setsid` session that outlives us.
        crate::harness::terminate_all(&pids);
    }
}

impl Drop for PtyHost {
    fn drop(&mut self) {
        self.kill_all();
    }
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    host: State<PtyHost>,
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if let Some(prev) = host.remove(&id) {
        terminate(prev.pid);
        close_fd(prev.master_fd);
    }

    // Hold a spawn reservation until the shell is registered below: without
    // it, a worktree removal can pass its preflight while the PTY is still
    // between fork and insert, deleting the dir from under the new shell
    // (same race `harness_spawn` already guards against).
    let _spawn_guard = crate::worktree_lifecycle::reserve_spawn(&working_dir(&cwd))?;

    spawn_unix(app, host, id, cwd, cols.max(2), rows.max(2))
}

#[tauri::command]
pub fn pty_write(host: State<PtyHost>, id: String, data: String) -> Result<(), String> {
    let live = host
        .get(&id)
        .ok_or_else(|| "Terminal is not running".to_string())?;
    let mut writer = live.writer.lock().unwrap_or_else(|e| e.into_inner());
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| format!("Failed to write to terminal: {e}"))
}

#[tauri::command]
pub fn pty_resize(host: State<PtyHost>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let live = host
        .get(&id)
        .ok_or_else(|| "Terminal is not running".to_string())?;
    resize_fd(live.master_fd, cols.max(2), rows.max(2))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PtyStatus {
    foreground: Option<String>,
}

/// Off the main thread: this forks `ps`, and the title poll calls it once a
/// second for every open terminal.
#[tauri::command(async)]
pub fn pty_status(host: State<'_, PtyHost>, id: String) -> Result<PtyStatus, String> {
    let live = host
        .get(&id)
        .ok_or_else(|| "Terminal is not running".to_string())?;
    let foreground = foreground_label(live.master_fd, live.pid);
    Ok(PtyStatus { foreground })
}

#[tauri::command]
pub fn pty_kill(host: State<PtyHost>, id: String) -> Result<(), String> {
    if let Some(live) = host.remove(&id) {
        terminate(live.pid);
        close_fd(live.master_fd);
    }
    Ok(())
}

/// Off the main thread: `kill_all` waits for the shells to die before it
/// returns, and a window close calls this while the app keeps running.
#[tauri::command(async)]
pub fn pty_kill_all(host: State<'_, PtyHost>) -> Result<(), String> {
    host.kill_all();
    Ok(())
}

fn spawn_unix(
    app: AppHandle,
    host: State<PtyHost>,
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    use std::fs::File;
    use std::os::unix::io::FromRawFd;
    use std::os::unix::process::CommandExt;

    let workdir = working_dir(&cwd);
    let (shell, args) = default_shell();
    let (master, slave) = open_pty(cols, rows)?;

    // Inside Flatpak the user's shell lives on the host: fork flatpak-spawn
    // and let it exec the host shell with our piped stdio.
    let mut cmd = crate::host::command(&shell);
    cmd.args(&args)
        .current_dir(&workdir)
        .stdin(dup_stdio(slave)?)
        .stdout(dup_stdio(slave)?)
        .stderr(dup_stdio(slave)?)
        .env("TERM", "xterm-256color")
        .env("COLORTERM", "truecolor")
        .env("COLORFGBG", "15;0")
        .env("TERM_PROGRAM", "MonoCode")
        .env("PATH", crate::harness::gui_search_path());
    if let Some(home) = dirs_home() {
        cmd.env("HOME", &home);
    }
    cmd.env("PWD", &workdir);

    // setsid() already creates a new session and process group. Calling
    // process_group(0) first makes the child a group leader, so setsid()
    // fails with EPERM ("Operation not permitted").
    let slave_fd = slave;
    unsafe {
        cmd.pre_exec(move || {
            if libc::setsid() < 0 {
                return Err(std::io::Error::last_os_error());
            }
            // Controlling tty is best-effort; the shell still runs without it.
            let _ = libc::ioctl(0, libc::TIOCSCTTY as _, 0);
            if slave_fd > 2 {
                libc::close(slave_fd);
            }
            Ok(())
        });
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start {shell}: {e}"))?;
    close_fd(slave);
    let pid = child.id();

    set_cloexec(master);
    let reader = unsafe { File::from_raw_fd(dup_fd(master)?) };
    let writer = unsafe { File::from_raw_fd(dup_fd(master)?) };

    let live = Arc::new(LivePty {
        cwd: workdir.clone(),
        writer: Mutex::new(Box::new(writer)),
        master_fd: master,
        pid,
    });
    host.insert(id.clone(), live);

    let data_app = app.clone();
    let data_id = id.clone();
    thread::spawn(move || {
        let mut file = reader;
        let fd = file.as_raw_fd();
        let mut buf = vec![0_u8; READ_CHUNK];
        let mut acc = Vec::with_capacity(READ_CHUNK);
        let mut last_emit = Instant::now();
        loop {
            if acc.is_empty() {
                match file.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        acc.extend_from_slice(&buf[..n]);
                        last_emit = Instant::now();
                    }
                    Err(_) => break,
                }
            } else if pty_should_flush(acc.len(), last_emit.elapsed())
                || !wait_readable(fd, PTY_COALESCE.saturating_sub(last_emit.elapsed()))
            {
                emit_pty_data(&data_app, &data_id, &acc);
                acc.clear();
                last_emit = Instant::now();
            } else {
                match file.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => acc.extend_from_slice(&buf[..n]),
                    Err(_) => break,
                }
            }
        }
        emit_pty_data(&data_app, &data_id, &acc);
    });

    let wait_app = app;
    let wait_id = id;
    thread::spawn(move || {
        let code = child.wait().ok().and_then(|status| status.code());
        // Only announce this child. A remount/respawn reuses the id, and the
        // previous wait thread must not paint "[process exited]" on the new PTY
        // or yank the replacement out of the host map.
        let emit = if let Some(host) = wait_app.try_state::<PtyHost>() {
            if let Some(live) = host.remove_if_pid(&wait_id, pid) {
                close_fd(live.master_fd);
                true
            } else {
                false
            }
        } else {
            false
        };
        if emit {
            let _ = wait_app.emit(EXIT_EVENT, PtyExit { id: wait_id, code });
        }
    });

    Ok(())
}

fn working_dir(cwd: &str) -> std::path::PathBuf {
    let path = expand_home(cwd);
    if path.is_dir() {
        return path;
    }
    dirs_home().map(std::path::PathBuf::from).unwrap_or(path)
}

fn default_shell() -> (String, Vec<String>) {
    let shell = std::env::var("SHELL")
        .ok()
        .filter(|shell| !shell.is_empty())
        .unwrap_or_else(|| "/bin/bash".into());
    let args = login_args(&shell)
        .iter()
        .map(|arg| (*arg).to_string())
        .collect();
    (shell, args)
}

fn login_args(shell: &str) -> &'static [&'static str] {
    match std::path::Path::new(shell)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or(shell)
    {
        "zsh" | "bash" | "sh" | "fish" => &["-l"],
        _ => &[],
    }
}

/// The hangup a closing shell expects, without `terminate`'s escalation.
fn hangup(pid: u32) {
    if pid == 0 || pid == 1 {
        return;
    }
    // Sandboxed shells run on the host; a local kill cannot reach them.
    // flatpak-spawn forwards the signal to the host child while the proxy
    // is alive, and closing our stdio pipes delivers EOF to the shell.
    if crate::host::in_flatpak() {
        crate::host::signal_host(pid, false, "HUP");
        crate::host::signal_host(pid, true, "HUP");
        return;
    }
    let ipid = pid as i32;
    unsafe {
        libc::kill(ipid, libc::SIGHUP);
        libc::kill(-ipid, libc::SIGHUP);
    }
}

fn terminate(pid: u32) {
    if pid == 0 || pid == 1 {
        return;
    }
    // See hangup(): sandboxed shells live on the host.
    if crate::host::in_flatpak() {
        crate::host::signal_host(pid, false, "HUP");
        crate::host::signal_host(pid, true, "HUP");
        crate::host::signal_host(pid, false, "TERM");
        crate::host::signal_host(pid, true, "TERM");
        let escalate_pid = pid;
        thread::spawn(move || {
            thread::sleep(KILL_ESCALATE);
            crate::host::signal_host(escalate_pid, false, "KILL");
            crate::host::signal_host(escalate_pid, true, "KILL");
        });
        return;
    }
    let ipid = pid as i32;
    unsafe {
        libc::kill(ipid, libc::SIGHUP);
        libc::kill(-ipid, libc::SIGHUP);
        libc::kill(ipid, libc::SIGTERM);
        libc::kill(-ipid, libc::SIGTERM);
    }
    thread::spawn(move || {
        thread::sleep(KILL_ESCALATE);
        unsafe {
            libc::kill(ipid, libc::SIGKILL);
            libc::kill(-ipid, libc::SIGKILL);
        }
    });
}

fn open_pty(cols: u16, rows: u16) -> Result<(i32, i32), String> {
    let master = unsafe { libc::posix_openpt(libc::O_RDWR | libc::O_NOCTTY) };
    if master < 0 {
        return Err(os_err("Failed to open terminal"));
    }
    if unsafe { libc::grantpt(master) } != 0 || unsafe { libc::unlockpt(master) } != 0 {
        close_fd(master);
        return Err(os_err("Failed to unlock terminal"));
    }
    let name = slave_name(master).inspect_err(|_| {
        close_fd(master);
    })?;
    let slave = unsafe { libc::open(name.as_ptr(), libc::O_RDWR | libc::O_NOCTTY) };
    if slave < 0 {
        close_fd(master);
        return Err(os_err("Failed to open terminal slave"));
    }
    if let Err(err) = resize_fd(master, cols, rows) {
        close_fd(master);
        close_fd(slave);
        return Err(err);
    }
    Ok((master, slave))
}

fn slave_name(master: i32) -> Result<std::ffi::CString, String> {
    // `c_char` keeps the pointer type portable: `i8` matches Linux but not
    // every target where the PTY helpers still compile.
    let mut buf = vec![0 as libc::c_char; 64];
    let ret = unsafe { libc::ptsname_r(master, buf.as_mut_ptr(), buf.len()) };
    if ret != 0 {
        return Err(os_err("Failed to resolve terminal name"));
    }
    let last = buf.len() - 1;
    buf[last] = 0;
    Ok(unsafe { std::ffi::CStr::from_ptr(buf.as_ptr()) }.to_owned())
}

fn resize_fd(fd: i32, cols: u16, rows: u16) -> Result<(), String> {
    let size = libc::winsize {
        ws_row: rows,
        ws_col: cols,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    if unsafe { libc::ioctl(fd, libc::TIOCSWINSZ, &size) } != 0 {
        return Err(os_err("Failed to resize terminal"));
    }
    Ok(())
}

fn dup_fd(fd: i32) -> Result<i32, String> {
    let next = unsafe { libc::dup(fd) };
    if next < 0 {
        return Err(os_err("Failed to duplicate terminal"));
    }
    Ok(next)
}

fn dup_stdio(fd: i32) -> Result<std::process::Stdio, String> {
    use std::os::unix::io::FromRawFd;
    let next = dup_fd(fd)?;
    Ok(unsafe { std::process::Stdio::from_raw_fd(next) })
}

fn set_cloexec(fd: i32) {
    unsafe {
        let flags = libc::fcntl(fd, libc::F_GETFD);
        if flags >= 0 {
            libc::fcntl(fd, libc::F_SETFD, flags | libc::FD_CLOEXEC);
        }
    }
}

fn close_fd(fd: i32) {
    if fd >= 0 {
        unsafe {
            libc::close(fd);
        }
    }
}

fn os_err(ctx: &str) -> String {
    format!("{ctx}: {}", std::io::Error::last_os_error())
}

fn emit_pty_data(app: &AppHandle, id: &str, bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }
    let data = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes);
    let _ = app.emit(
        DATA_EVENT,
        PtyData {
            id: id.to_string(),
            data,
        },
    );
}

fn pty_should_flush(buffered: usize, since: Duration) -> bool {
    buffered >= READ_CHUNK || since >= PTY_COALESCE
}

fn wait_readable(fd: i32, timeout: Duration) -> bool {
    if timeout.is_zero() {
        return false;
    }
    let mut pollfd = libc::pollfd {
        fd,
        events: libc::POLLIN,
        revents: 0,
    };
    let ms = timeout.as_millis().min(i32::MAX as u128) as i32;
    unsafe { libc::poll(&mut pollfd, 1, ms) > 0 }
}

fn foreground_label(master_fd: i32, shell_pid: u32) -> Option<String> {
    // The sandbox pty only ever sees the flatpak-spawn proxy: the real
    // foreground process runs on the host in another pid namespace, so
    // there is nothing meaningful to label. Degraded, documented in
    // docs/flathub.md.
    if crate::host::in_flatpak() {
        return None;
    }
    let mut pgrp: libc::pid_t = 0;
    if unsafe { libc::ioctl(master_fd, libc::TIOCGPGRP, &mut pgrp) } != 0 {
        return None;
    }
    let pid = pgrp;
    // An idle terminal is the common case and it is polled once a second per
    // pane, so bail before process_label forks a `ps`.
    if pid <= 0 || pid == shell_pid as i32 {
        return None;
    }
    let label = process_label(pid)?;
    if is_shell_name(&label) {
        return None;
    }
    Some(label)
}

fn process_label(pid: i32) -> Option<String> {
    use std::process::Command;
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "args="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let args = raw.trim();
    if args.is_empty() {
        return None;
    }
    command_label(args)
}

fn command_label(args: &str) -> Option<String> {
    let parts: Vec<&str> = args.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }
    let exe = parts[0];
    let base = std::path::Path::new(exe)
        .file_name()
        .and_then(|name| name.to_str())?;
    if is_interpreter(base) {
        for part in parts.iter().skip(1) {
            if part.starts_with('-') {
                continue;
            }
            let name = std::path::Path::new(part)
                .file_name()
                .and_then(|name| name.to_str())?;
            if !name.starts_with('-') {
                return Some(name.to_string());
            }
        }
    }
    Some(base.to_string())
}

fn is_interpreter(name: &str) -> bool {
    matches!(
        name,
        "node" | "nodejs" | "python" | "python3" | "ruby" | "deno" | "bun"
    )
}

fn is_shell_name(name: &str) -> bool {
    matches!(
        name,
        "zsh" | "bash" | "sh" | "fish" | "nu" | "dash" | "ksh" | "tcsh" | "zsh5"
    )
}

#[cfg(test)]
mod label_tests {
    use super::*;

    #[test]
    fn command_label_prefers_cli_over_interpreter() {
        assert_eq!(
            command_label("node /usr/local/bin/npm run build"),
            Some("npm".into())
        );
        assert_eq!(command_label("cargo build"), Some("cargo".into()));
    }

    #[test]
    fn shell_names_are_ignored() {
        assert!(is_shell_name("zsh"));
        assert!(!is_shell_name("npm"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_args_for_common_shells() {
        assert_eq!(login_args("/bin/zsh"), &["-l"]);
        assert_eq!(login_args("/bin/bash"), &["-l"]);
        assert_eq!(login_args("/usr/bin/fish"), &["-l"]);
        assert_eq!(login_args("/usr/local/bin/nu"), &[] as &[&str]);
    }

    #[test]
    fn pty_flush_waits_for_a_full_chunk_or_the_coalesce_window() {
        assert!(!pty_should_flush(1, Duration::from_millis(1)));
        assert!(pty_should_flush(READ_CHUNK, Duration::from_millis(1)));
        assert!(pty_should_flush(1, PTY_COALESCE));
    }

    #[test]
    fn remove_if_pid_ignores_a_replaced_session() {
        let host = PtyHost::new();
        host.insert(
            "term".into(),
            Arc::new(LivePty {
                cwd: std::path::PathBuf::from("/test"),
                writer: Mutex::new(Box::new(std::io::sink())),
                master_fd: -1,
                pid: 42,
            }),
        );
        assert!(host.remove_if_pid("term", 7).is_none());
        assert!(host.get("term").is_some());
        assert!(host.remove_if_pid("term", 42).is_some());
        assert!(host.get("term").is_none());
    }
}
