// On-phone transfer notification (zero install).
// Spec: docs/superpowers/specs/2026-11-02-phone-transfer-notification-design.md
// The drawer card is system-drawn chrome; we control title/body only.
// Posts via `cmd notification post`, re-posted at most every MIN_INTERVAL,
// attributed by Android to the host app "Shell" (expected, honest behavior).

use crate::backup::{BackupCategory, ProgressMessage};

pub const TITLE: &str = "Mr. Floppy";
pub const TAG: &str = "mrfloppy";
pub const MIN_INTERVAL_MS: u64 = 2000;

/// Canonical status literals produced by backup.rs and the pause/resume pushes.
pub const STATUS_COMPLETED: &str = "Completed";
pub const STATUS_PAUSED: &str = "Paused";
pub const STATUS_STREAMING: &str = "Streaming";
pub const STATUS_CANCELLED: &str = "Cancelled by user";
pub const STATUS_ADB_MISSING: &str = "ADB binary not found";

/// 10-cell unicode progress bar. filled = pct*10 rounded.
pub fn bar(pct: f32) -> String {
    let filled = (pct.clamp(0.0, 1.0) * 10.0).round() as usize;
    let filled = filled.min(10);
    format!("{}{}", "▰".repeat(filled), "▱".repeat(10 - filled))
}

/// Spinner emoji that cycles as progress advances — gives the drawer card
/// an "animating" feel even though adb can only repost static text.
fn spinner(pct: f32) -> &'static str {
    const FRAMES: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    FRAMES[((pct.clamp(0.0, 1.0) * FRAMES.len() as f32) as usize) % FRAMES.len()]
}

/// 1,234-style group separator.
pub fn comma(n: usize) -> String {
    let s = n.to_string();
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut out = String::new();
    for (i, b) in bytes.iter().enumerate() {
        out.push(*b as char);
        let rem = len - i - 1;
        if rem > 0 && rem % 3 == 0 {
            out.push(',');
        }
    }
    out
}

/// Leaf name only (glance privacy), or the scanning line when unknown.
pub fn file_line(current_file: &Option<String>) -> String {
    match current_file {
        Some(p) => {
            let leaf = p.rsplit('/').next().unwrap_or(p.as_str());
            format!("▸ {}", leaf)
        }
        None => "▸ Scanning storage…".to_string(),
    }
}

/// "Photos+Videos(+…)" label, truncated to 24 chars for drawer width.
pub fn cat_names(cats: &[BackupCategory]) -> String {
    let joined = cats
        .iter()
        .map(|c| match c {
            BackupCategory::Photos => "Photos",
            BackupCategory::Videos => "Videos",
            BackupCategory::Audio => "Audio",
            BackupCategory::Documents => "Documents",
            BackupCategory::Downloads => "Downloads",
            BackupCategory::Contacts  => "Contacts",
            BackupCategory::Apps      => "Apps",
        })
        .collect::<Vec<_>>()
        .join("+");
    if joined.chars().count() > 24 {
        let cut: String = joined.chars().take(23).collect();
        format!("{}…", cut)
    } else {
        joined
    }
}

/// Wrap an argument in single quotes, escaping embedded quotes the sh way.
/// adb joins args and the on-device shell word-splits, so quoting is ours.
pub fn quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// The mono D-body (spec section "The notification").
/// L3 (file counts) only when total is known; L4 (GB) only when bytes flowed.
pub fn body_for(msg: &ProgressMessage, cats_label: &str) -> String {
    let pct = (msg.progress.clamp(0.0, 1.0) * 100.0).round() as i64;
    let spin = spinner(msg.progress);
    let head = if msg.status == STATUS_COMPLETED {
        format!("✓ {}%", pct)
    } else if msg.status == STATUS_PAUSED {
        format!("⏸ {}%", pct)
    } else {
        format!("{} {}% LIVE", spin, pct)
    };
    let mut lines = vec![format!("{} {}", head, bar(msg.progress))];

    if msg.status == STATUS_COMPLETED {
        lines.push("✓ manifest.json — every byte verified".to_string());
    } else if msg.status == STATUS_PAUSED {
        lines.push("□ Holding — say the word on the Mac".to_string());
    } else {
        lines.push(file_line(&msg.current_file));
    }

    if msg.total_files > 0 {
        lines.push(format!(
            "{} of {} files",
            comma(msg.processed_files),
            comma(msg.total_files)
        ));
    }
    if msg.bytes_transferred > 0 {
        let gb = msg.bytes_transferred as f64 / 1e9;
        let tail = if msg.status == STATUS_COMPLETED {
            format!("{:.1} GB · Backup complete", gb)
        } else {
            format!("{:.1} GB · {}", gb, cats_label)
        };
        lines.push(tail);
    }
    lines.join("\n")
}

