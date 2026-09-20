//! Host-execution bridge for sandboxed (Flatpak) environments.
//!
//! MonoCode spawns the user's login shell, provider CLIs (`claude`, `codex`,
//! `opencode`, …) and `git` throughout the backend. Inside a Flatpak sandbox
//! those binaries live on the host, so every spawn must go through
//! `flatpak-spawn --host` (allowed via `--talk-name=org.freedesktop.Flatpak`).
//!
//! Outside the sandbox these helpers behave exactly like the `std::process`
//! calls they replace, so native `.deb`/AppImage builds are unaffected.

use std::process::Command;

/// True when running inside a Flatpak sandbox.
///
/// `/.flatpak-info` is the canonical marker; `FLATPAK_ID` is set by Flatpak
/// itself, and `MONOCODE_FLATPAK` is an escape hatch for testing and for
/// Flatpak wrappers that want to force host-routing explicitly.
pub(crate) fn in_flatpak() -> bool {
    if std::env::var_os("MONOCODE_FLATPAK").is_some_and(|v| !v.is_empty()) {
        return true;
    }
    if std::env::var_os("FLATPAK_ID").is_some() {
        return true;
    }
    std::path::Path::new("/.flatpak-info").exists()
}

/// Build a `Command` for `program`, routing through `flatpak-spawn --host`
/// when sandboxed. Callers keep chaining `.arg/.args/.env/.current_dir`
/// exactly as before.
pub(crate) fn command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    if in_flatpak() {
        let mut cmd = Command::new("flatpak-spawn");
        cmd.arg("--host").arg(program);
        cmd
    } else {
        Command::new(program)
    }
}

/// Signal a (possibly host-side) process from the sandbox.
///
/// Outside the sandbox this is unused — callers use `libc::kill` directly.
#[cfg(unix)]
pub(crate) fn signal_host(pid: u32, group: bool, sig: &str) {
    if pid <= 1 {
        return;
    }
    let target = if group {
        format!("-{pid}")
    } else {
        pid.to_string()
    };
    let _ = Command::new("flatpak-spawn")
        .args(["--host", "kill", &format!("-{sig}"), &target])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// `kill -0` against a host pid. Only meaningful inside the sandbox.
#[cfg(unix)]
pub(crate) fn host_alive(pid: u32) -> bool {
    if pid <= 1 {
        return false;
    }
    Command::new("flatpak-spawn")
        .args(["--host", "kill", "-0", &pid.to_string()])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Read `/proc/<pid>/environ` of a host process. Used to recover the
/// `MONOCODE_HARNESS_PARENT` marker for orphan reaping; `None` when
/// sandboxed reads fail, in which case callers fall back to argv matching.
#[cfg(target_os = "linux")]
pub(crate) fn read_host_environ(pid: u32) -> Option<Vec<u8>> {
    if pid <= 1 {
        return None;
    }
    let output = Command::new("flatpak-spawn")
        .args(["--host", "cat", &format!("/proc/{pid}/environ")])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() || output.stdout.is_empty() {
        return None;
    }
    Some(output.stdout)
}

/// Full host process list as `(pid, ppid, args)` rows for orphan reaping
/// inside the sandbox, where the sandbox `/proc` cannot see host processes.
#[cfg(target_os = "linux")]
pub(crate) fn host_process_snapshot() -> Vec<(u32, u32, String)> {
    let output = match Command::new("flatpak-spawn")
        .args([
            "--host", "ps", "-eww", "-o", "pid=", "-o", "ppid=", "-o", "args=",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(parse_host_ps_row)
        .collect()
}

/// Parse one `ps -o pid= -o ppid= -o args=` row.
#[cfg(target_os = "linux")]
fn parse_host_ps_row(line: &str) -> Option<(u32, u32, String)> {
    let mut parts = line.split_whitespace();
    let pid: u32 = parts.next()?.parse().ok()?;
    let ppid: u32 = parts.next()?.parse().ok()?;
    let args: String = parts.collect::<Vec<_>>().join(" ");
    if args.is_empty() {
        return None;
    }
    Some((pid, ppid, args))
}

/// Frontend probe: lets the web UI hide the in-app updater inside the
/// sandbox (Flathub updates the whole package; a self-updater is forbidden).
#[tauri::command]
pub(crate) fn flatpak_sandboxed() -> bool {
    in_flatpak()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_ps_row_parses_pid_ppid_args() {
        let row = parse_host_ps_row("  1234    56 /home/u/.local/bin/codex --foo");
        assert_eq!(
            row,
            Some((1234, 56, "/home/u/.local/bin/codex --foo".to_string()))
        );
    }

    #[test]
    fn host_ps_row_rejects_header_or_empty_args() {
        assert_eq!(parse_host_ps_row("   PID  PPID COMMAND"), None);
        assert_eq!(parse_host_ps_row("  42    1 "), None);
        assert_eq!(parse_host_ps_row(""), None);
    }

    #[test]
    fn command_passthrough_outside_sandbox() {
        // Tests never run inside Flatpak (and MONOCODE_FLATPAK/FLATPAK_ID are
        // unset here), so this must be a plain spawn of the program itself.
        assert!(!in_flatpak());
        let mut cmd = command("true");
        assert!(cmd.status().map(|s| s.success()).unwrap_or(false));
    }

    #[test]
    fn sandbox_detection_honours_env_override() {
        // SAFETY: tests run single-threaded per binary by default for env
        // mutation safety; restore the previous value afterwards.
        let prev = std::env::var_os("MONOCODE_FLATPAK");
        unsafe {
            std::env::set_var("MONOCODE_FLATPAK", "1");
        }
        assert!(in_flatpak());
        match prev {
            Some(value) => unsafe {
                std::env::set_var("MONOCODE_FLATPAK", value);
            },
            None => unsafe {
                std::env::remove_var("MONOCODE_FLATPAK");
            },
        }
    }
}
