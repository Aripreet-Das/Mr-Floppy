# Phone Transfer Notification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a backup streams, the phone's notification drawer shows a live silent card ("Mr. Floppy" — percent + unicode bar + current file + counts + GB) re-posted every 2s and cleared on any job end — zero installs on the phone.

**Architecture:** New Rust module `phone_notifier.rs` owns a global state machine (serial cache, 2s throttle, availability, completion epoch). The existing progress forwarder task in `backup.rs` gains a single hook call; `pause_backup`/`resume_backup` push one `ProgressMessage` each through the existing `progress_tx` so the drawer reflects pause truthfully. All adb posts are one-process `cmd notification post` commands.

**Tech Stack:** Rust (std only — no new crates), Tauri 2 command/event plumbing, existing `adb.rs`.

**Environment notes:**
- No git repository in this project — commit steps are replaced by "verification checkpoint" steps (cargo test/check must pass before moving on).
- Cargo lives in `~/.cargo/bin`; prefix commands: `PATH=$HOME/.cargo/bin:$PATH cargo …` (run from `src-tauri/`).
- Spec: `docs/superpowers/specs/2026-11-02-phone-transfer-notification-design.md`; Sketch winner: D (`docs/../.planning/sketches/001-phone-notification/`).
- Verified facts you can rely on: `adb::find_adb_binary() -> Option<PathBuf>` is public (adb.rs:33); `DeviceInfo { pub serial: String, pub status: DeviceConnectionStatus, … }` (adb.rs:14-24); `DeviceConnectionStatus::Device` is the "usable" state (adb.rs:5-11); `backup.rs` forwarder at lines 200-206; pause/resume commands at 436-453; `BackupJobState` derives `Default` (line 72-81).
- Do NOT modify the streaming loop, checksum, or manifest logic.

---

## File Map

- Create `src-tauri/src/phone_notifier.rs` — formatter, throttle, adb executor, state machine (all of it; single responsibility module is small enough to stay whole)
- Modify `src-tauri/src/backup.rs` — `BackupJobState` gains `total_files`/`processed_files`; forwarder hook; pause/resume one-message pushes (find_adb stays as-is; we use `adb::find_adb_binary`)
- Modify `src-tauri/src/lib.rs` — `mod phone_notifier;`
- Tests live inline in `phone_notifier.rs` (`#[cfg(test)]`), matching the existing test convention in `adb.rs`.

---

### Task 1: Formatter — pure functions with tests (TDD)

**Files:**
- Create: `src-tauri/src/phone_notifier.rs`

- [ ] **Step 1: Write the module skeleton with failing tests**

Create `src-tauri/src/phone_notifier.rs` with exactly this content:

```rust
// On-phone transfer notification (zero install).
// Spec: docs/superpowers/specs/2026-11-02-phone-transfer-notification-design.md
// The drawer card is system-drawn chrome; we control title/body only.
// Posts via `cmd notification post`, re-posted at most every MIN_INTERVAL,
// attributed by Android to the host app "Shell" (expected, honest behavior).

use crate::backup::{BackupCategory, ProgressMessage};

pub const TITLE: &str = "Mr. Floppy";
pub const TAG: &str = "mrfloppy";
pub const MIN_INTERVAL_MS: u64 = 2000;

/// 10-cell unicode progress bar. filled = pct*10 rounded.
pub fn bar(pct: f32) -> String {
    let filled = (pct.clamp(0.0, 1.0) * 10.0).round() as usize;
    let filled = filled.min(10);
    format!("{}{}", "▰".repeat(filled), "▱".repeat(10 - filled))
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
    let head = match msg.status.as_str() {
        "Completed" => format!("✓ {}%", pct),
        "Paused" => format!("⏸ {}%", pct),
        _ => format!("{}%", pct),
    };
    let mut lines = vec![format!("{} {}", head, bar(msg.progress))];

    match msg.status.as_str() {
        "Completed" => lines.push("✓ manifest.json — every byte verified".to_string()),
        "Paused" => lines.push("□ Holding — say the word on the Mac".to_string()),
        _ => lines.push(file_line(&msg.current_file)),
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
        let tail = if msg.status == "Completed" {
            format!("{:.1} GB · Backup complete", gb)
        } else {
            format!("{:.1} GB · {}", gb, cats_label)
        };
        lines.push(tail);
    }
    lines.join("\n")
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
            "43% ▰▰▰▰▱▱▱▱▱▱\n▸ IMG_20260114_0912.jpg\n2,132 of 4,900 files\n18.6 GB · Photos"
        );
    }

    #[test]
    fn body_scanning_is_two_lines() {
        let b = body_for(&msg("Scanning storage tree…", 0.0, None, 0, 0, 0), "Photos");
        assert_eq!(b, "0% ▰▱▱▱▱▱▱▱▱▱\n▸ Scanning storage…");
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
}
```