use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

/// Every action the executor can perform for one progress message.
#[derive(Debug, PartialEq)]
pub enum Action {
    None,
    Post(String),
    Remove,
    PostThenRemove(String, u64), // body + completion epoch for the 5s guard
}

#[derive(Debug)]
pub struct NotifierState {
    pub job_id: u64,
    pub epoch: u64,
    pub last_post: Option<Instant>,
    pub last_status: String,
    pub serial: Option<String>,
    pub supported: Option<bool>, // None = untested this job, Some(false) = denied
    pub completion_epoch: Option<u64>,
}

pub fn new_state() -> NotifierState {
    NotifierState {
        job_id: 0,
        epoch: 0,
        last_post: None,
        last_status: String::new(),
        serial: None,
        supported: None,
        completion_epoch: None,
    }
}

/// Is a post due? Status changes always post; streaming waits out the interval.
pub fn due(last_post: &Option<Instant>, now: Instant, status_changed: bool) -> bool {
    if status_changed {
        return true;
    }
    match last_post {
        None => true,
        Some(t) => now.duration_since(*t) >= Duration::from_millis(MIN_INTERVAL_MS),
    }
}

/// Surface state for change detection: the scanning intro folds into the
/// streaming family so a job start posts once, not twice; every named
/// transition (Paused/Completed/Cancelled/Unavailable) keeps its immediacy.
fn status_family(status: &str) -> &str {
    if status == STATUS_COMPLETED
        || status == STATUS_PAUSED
        || status == STATUS_CANCELLED
        || status == STATUS_ADB_MISSING
    {
        status
    } else {
        STATUS_STREAMING
    }
}

/// Pure decision: given current state + the incoming message, what to do?
/// Mutates state (epoch/throttle/status bookkeeping) as a side effect.
pub fn decide(s: &mut NotifierState, msg: &ProgressMessage, cats_label: &str, now: Instant) -> Action {
    if msg.job_id != s.job_id {
        s.job_id = msg.job_id;
        s.epoch += 1;
        s.last_post = None;
        s.supported = None;
        s.last_status = String::new();
        s.completion_epoch = None;
    }
    let status_changed = status_family(&msg.status) != status_family(&s.last_status);
    let go = due(&s.last_post, now, status_changed);
    s.last_status = msg.status.clone();

    if msg.status == STATUS_CANCELLED
        || msg.status == STATUS_ADB_MISSING
    {
        s.completion_epoch = None;
        s.last_post = Some(now);
        return Action::Remove;
    }
    if !go {
        return Action::None;
    }
    if msg.status == STATUS_COMPLETED {
        s.completion_epoch = Some(s.epoch);
        s.last_post = Some(now);
        let body = body_for(msg, cats_label);
        Action::PostThenRemove(body, s.epoch)
    } else {
        if s.supported == Some(false) {
            Action::None
        } else {
            s.last_post = Some(now);
            let body = body_for(msg, cats_label);
            Action::Post(body)
        }
    }
}

use tauri::Emitter;

static STATE: OnceLock<Mutex<NotifierState>> = OnceLock::new();

fn state() -> &'static Mutex<NotifierState> {
    STATE.get_or_init(|| Mutex::new(new_state()))
}

enum ExecOutcome {
    Ok,
    PostFailed,
}

