// Backup Engine – Phase 3 implementation
// ------------------------------------------------------------
// Provides core backup functionality for Mr. Floppy:
//   • Estimate required disk space per category & query host free space
//   • Stream files from Android via ADB exec-out cat, compute SHA-256 checksums
//   • Generate a persistent manifest.json
//   • Pause / resume / cancel active backup job
//   • Emit real-time progress events to the Tauri front-end
// Only accesses user-accessible shared storage. Never modifies source files.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex, OnceLock};
use std::fs::{self, File, OpenOptions};
use std::io::{Write, Read, BufReader};
use std::time::Instant;
use serde::{Serialize, Deserialize};
use tauri::Emitter;
use sha2::{Sha256, Digest};
use crate::phone_notifier;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum BackupCategory {
    Photos,
    Videos,
    Audio,
    Documents,
    Downloads,
    Contacts,
    Apps,
}

impl BackupCategory {
    pub fn root_path(&self) -> &'static str {
        match self {
            BackupCategory::Photos    => "/sdcard/DCIM",
            BackupCategory::Videos    => "/sdcard/Movies",
            BackupCategory::Audio     => "/sdcard/Music",
            BackupCategory::Documents => "/sdcard/Documents",
            BackupCategory::Downloads => "/sdcard/Download",
            BackupCategory::Contacts  => "/sdcard/Android/contacts",
            BackupCategory::Apps      => "/data/app",
        }
    }

    /// Content-provider URI for categories that aren't plain files.
    pub fn content_uri(&self) -> Option<&'static str> {
        match self {
            BackupCategory::Contacts => Some("content://com.android.contacts/contacts"),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ManifestEntry {
    pub relative_path: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub modified_ts: u64,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Manifest {
    pub entries: Vec<ManifestEntry>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProgressMessage {
    pub job_id: u64,
    pub progress: f32,
    pub current_file: Option<String>,
    pub status: String,
    pub bytes_transferred: u64,
    pub total_files: usize,
    pub processed_files: usize,
}

#[derive(Debug, Default)]
pub struct BackupJobState {
    pub id: u64,
    pub categories: Vec<BackupCategory>,
    pub manifest: Manifest,
    pub is_paused: bool,
    pub is_canceled: bool,
    pub progress: f32,
    pub total_files: usize,
    pub processed_files: usize,
    pub total_bytes_transferred: u64,
}

type SharedJob = Arc<Mutex<BackupJobState>>;

static ACTIVE_JOB: OnceLock<Mutex<Option<SharedJob>>> = OnceLock::new();

fn get_active_job_holder() -> &'static Mutex<Option<SharedJob>> {
    ACTIVE_JOB.get_or_init(|| Mutex::new(None))
}

// ---------------------------------------------------------------------------
// ADB helper
// ---------------------------------------------------------------------------
fn find_adb() -> Option<PathBuf> {
    for p in &["/opt/homebrew/bin/adb", "/usr/local/bin/adb"] {
        let pb = PathBuf::from(p);
        if pb.exists() { return Some(pb); }
    }
    if let Ok(android_home) = std::env::var("ANDROID_HOME") {
        let p = PathBuf::from(android_home).join("platform-tools").join("adb");
        if p.exists() { return Some(p); }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join("Library/Android/sdk/platform-tools/adb");
        if p.exists() { return Some(p); }
    }
    if let Ok(out) = Command::new("which").arg("adb").output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let pb = PathBuf::from(&s);
            if pb.exists() { return Some(pb); }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Estimate disk space & query host Mac free space
// ---------------------------------------------------------------------------
#[tauri::command]
pub async fn estimate_backup_size(selected_categories: Vec<String>) -> Result<(u64, u64), String> {
    let adb = find_adb().ok_or_else(|| "ADB binary not found".to_string())?;
    let mut total_needed: u64 = 0;

    for cat in &selected_categories {
        let cat_enum = match cat.to_lowercase().as_str() {
            "photos"    => BackupCategory::Photos,
            "videos"    => BackupCategory::Videos,
            "audio"     => BackupCategory::Audio,
            "documents" => BackupCategory::Documents,
            "downloads" => BackupCategory::Downloads,
            "contacts"  => BackupCategory::Contacts,
            "apps"      => BackupCategory::Apps,
            _ => continue,
        };
        let out = Command::new(&adb)
            .args(["shell", "du", "-k", cat_enum.root_path()])
            .output()
            .map_err(|e| format!("du failed: {}", e))?;
        if !out.status.success() { continue; }
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if let Some(first) = line.split_whitespace().next() {
                if let Ok(kb) = first.parse::<u64>() {
                    total_needed += kb * 1024;
                }
            }
        }
    }
    // Query host free space on Mac via `df -k $HOME`
    let mut host_free: u64 = 0;
    if let Ok(home) = std::env::var("HOME") {
        if let Ok(output) = Command::new("df").args(["-k", &home]).output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = s.lines().collect();
                if lines.len() >= 2 {
                    let parts: Vec<&str> = lines[1].split_whitespace().collect();
                    if parts.len() >= 4 {
                        if let Ok(free_kb) = parts[3].parse::<u64>() {
                            host_free = free_kb * 1024;
                        }
                    }
                }
            }
        }
    }

    Ok((total_needed, host_free))
}