Wait — with no `BackupCategory` import use yet: `cat_names` uses it, so the `use` line is correct as written.

- [ ] **Step 2: Export the module before tests can compile**

Edit `src-tauri/src/lib.rs` line 3 area — after `mod backup;` add:

```rust
mod phone_notifier;
```

- [ ] **Step 3: Run the tests — expect compile success + all pass**

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo test phone_notifier
```

Expected: `test result: ok. 9 passed; 0 failed` (all formatter tests green — this task is pure functions; TDD failure stage is impossible without a compiling module, so the compile IS the red→green gate here).

---

### Task 2: Throttle + decision machine — pure state transitions with tests (TDD)

**Files:**
- Modify: `src-tauri/src/phone_notifier.rs` (append)

- [ ] **Step 1: Add failing tests for `due` and `decide`**

Append to `src-tauri/src/phone_notifier.rs` (inside the existing `mod tests`):

```rust
    mod plug {
        use super::super::*;
        use std::time::Instant;

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
            let m = |status: &str, file: Option<&str>, bytes: u64, total: usize, done: usize, job: u64| {
                msg2(status, file, bytes, total, done, job)
            };

            // First message of a job: reset + immediate post
            let a = decide(&mut s, &m("Scanning storage tree…", None, 0, 0, 0, 11), "Photos", t0);
            assert!(matches!(a, Action::Post(_)), "first post is immediate");
            assert!(s.epoch != 0, "new job bumps epoch");

            // Simulate the post having just happened
            s.last_post = Some(t0);
            // Streaming 1ms later inside throttle → skip
            let a = decide(&mut s, &m("Streaming", Some("/sdcard/DCIM/x.jpg"), 1, 10, 0, 11), "Photos", t0 + std::time::Duration::from_millis(1));
            assert!(matches!(a, Action::None), "streaming respects 2s throttle");

            // Paused is a status change → immediate
            let a = decide(&mut s, &m("Paused", None, 0, 10, 3, 11), "Photos", t0 + std::time::Duration::from_millis(50));
            assert!(matches!(a, Action::Post(_)), "pause is immediate");

            // Cancelled → remove immediately (even inside throttle)
            let a = decide(&mut s, &m("Cancelled by user", None, 0, 10, 3, 11), "Photos", t0 + std::time::Duration::from_millis(100));
            assert!(matches!(a, Action::Remove), "cancel removes immediately");

            // Completed → post farewell, then guarded removal
            let t1 = t0 + std::time::Duration::from_millis(MIN_INTERVAL_MS);
            let a = decide(&mut s, &m("Streaming", Some("y.jpg"), 1, 10, 4, 11), "Photos", t1);
            assert!(matches!(a, Action::Post(_)));
            let t2 = t1 + std::time::Duration::from_millis(MIN_INTERVAL_MS);
            let a = decide(&mut s, &m("Completed", None, 42_000_000_000, 10, 10, 11), "Photos", t2);
            assert!(matches!(a, Action::PostThenRemove(_, _)), "completion posts farewell");
        }

        #[test]
        fn decide_new_job_resets_availability_and_throttle() {
            let t0 = Instant::now();
            let mut s = new_state();
            let m = |status: &str, job: u64| msg2(status, None, 1, 10, 0, job);
            decide(&mut s, &m("Streaming", 21), "Photos", t0);
            s.last_post = Some(t0);
            s.supported = Some(false); // simulate job-1 denial
            let soon = t0 + std::time::Duration::from_millis(10);
            let a = decide(&mut s, &m("Streaming", 99), "Photos", soon); // new job id
            assert!(matches!(a, Action::Post(_)), "new job retries availability + skips throttle");
            assert!(s.supported.is_none(), "availability resets per job");
        }

        // helpers shared by plug-tests
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
```

- [ ] **Step 2: Run — expect FAIL (functions not defined)**

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo test phone_notifier 2>&1 | tail -20
```