/// Run one action on the device. Takes (adb, serial) explicitly — it must
/// NEVER lock STATE itself, because `on_progress` already holds that mutex;
/// std Sync Mutex is not re-entrant and would deadlock.
fn execute(adb: &std::path::PathBuf, serial: &str, action: &Action) -> ExecOutcome {
    use std::process::Command;
    match action {
        Action::None => ExecOutcome::Ok,
        Action::Remove => {
            let cmd = format!("cmd notification remove {}", TAG);
            let _ = Command::new(adb).args(["-s", serial, "shell", &cmd]).output();
            ExecOutcome::Ok
        }
        Action::Post(body) | Action::PostThenRemove(body, _) => {
            let cmd = format!(
                "cmd notification post -S bigtext -t '{}' {} {}",
                quote(TITLE),
                TAG,
                quote(body)
            );
            let out = Command::new(adb).args(["-s", serial, "shell", &cmd]).output();
            match out {
                Ok(o) if o.status.success() => {
                    if let Action::PostThenRemove(_, epoch) = action {
                        schedule_removal(*epoch);
                    }
                    ExecOutcome::Ok
                }
                _ => ExecOutcome::PostFailed,
            }
        }
    }
}

/// Clear the farewell card ~5s later, unless a newer epoch took over
/// (new job, cancelled, etc.). Runs in its own thread; harmless if missed.
/// Locks STATE briefly AFTER the 5s sleep — never nested inside on_progress's lock.
fn schedule_removal(epoch: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(5));
        let still_current = {
            let s = state().lock().unwrap();
            s.completion_epoch == Some(epoch)
        };
        if still_current {
            let serial = state().lock().unwrap().serial.clone();
            if let (Some(adb), Some(serial)) = (crate::adb::find_adb_binary(), serial) {
                let _ = execute(&adb, &serial, &Action::Remove);
            }
        }
    });
}

/// First serial among usable devices; resolved fast via get-serialno.
fn resolve_serial(s: &mut NotifierState) {
    if let Some(adb) = crate::adb::find_adb_binary() {
        if let Ok(out) = std::process::Command::new(&adb).arg("get-serialno").output() {
            if out.status.success() {
                let ser = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !ser.is_empty() && ser != "unknown" {
                    s.serial = Some(ser);
                    return;
                }
            }
        }
    }
    let handle = std::thread::spawn(move || crate::adb::list_devices());
    let devices = handle.join().unwrap_or_default();
    s.serial = devices
        .into_iter()
        .find(|d| d.status == crate::adb::DeviceConnectionStatus::Device)
        .map(|d| d.serial);
}