// ---------------------------------------------------------------------------
// Content-provider export (contacts via content://)
// ---------------------------------------------------------------------------

/// Query the Android contacts content provider and render a vCard 3.0 file.
fn export_contacts_vcf(adb: &Path) -> Result<String, String> {
    let out = Command::new(adb)
        .args([
            "shell",
            "content",
            "query",
            "--uri",
            "content://com.android.contacts/contacts",
            "--projection",
            "display_name:phonenumber",
        ])
        .output()
        .map_err(|e| format!("content query failed: {}", e))?;
    if !out.status.success() {
        return Err(format!("content query exited {}", out.status));
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut vcf = String::new();
    for line in text.lines() {
        let line = line.trim();
        if !line.starts_with("Row:") {
            continue;
        }
        let name = extract_field(&line, "display_name");
        let phone = extract_field(&line, "phonenumber")
            .split(',')
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        vcf.push_str("BEGIN:VCARD\n");
        vcf.push_str("VERSION:3.0\n");
        if !name.is_empty() {
            vcf.push_str(&format!("FN:{}\n", name));
        }
        if !phone.is_empty() {
            vcf.push_str(&format!("TEL;TYPE=CELL:{}\n", phone));
        }
        vcf.push_str("END:VCARD\n");
    }
    Ok(vcf)
}

/// Extract the value for a given key from a content-query output line.
/// Fields are comma-separated `key=value` pairs; values may themselves contain
/// commas, so we stop at the next known ` key=` boundary.
fn extract_field(line: &str, key: &str) -> String {
    let pattern = format!("{}=", key);
    let Some(start) = line.find(&pattern) else {
        return String::new();
    };
    let after = &line[start + pattern.len()..];
    let mut end = after.len();
    for other in &["display_name", "phonenumber"] {
        if *other == key {
            continue;
        }
        if let Some(pos) = after.find(&format!(", {}=", other)) {
            end = end.min(pos);
        }
    }
    after[..end].to_string()
}

/// Back up a content-provider category (e.g. Contacts) into the local backup dir.
/// Returns the relative path of the written file.
fn export_provider_backup(adb: &Path, cat: &BackupCategory, backup_dir: &Path) -> Result<String, String> {
    match cat {
        BackupCategory::Contacts => {
            let vcf = export_contacts_vcf(adb)?;
            let rel = "contacts/contacts.vcf".to_string();
            let local_path = backup_dir.join(&rel);
            if let Some(parent) = local_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(&local_path, &vcf).map_err(|e| format!("write vcf failed: {}", e))?;
            Ok(rel)
        }
        _ => Err("unsupported provider category".into()),
    }
}

/// Progress as a 0.0–1.0 ratio. Byte-based when we know the expected total
/// (smooth progress mid-file); falls back to file-count ratio otherwise.
fn progress_ratio(bytes_done: u64, total_expected: u64, total_files: usize, files_done: usize) -> f32 {
    if total_expected > 0 {
        (bytes_done as f64 / total_expected as f64).clamp(0.0, 1.0) as f32
    } else if total_files == 0 {
        1.0
    } else {
        files_done as f32 / total_files as f32
    }
}

// ---------------------------------------------------------------------------
// Backup worker (runs on dedicated OS thread)
// ---------------------------------------------------------------------------
fn backup_worker_sync(app: tauri::AppHandle, job_state: SharedJob, backup_dir: PathBuf) {
    let categories = job_state.lock().unwrap().categories.clone();
    let job_id = job_state.lock().unwrap().id;

    let adb = match find_adb() {
        Some(p) => p,
        None => {
            let msg = ProgressMessage {
                job_id,
                progress: 0.0,
                current_file: None,
                status: "ADB binary not found".into(),
                bytes_transferred: 0,
                total_files: 0,
                processed_files: 0,
            };
            let _ = app.emit("backup-progress", &msg);
            return;
        }
    };

    let cats_label = phone_notifier::cat_names(&categories);

    // Initial event: indexing started
    let init_msg = ProgressMessage {
        job_id,
        progress: 0.0,
        current_file: None,
        status: "Scanning storage tree…".into(),
        bytes_transferred: 0,
        total_files: 0,
        processed_files: 0,
    };
    let _ = app.emit("backup-progress", &init_msg);
    phone_notifier::on_progress(&app, &init_msg, &cats_label);

    // Collect all files to back up
    let mut files: Vec<(String, bool)> = Vec::new(); // (remote_path, is_provider)
    let mut total_expected_bytes: u64 = 0;
    for cat in &categories {
        if job_state.lock().map(|s| s.is_canceled).unwrap_or(false) {
            return;
        }

        if let Some(_uri) = cat.content_uri() {
            match export_provider_backup(&adb, cat, &backup_dir) {
                Ok(rel) => {
                    // Provider payload already written to disk during scan; count its bytes.
                    if let Ok(meta) = std::fs::metadata(backup_dir.join(&rel)) {
                        total_expected_bytes = total_expected_bytes.saturating_add(meta.len());
                    }
                    files.push((rel, true));
                }
                Err(e) => {
                    let msg = ProgressMessage {
                        job_id,
                        progress: 0.0,
                        current_file: None,
                        status: format!("Provider skipped: {}", e),
                        bytes_transferred: 0,
                        total_files: 0,
                        processed_files: 0,
                    };
                    let _ = app.emit("backup-progress", &msg);
                }
            }
        } else {
            // Category total bytes via du, so streaming progress is byte-based (smooth).
            if let Ok(out) = Command::new(&adb)
                .args(["shell", "du", "-k", "-s", cat.root_path()])
                .output()
            {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    if let Some(first) = text.split_whitespace().next() {
                        if let Ok(kb) = first.parse::<u64>() {
                            total_expected_bytes = total_expected_bytes.saturating_add(kb * 1024);
                        }
                    }
                }
            }
            if let Ok(out) = Command::new(&adb)
                .args(["shell", "find", cat.root_path(), "-type", "f"])
                .output()
            {
                if out.status.success() {
                    for line in String::from_utf8_lossy(&out.stdout).lines() {
                        let p = line.trim().to_string();
                        if !p.is_empty() { files.push((p, false)); }
                    }
                }
            }
        }
    }

    let total = files.len();
    {
        let mut s = job_state.lock().unwrap();
        s.total_files = total;
    }
    let mut done = 0usize;
    let mut total_bytes_transferred: u64 = 0;

    // Notify UI that file index scan is complete with total file count!
    let scanned_msg = ProgressMessage {
        job_id,
        progress: 0.0,
        current_file: None,
        status: format!("Found {} files to migrate", total),
        bytes_transferred: 0,
        total_files: total,
        processed_files: 0,
    };
    let _ = app.emit("backup-progress", &scanned_msg);
    phone_notifier::on_progress(&app, &scanned_msg, &cats_label);

    for (remote_path, is_provider) in files {
        // Pause / cancel check
        loop {
            let s = job_state.lock().unwrap();
            if s.is_canceled {
                let progress = progress_ratio(total_bytes_transferred, total_expected_bytes, total, done);
                let cancel_msg = ProgressMessage {
                    job_id,
                    progress,
                    current_file: None,
                    status: "Cancelled by user".into(),
                    bytes_transferred: total_bytes_transferred,
                    total_files: total,
                    processed_files: done,
                };
                let _ = app.emit("backup-progress", &cancel_msg);
                phone_notifier::on_progress(&app, &cancel_msg, &cats_label);
                return;
            }
            if !s.is_paused { break; }
            drop(s);
            std::thread::sleep(std::time::Duration::from_millis(150));
        }

        let rel = remote_path.trim_start_matches("/sdcard/").to_string();
        let local_path = backup_dir.join(&rel);
        if let Some(parent) = local_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Notify UI immediately before reading bytes so the filename shows up instantly
        let progress = progress_ratio(total_bytes_transferred, total_expected_bytes, total, done);
        let start_msg = ProgressMessage {
            job_id,
            progress,
            current_file: Some(rel.clone()),
            status: "Streaming".into(),
            bytes_transferred: total_bytes_transferred,
            total_files: total,
            processed_files: done,
        };
        let _ = app.emit("backup-progress", &start_msg);
        phone_notifier::on_progress(&app, &start_msg, &cats_label);

        // Stream via adb exec-out cat (skipped for provider categories,
        // whose VCF was already written to disk during the scan phase).
        let mut sha = Sha256::new();
        let mut buf = [0u8; 16384];
        let mut size: u64 = 0;

        if is_provider {
            let mut file = match File::open(&local_path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            loop {
                match file.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        sha.update(&buf[..n]);
                        size += n as u64;
                        total_bytes_transferred += n as u64;
                    }
                    Err(_) => break,
                }
            }
        } else {
            let mut child = match Command::new(&adb)
                .args(["exec-out", "cat", &remote_path])
                .stdout(std::process::Stdio::piped())
                .spawn()
            {
                Ok(c) => c,
                Err(_) => continue,
            };

            let stdout = match child.stdout.take() {
                Some(s) => s,
                None => { let _ = child.wait(); continue; }
            };
            let mut reader = BufReader::new(stdout);
            let mut file = match OpenOptions::new().create(true).write(true).truncate(true).open(&local_path) {
                Ok(f) => f,
                Err(_) => { let _ = child.kill(); let _ = child.wait(); continue; }
            };
            let mut last_emit = Instant::now();

            loop {
                // Check if canceled mid-file
                if job_state.lock().map(|s| s.is_canceled).unwrap_or(false) {
                    let _ = child.kill();
                    let _ = child.wait();
                    let progress = progress_ratio(total_bytes_transferred, total_expected_bytes, total, done);
                    let cancel_msg = ProgressMessage {
                        job_id,
                        progress,
                        current_file: None,
                        status: "Cancelled by user".into(),
                        bytes_transferred: total_bytes_transferred,
                        total_files: total,
                        processed_files: done,
                    };
                    let _ = app.emit("backup-progress", &cancel_msg);
                    phone_notifier::on_progress(&app, &cancel_msg, &cats_label);
                    return;
                }

                // Check pause mid-file
                loop {
                    let is_paused = job_state.lock().map(|s| s.is_paused).unwrap_or(false);
                    let is_canceled = job_state.lock().map(|s| s.is_canceled).unwrap_or(false);
                    if is_canceled || !is_paused { break; }
                    std::thread::sleep(std::time::Duration::from_millis(150));
                }

                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let _ = file.write_all(&buf[..n]);
                        sha.update(&buf[..n]);
                        size += n as u64;
                        total_bytes_transferred += n as u64;

                        // Periodic update during large file transfers (every 100ms)
                        if last_emit.elapsed().as_millis() >= 100 {
                            last_emit = Instant::now();
                            let progress = progress_ratio(total_bytes_transferred, total_expected_bytes, total, done);
                            let live_msg = ProgressMessage {
                                job_id,
                                progress,
                                current_file: Some(rel.clone()),
                                status: "Streaming".into(),
                                bytes_transferred: total_bytes_transferred,
                                total_files: total,
                                processed_files: done,
                            };
                            let _ = app.emit("backup-progress", &live_msg);
                            phone_notifier::on_progress(&app, &live_msg, &cats_label);
                        }
                    }
                    Err(_) => break,
                }
            }
            let _ = child.wait();
        }

        if job_state.lock().map(|s| s.is_canceled).unwrap_or(false) {
            return;
        }

        let checksum = format!("{:x}", sha.finalize());

        let entry = ManifestEntry {
            relative_path: rel.clone(),
            size_bytes: size,
            sha256: checksum,
            modified_ts: chrono::Utc::now().timestamp() as u64,
            status: "completed".into(),
        };

        {
            let mut s = job_state.lock().unwrap();
            s.manifest.entries.push(entry);
            done += 1;
            s.processed_files = done;
            s.total_bytes_transferred = total_bytes_transferred;
            s.progress = progress_ratio(total_bytes_transferred, total_expected_bytes, total, done);
            let done_msg = ProgressMessage {
                job_id: s.id,
                progress: s.progress,
                current_file: Some(rel),
                status: "Streaming".into(),
                bytes_transferred: total_bytes_transferred,
                total_files: total,
                processed_files: done,
            };
            let _ = app.emit("backup-progress", &done_msg);
            phone_notifier::on_progress(&app, &done_msg, &cats_label);
        }
    }

    // Write manifest atomically
    let tmp = backup_dir.join("manifest.json.tmp");
    let final_path = backup_dir.join("manifest.json");
    {
        let s = job_state.lock().unwrap();
        if let Ok(mut f) = File::create(&tmp) {
            if let Ok(json) = serde_json::to_string_pretty(&s.manifest) {
                let _ = f.write_all(json.as_bytes());
            }
        }
    }
    let _ = fs::rename(&tmp, &final_path);

    // Final progress event
    let complete_msg = ProgressMessage {
        job_id,
        progress: 1.0,
        current_file: None,
        status: "Completed".into(),
        bytes_transferred: total_bytes_transferred,
        total_files: total,
        processed_files: done,
    };
    let _ = app.emit("backup-progress", &complete_msg);
    phone_notifier::on_progress(&app, &complete_msg, &cats_label);
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------
#[tauri::command]
pub fn start_backup(
    app: tauri::AppHandle,
    selected_categories: Vec<String>,
    backup_dir: String,
) -> Result<u64, String> {
    let cats: Vec<BackupCategory> = selected_categories.iter().filter_map(|c| match c.to_lowercase().as_str() {
        "photos"    => Some(BackupCategory::Photos),
        "videos"    => Some(BackupCategory::Videos),
        "audio"     => Some(BackupCategory::Audio),
        "documents" => Some(BackupCategory::Documents),
        "downloads" => Some(BackupCategory::Downloads),
        "contacts"  => Some(BackupCategory::Contacts),
        "apps"      => Some(BackupCategory::Apps),
        _ => None,
    }).collect();

    if cats.is_empty() { return Err("No valid categories selected".into()); }

    let backup_path = PathBuf::from(&backup_dir);
    fs::create_dir_all(&backup_path).map_err(|e| e.to_string())?;

    let job_id = chrono::Utc::now().timestamp_millis() as u64;
    let job = BackupJobState {
        id: job_id,
        categories: cats,
        manifest: Manifest::default(),
        is_paused: false,
        is_canceled: false,
        progress: 0.0,
        total_files: 0,
        processed_files: 0,
        total_bytes_transferred: 0,
    };

    let shared = Arc::new(Mutex::new(job));

    // Cancel any previous running job before starting a new one
    {
        let mut holder = get_active_job_holder().lock().unwrap();
        if let Some(prev) = holder.take() {
            if let Ok(mut s) = prev.lock() {
                s.is_canceled = true;
            }
        }
        *holder = Some(shared.clone());
    }

    let worker_shared = shared.clone();
    std::thread::spawn(move || {
        backup_worker_sync(app, worker_shared, backup_path);
    });
    Ok(job_id)
}