Expected: compile errors `cannot find function 'due'`, `cannot find struct 'NotifierState'` etc.

- [ ] **Step 3: Implement `due`, `NotifierState`, `Action`, `decide`, `new_state`**

Append to `src-tauri/src/phone_notifier.rs` (above `#[cfg(test)]` section):

```rust
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::sync::OnceLock;

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
    let status_changed = msg.status != s.last_status;
    let go = due(&s.last_post, now, status_changed);
    s.last_status = msg.status.clone();

    if msg.status == "Cancelled by user"
        || msg.status == "ADB binary not found"
    {
        s.completion_epoch = None;
        s.last_post = Some(now);
        return Action::Remove;
    }
    if !go {
        return Action::None;
    }
    match msg.status.as_str() {
        "Completed" => {
            s.completion_epoch = Some(s.epoch);
            s.last_post = Some(now);
            let body = body_for(msg, cats_label);
            Action::PostThenRemove(body, s.epoch)
        }
        _ => {
            if s.supported == Some(false) {
                Action::None
            } else {
                s.last_post = Some(now);
                let body = body_for(msg, cats_label);
                Action::Post(body)
            }
        }
    }
}
```

(`decide` advances `last_post` itself — the executor never touches throttle state. The Task-2 tests' manual `s.last_post = Some(t0)` lines remain valid: they re-assign the value `decide` already wrote, which is idempotent and keeps the tests self-explanatory.)

- [ ] **Step 4: Run — all pass**

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo test phone_notifier 2>&1 | tail -20
```

Expected: all tests pass including the new `due_logic`, `decide_streams_pause_complete_cancel`, `decide_new_job_resets_availability_and_throttle`.

---

### Task 3: Executor — adb post/remove, completion guard, availability emission

**Files:**
- Modify: `src-tauri/src/phone_notifier.rs` (append)

- [ ] **Step 1: Implement the runtime layer (no unit tests — process boundary; verified by build + live UAT)**

Append (above `#[cfg(test)]`):

```rust
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
/// NEVER lock STATE itself, because the caller (on_progress) already holds
/// that mutex; std Sync Mutex is not re-entrant and would deadlock.
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
/// Locks STATE brieflv AFTER the 5s sleep — never nested inside on_progress's lock.
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

/// First serial among usable devices; cached for the whole app run.
/// Runs on a worker thread and joins it: one-time cost (~6 getprop adb calls),
/// NOT called per post. It does NOT touch STATE's lock itself — on_progress
/// holds it while calling this.
fn resolve_serial(s: &mut NotifierState) {
    let handle = std::thread::spawn(move || crate::adb::list_devices());
    let devices = handle.join().unwrap_or_default();
    s.serial = devices
        .into_iter()
        .find(|d| d.status == crate::adb::DeviceConnectionStatus::Device)
        .map(|d| d.serial);
}

/// The single hook the backup forwarder calls. Never panics; holds the
/// STATE mutex across one throttled adb call (fine: single forwarder task,
/// and execute() never re-locks, so no deadlock).
pub fn on_progress(app: &tauri::AppHandle, msg: &ProgressMessage, cats_label: &str) {
    // One-time adb I/O to resolve the serial; keep it off the async worker.
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
    // First Post of a job is the ColorOS viability test.
    let first_test = matches!(action, Action::Post(_)) && s.supported.is_none();
    let failed = matches!(execute(&adb, &serial, &action), ExecOutcome::PostFailed);
    if first_test {
        s.supported = Some(!failed);
        if failed {
            // Same progress values so the desktop bar/state stay untouched;
            // the Activity log picks this up as a [STATUS] line.
            let _ = app.emit(
                "backup-progress",
                &ProgressMessage {
                    job_id: msg.job_id,
                    progress: msg.progress,
                    current_file: msg.current_file.clone(),
                            status: "Phone notifications unavailable on this phone".into(),
                    bytes_transferred: msg.bytes_transferred,
                    total_files: msg.total_files,
                    processed_files: msg.processed_files,
                },
            );
        }
    }
}
```

- [ ] **Step 2: Verify build**

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo check 2>&1 | tail -10
```

Expected: `Finished` (no errors). Warnings are acceptable until Task 4 wires `on_progress` (which then makes the executor reachable from lib).

---

### Task 4: Wire the backup engine — one hook, two pushes, two bookkeeping fields

**Files:**
- Modify: `src-tauri/src/backup.rs:73-81` (`BackupJobState` fields), `:235-249` (total after scan), `:200-206` (forwarder hook), `:174-181` (cats_label), `:436-463` (pause/resume pushes)

- [ ] **Step 1: Extend `BackupJobState` with count bookkeeping**

Replace lines 72-81:

```rust
#[derive(Debug, Default)]
pub struct BackupJobState {
    pub id: u64,
    pub categories: Vec<BackupCategory>,
    pub manifest: Manifest,
    pub is_paused: bool,
    pub is_canceled: bool,
    pub progress: f32,
    pub progress_tx: Option<UnboundedSender<ProgressMessage>>,
    pub total_files: usize,
    pub processed_files: usize,
}
```

- [ ] **Step 2: Store totals after the scan finishes**

After the line `let total = files.len();` (backup.rs:235), insert:

```rust
    {
        let mut s = job_state.lock().unwrap();
        s.total_files = total;
    }
```

- [ ] **Step 3: Update processed count as files complete**

Inside the manifest-push block (backup.rs:347-361), after `done += 1;` add:

```rust
            s.processed_files = done;
```

- [ ] **Step 4: Compute the category label + hook the forwarder**

Replace the block at backup.rs:200-206:

```rust
    // Forward messages from channel to Tauri front-end
    let app_handle = app.clone();
    let cats_label = phone_notifier::cat_names(&categories);
    task::spawn(async move {
        while let Some(msg) = rx.recv().await {
            phone_notifier::on_progress(&app_handle, &msg, &cats_label);
            let _ = app_handle.emit("backup-progress", &msg);
        }
    });
```

(`categories` binding at line 180 is already established before this block; `cats_label` is consumed by the move, nothing later uses that binding.)

- [ ] **Step 5: Truthful pause/resume notifications**

Replace the whole `pause_backup` command (backup.rs:435-443):

```rust
#[tauri::command]
pub fn pause_backup() -> Result<(), String> {
    let holder = get_active_job_holder().lock().unwrap();
    if let Some(shared) = &*holder {
        let mut s = shared.lock().unwrap();
        s.is_paused = true;
        let msg = ProgressMessage {
            job_id: s.id,
            progress: s.progress,
            current_file: None,
            status: "Paused".into(),
            bytes_transferred: 0,
            total_files: s.total_files,
            processed_files: s.processed_files,
        };
        if let Some(tx) = &s.progress_tx {
            let _ = tx.send(msg);
        }
    }
    Ok(())
}
```

Replace the whole `resume_backup` command (backup.rs:445-453):

```rust
#[tauri::command]
pub fn resume_backup() -> Result<(), String> {
    let holder = get_active_job_holder().lock().unwrap();
    if let Some(shared) = &*holder {
        let mut s = shared.lock().unwrap();
        s.is_paused = false;
        let msg = ProgressMessage {
            job_id: s.id,
            progress: s.progress,
            current_file: None,
            status: "Streaming".into(),
            bytes_transferred: 0,
            total_files: s.total_files,
            processed_files: s.processed_files,
        };
        if let Some(tx) = &s.progress_tx {
            let _ = tx.send(msg);
        }
    }
    Ok(())
}
```

(`cancel_backup` needs no change — its "Cancelled by user" message already flows through the channel into `decide`'s Remove arm.)

- [ ] **Step 6: Verify the whole crate**

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo test 2>&1 | tail -25
```

Expected: all tests pass (phone_notifier + existing adb tests). Then:

```
workdir: src-tauri
command: PATH=$HOME/.cargo/bin:$PATH cargo check 2>&1 | tail -5
```

Expected: `Finished` with no errors.

**Verification checkpoint (replaces commit):** `cargo test` + `cargo check` green.

---

### Task 5: Build, smoke-run, live UAT script

**Files:** none changed.

- [ ] **Step 1: Confirm tauri dev still boots after the Rust change**

```
workdir: /Users/aripreetdas/Documents/MorningTea/Mobile Data Project
command: ls -la src-tauri/target/debug/ | head -3
```

If the running `tauri dev` process (check: `pgrep -fl tauri`) auto-reloaded, verify in the desktop app that a backup still runs (engine untouched, so smoke = existing behavior intact).

- [ ] **Step 2: Live UAT (requires the phone plugged in with ADB authorized — currently unplugged; verify with `adb devices` first)**

```
workdir: /Users/aripreetdas/Documents/MorningTea/Mobile Data Project
command: /opt/homebrew/bin/adb devices
```

Expected: exactly one line `<serial>\tdevice`. If empty → stop, ask user to replug.

Manual test script, run against a real backup started from the desktop app:

1. Start backup → within ~2s the drawer shows the card: titled "Mr. Floppy", 4-line mono body ticking at most every 2s. (If absent → check the Activity log for "Phone notifications unavailable on this phone" → ColorOS denial documented, feature degrades per spec.)
2. Pause on the Mac → drawer shows `⏸ … Holding — say the word on the Mac` within ~2s.
3. Resume → streaming lines resume.
4. Completion → `✓ 100% … every byte verified` shows once, card auto-clears after ~5s.
5. Cancel → card clears within ~2s.

- [ ] **Step 3: Console cross-check of the exact command shape (optional, safe pre-check)**

```
workdir: /Users/aripreetdas/Documents/MorningTea/Mobile Data Project
command: /opt/homebrew/bin/adb -s $( /opt/homebrew/bin/adb devices | awk '/\tdevice/{print $1}' ) shell cmd notification post -S bigtext -t 'Mr. Floppy' mrfloppy '42% ▰▰▰▰▱▱▱▱▱▱
▸ SYSTEMTEST.jpg
3 of 8 files
0.1 GB · Photos'; sleep 5; /opt/homebrew/bin/adb -s $( /opt/homebrew/bin/adb devices | awk '/\tdevice/{print $1}' ) shell cmd notification remove mrfloppy
```

Expected: a card appears then disappears after 5s — proves ColorOS honors shell posts (the go/no-go gate from the spec).

---

## Self-Review

**1. Spec coverage:** objective card ✓ (Task 1 body_for, Task 3 executor); state table incl. pause truth + 5s farewell + immediate cancel ✓ (Tasks 2-4); throttle 2s + immediate transitions ✓ (`due`); serial pinning + once-per-run cache ✓ (Task 3 `resolve_serial`); degradation line + once-per-job retry ✓ (Task 3 first_test logic, Task 2 reset test); one-shell-string quoting ✓ (Task 1 `quote`); glance privacy (leaf name) ✓ (Task 1 `file_line`); UAT option ✓ (Task 5). No gaps.

**2. Placeholder scan:** none — every code step is complete; every run command has expected output.

**3. Type consistency:** `ProgressMessage` fields used in helpers match backup.rs:62-70 ✓; `Action`/`ExecOutcome`/`decide`/`due` signatures consistent across Tasks 2→3 ✓; `BackupCategory` variants match backup.rs:27-33 ✓; `DeviceConnectionStatus::Device` confirmed in adb.rs ✓. Fixed during writing: `execute` takes `(adb, serial)` and never locks `STATE` (deadlock-free under `on_progress`'s held mutex); `decide` advances `last_post` itself; first-post success marks `supported = Some(true)`.