/// The single hook the backup forwarder calls. Non-blocking; dispatches ADB
/// posting to a detached worker thread so data streaming throughput is never affected.
pub fn on_progress(app: &tauri::AppHandle, msg: &ProgressMessage, cats_label: &str) {
    let adb = match crate::adb::find_adb_binary() {
        Some(p) => p,
        None => return,
    };
    let mut s = state().lock().unwrap();
    if s.serial.is_none() {
        resolve_serial(&mut s);
    }
    let serial = match s.serial.clone() {
        Some(x) => x,
        None => return,
    };
    let action = decide(&mut s, msg, cats_label, Instant::now());
    if matches!(action, Action::None) {
        return;
    }
    let first_test = matches!(action, Action::Post(_)) && s.supported.is_none();
    let app_handle = app.clone();
    let msg_clone = msg.clone();

    // Run execution off the critical transfer thread
    std::thread::spawn(move || {
        let failed = matches!(execute(&adb, &serial, &action), ExecOutcome::PostFailed);
        if first_test {
            if let Ok(mut s) = state().lock() {
                s.supported = Some(!failed);
            }
            if failed {
                let _ = app_handle.emit(
                    "backup-progress",
                    &ProgressMessage {
                        job_id: msg_clone.job_id,
                        progress: msg_clone.progress,
                        current_file: msg_clone.current_file.clone(),
                        status: "Phone notifications unavailable on this phone".into(),
                        bytes_transferred: msg_clone.bytes_transferred,
                        total_files: msg_clone.total_files,
                        processed_files: msg_clone.processed_files,
                    },
                );
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(status: &str, progress: f32, file: Option<&str>, bytes: u64, total: usize, done: usize) -> ProgressMessage {
        ProgressMessage {
            job_id: 1,
            progress,
            current_file: file.map(|s| s.to_string()),
            status: status.to_string(),
            bytes_transferred: bytes,
            total_files: total,
            processed_files: done,
        }
    }

    #[test]
    fn bar_rounds_and_clamps() {
        assert_eq!(bar(0.0), "▱▱▱▱▱▱▱▱▱▱");
        assert_eq!(bar(0.43), "▰▰▰▰▱▱▱▱▱▱");
        assert_eq!(bar(0.5), "▰▰▰▰▰▱▱▱▱▱");
        assert_eq!(bar(0.47), "▰▰▰▰▰▱▱▱▱▱");
        assert_eq!(bar(1.0), "▰▰▰▰▰▰▰▰▰▰");
        assert_eq!(bar(1.7), "▰▰▰▰▰▰▰▰▰▰");
    }

    #[test]
    fn comma_groups() {
        assert_eq!(comma(13), "13");
        assert_eq!(comma(2132), "2,132");
        assert_eq!(comma(4900), "4,900");
        assert_eq!(comma(1234567), "1,234,567");
    }

    #[test]
    fn file_line_leaf_only_and_scanning() {
        assert_eq!(
            file_line(&Some("/sdcard/DCIM/IMG_20260114_0912.jpg".to_string())),
            "▸ IMG_20260114_0912.jpg"
        );
        assert_eq!(file_line(&None), "▸ Scanning storage…");
    }

    #[test]
    fn cat_names_join_and_truncate() {
        assert_eq!(cat_names(&[BackupCategory::Photos]), "Photos");
        assert_eq!(
            cat_names(&[BackupCategory::Photos, BackupCategory::Videos]),
            "Photos+Videos"
        );
        let all = cat_names(&[
            BackupCategory::Photos,
            BackupCategory::Videos,
            BackupCategory::Audio,
            BackupCategory::Documents,
            BackupCategory::Downloads,
            BackupCategory::Contacts,
            BackupCategory::Apps,
        ]);
        assert_eq!(all.chars().count(), 24);
        assert!(all.ends_with('…'));
    }

    #[test]
    fn quote_escapes_single_quotes() {
        assert_eq!(quote("ab.txt"), "'ab.txt'");
        assert_eq!(quote("ab'c.txt"), "'ab'\\''c.txt'");
        assert_eq!(quote("it's 50% done"), "'it'\\''s 50% done'");
    }

    #[test]
    fn body_streaming_with_all_lines() {
        let b = body_for(&msg("Streaming", 0.43, Some("/sdcard/DCIM/IMG_20260114_0912.jpg"), 18_600_000_000, 4900, 2132), "Photos");
        assert_eq!(
            b,
            "⠼ 43% LIVE ▰▰▰▰▱▱▱▱▱▱\n▸ IMG_20260114_0912.jpg\n2,132 of 4,900 files\n18.6 GB · Photos"
        );
    }

    #[test]
    fn body_scanning_is_two_lines() {
        let b = body_for(&msg("Scanning storage tree…", 0.0, None, 0, 0, 0), "Photos");
        assert_eq!(b, "⠋ 0% LIVE ▱▱▱▱▱▱▱▱▱▱\n▸ Scanning storage…");
    }

    #[test]
    fn body_paused_omits_gb_and_keeps_counts() {
        let b = body_for(&msg("Paused", 0.43, None, 0, 4900, 2132), "Photos+Videos");
        assert_eq!(
            b,
            "⏸ 43% ▰▰▰▰▱▱▱▱▱▱\n□ Holding — say the word on the Mac\n2,132 of 4,900 files"
        );
    }

    #[test]
    fn body_completed_full_farewell() {
        let b = body_for(&msg("Completed", 1.0, None, 42_100_000_000, 4900, 4900), "Photos");
        assert_eq!(
            b,
            "✓ 100% ▰▰▰▰▰▰▰▰▰▰\n✓ manifest.json — every byte verified\n4,900 of 4,900 files\n42.1 GB · Backup complete"
        );
    }

    #[test]
    fn bar_low_side_clamps() {
        assert_eq!(bar(-0.04), "▱▱▱▱▱▱▱▱▱▱");
        assert_eq!(bar(-0.06), "▱▱▱▱▱▱▱▱▱▱");
    }

    #[test]
    fn spinner_cycles() {
        assert_eq!(spinner(0.0), "⠋");
        assert_eq!(spinner(0.1), "⠙");
        assert_eq!(spinner(0.5), "⠴");
        assert_eq!(spinner(0.9), "⠏");
    }

    #[test]
    fn comma_zero() {
        assert_eq!(comma(0), "0");
    }

    mod plug {
        use super::super::*;

        #[test]
        fn due_logic() {
            let t0 = Instant::now();
            assert!(due(&None, t0, false), "never posted → due");
            assert!(due(&Some(t0), t0, true), "status change → always due");
            let almost = t0 + std::time::Duration::from_millis(MIN_INTERVAL_MS - 1);
            assert!(!due(&Some(t0), almost, false), "inside throttle → not due");
            let ready = t0 + std::time::Duration::from_millis(MIN_INTERVAL_MS);
            assert!(due(&Some(t0), ready, false), "2s elapsed → due");
        }

        #[test]
        fn decide_streams_pause_complete_cancel() {
            let t0 = Instant::now();
            let mut s = new_state();

            // First message of a job: reset + immediate post (Scanning)
            let a = decide(&mut s, &msg2("Scanning storage tree…", None, 0, 0, 0, 11), "Photos", t0);
            assert!(matches!(a, Action::Post(_)), "first post is immediate");
            assert!(s.epoch != 0, "new job bumps epoch");

            // Streaming 1ms later (same status) inside throttle → skip
            s.last_post = Some(t0);
            let a = decide(&mut s, &msg2("Streaming", Some("/sdcard/DCIM/x.jpg"), 1, 10, 0, 11), "Photos", t0 + std::time::Duration::from_millis(1));
            assert!(matches!(a, Action::None), "streaming respects 2s throttle");

            // Paused is a status change → immediate
            let a = decide(&mut s, &msg2("Paused", None, 0, 10, 3, 11), "Photos", t0 + std::time::Duration::from_millis(50));
            assert!(matches!(a, Action::Post(_)), "pause is immediate");

            // Cancelled → remove immediately (even inside throttle)
            let a = decide(&mut s, &msg2("Cancelled by user", None, 0, 10, 3, 11), "Photos", t0 + std::time::Duration::from_millis(100));
            assert!(matches!(a, Action::Remove), "cancel removes immediately");

            // Completed → post farewell, then guarded removal
            let t1 = t0 + std::time::Duration::from_millis(MIN_INTERVAL_MS);
            let a = decide(&mut s, &msg2("Streaming", Some("y.jpg"), 1, 10, 4, 11), "Photos", t1);
            assert!(matches!(a, Action::Post(_)));
            let t2 = t1 + std::time::Duration::from_millis(MIN_INTERVAL_MS);
            let a = decide(&mut s, &msg2("Completed", None, 42_000_000_000, 10, 10, 11), "Photos", t2);
            assert!(matches!(a, Action::PostThenRemove(_, _)), "completion posts farewell");
        }

        #[test]
        fn decide_new_job_resets_availability_and_throttle() {
            let t0 = Instant::now();
            let mut s = new_state();
            decide(&mut s, &msg2("Streaming", None, 1, 10, 0, 21), "Photos", t0);
            s.last_post = Some(t0);
            s.supported = Some(false); // simulate job-1 denial
            let soon = t0 + std::time::Duration::from_millis(10);
            let a = decide(&mut s, &msg2("Streaming", None, 1, 10, 0, 99), "Photos", soon); // new job id
            assert!(matches!(a, Action::Post(_)), "new job retries availability + skips throttle");
            assert!(s.supported.is_none(), "availability resets per job");
        }

        pub fn msg2(status: &str, file: Option<&str>, bytes: u64, total: usize, done: usize, job: u64) -> ProgressMessage {
            ProgressMessage {
                job_id: job,
                progress: 0.43,
                current_file: file.map(|s| s.to_string()),
                status: status.to_string(),
                bytes_transferred: bytes,
                total_files: total,
                processed_files: done,
            }
        }
    }
}