#[tauri::command]
pub fn pause_backup(app: tauri::AppHandle) -> Result<(), String> {
    let holder = get_active_job_holder().lock().unwrap();
    if let Some(shared) = &*holder {
        let mut s = shared.lock().unwrap();
        s.is_paused = true;
        let msg = ProgressMessage {
            job_id: s.id,
            progress: s.progress,
            current_file: None,
            status: "Paused".into(),
            bytes_transferred: s.total_bytes_transferred,
            total_files: s.total_files,
            processed_files: s.processed_files,
        };
        let _ = app.emit("backup-progress", &msg);
    }
    Ok(())
}

#[tauri::command]
pub fn resume_backup(app: tauri::AppHandle) -> Result<(), String> {
    let holder = get_active_job_holder().lock().unwrap();
    if let Some(shared) = &*holder {
        let mut s = shared.lock().unwrap();
        s.is_paused = false;
        let msg = ProgressMessage {
            job_id: s.id,
            progress: s.progress,
            current_file: None,
            status: "Streaming".into(),
            bytes_transferred: s.total_bytes_transferred,
            total_files: s.total_files,
            processed_files: s.processed_files,
        };
        let _ = app.emit("backup-progress", &msg);
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_backup(app: tauri::AppHandle) -> Result<(), String> {
    let holder = get_active_job_holder().lock().unwrap();
    if let Some(shared) = &*holder {
        let mut s = shared.lock().unwrap();
        s.is_canceled = true;
        let msg = ProgressMessage {
            job_id: s.id,
            progress: s.progress,
            current_file: None,
            status: "Cancelled by user".into(),
            bytes_transferred: s.total_bytes_transferred,
            total_files: s.total_files,
            processed_files: s.processed_files,
        };
        let _ = app.emit("backup-progress", &msg);
    }
    Ok(())
}

#[tauri::command]
pub fn restore_backup(
    app: tauri::AppHandle,
    selected_categories: Vec<String>,
    backup_dir: String,
) -> Result<u64, String> {
    let cats: Vec<BackupCategory> = selected_categories.iter().filter_map(|c| match c.to_lowercase().as_str() {
        "photos"    => Some(BackupCategory::Photos),
        "videos"    => Some(BackupCategory::Videos),
        "audio"     => Some(BackupCategory::Audio),
        "documents" => Some(BackupCategory::Documents),
        "downloads" => Some(BackupCategory::Downloads),
        "contacts"  => Some(BackupCategory::Contacts),
        "apps"      => Some(BackupCategory::Apps),
        _ => None,
    }).collect();

    if cats.is_empty() { return Err("No valid categories selected".into()); }

    let adb = find_adb().ok_or_else(|| "ADB binary not found".to_string())?;
    let backup_path = PathBuf::from(&backup_dir);
    let manifest_path = backup_path.join("manifest.json");
    let manifest_str = fs::read_to_string(&manifest_path).map_err(|e| format!("manifest read failed: {}", e))?;
    let manifest: Manifest = serde_json::from_str(&manifest_str).map_err(|e| format!("manifest parse failed: {}", e))?;

    fn cat_prefix(c: &BackupCategory) -> &'static str {
        match c {
            BackupCategory::Photos    => "DCIM/",
            BackupCategory::Videos    => "Movies/",
            BackupCategory::Audio     => "Music/",
            BackupCategory::Documents => "Documents/",
            BackupCategory::Downloads => "Download/",
            BackupCategory::Contacts  => "contacts/",
            BackupCategory::Apps      => "apps/",
        }
    }

    let prefixes: Vec<&str> = cats.iter().map(cat_prefix).collect();
    let entries: Vec<ManifestEntry> = manifest.entries.into_iter().filter(|e| prefixes.iter().any(|p| e.relative_path.starts_with(p))).collect();

    let job_id = chrono::Utc::now().timestamp_millis() as u64;
    let total = entries.len();

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut done: usize = 0;
        let mut bytes: u64 = 0;

        let _ = app_clone.emit("restore-progress", &ProgressMessage {
            job_id,
            progress: 0.0,
            current_file: None,
            status: "Scanning manifest…".into(),
            bytes_transferred: 0,
            total_files: total,
            processed_files: 0,
        });

        for entry in entries {
            let local = backup_path.join(&entry.relative_path);
            let remote = format!("/sdcard/{}", entry.relative_path);

            if let Some(parent) = Path::new(&remote).parent() {
                let _ = Command::new(&adb).args(["shell", "mkdir", "-p", parent.to_str().unwrap_or("/sdcard")]).output();
            }

            let _ = app_clone.emit("restore-progress", &ProgressMessage {
                job_id,
                progress: if total == 0 { 0.0 } else { done as f32 / total as f32 },
                current_file: Some(entry.relative_path.clone()),
                status: "Restoring".into(),
                bytes_transferred: bytes,
                total_files: total,
                processed_files: done,
            });

            let out = Command::new(&adb).args(["push", local.to_str().unwrap(), &remote]).output();
            match out {
                Ok(o) if o.status.success() => {
                    bytes = bytes.saturating_add(entry.size_bytes);
                    done += 1;
                }
                _ => {
                    let _ = app_clone.emit("restore-progress", &ProgressMessage {
                        job_id,
                        progress: if total == 0 { 1.0 } else { done as f32 / total as f32 },
                        current_file: Some(entry.relative_path.clone()),
                        status: "Skipped".into(),
                        bytes_transferred: bytes,
                        total_files: total,
                        processed_files: done,
                    });
                    continue;
                }
            }

            let pct = if total == 0 { 1.0 } else { done as f32 / total as f32 };
            let _ = app_clone.emit("restore-progress", &ProgressMessage {
                job_id,
                progress: pct,
                current_file: Some(entry.relative_path.clone()),
                status: "Restoring".into(),
                bytes_transferred: bytes,
                total_files: total,
                processed_files: done,
            });
        }

        let _ = app_clone.emit("restore-progress", &ProgressMessage {
            job_id,
            progress: 1.0,
            current_file: None,
            status: "Restored".into(),
            bytes_transferred: bytes,
            total_files: total,
            processed_files: done,
        });
    });

    Ok(job_id)
}

#[tauri::command]
pub async fn list_backup_contents(backup_dir: String) -> Result<Vec<ManifestEntry>, String> {
    let manifest_path = PathBuf::from(&backup_dir).join("manifest.json");
    let content = fs::read_to_string(&manifest_path).map_err(|e| format!("manifest read failed: {}", e))?;
    let manifest: Manifest = serde_json::from_str(&content).map_err(|e| format!("manifest parse failed: {}", e))?;
    Ok(manifest.entries)
}
