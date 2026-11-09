mod adb;

mod backup;
mod phone_notifier;
use tauri::Emitter;
use backup::{start_backup, pause_backup, resume_backup, cancel_backup, estimate_backup_size, restore_backup, list_backup_contents};
use std::time::Duration;

#[tauri::command]
fn get_adb_status() -> adb::AdbStatus {
    adb::check_adb_status()
}

#[tauri::command]
fn get_devices() -> Vec<adb::DeviceInfo> {
    adb::list_devices()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_adb_status, get_devices, start_backup, pause_backup, resume_backup, cancel_backup, estimate_backup_size, restore_backup, list_backup_contents])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Background polling thread for USB / ADB device state (every 1.5s)
            std::thread::spawn(move || {
                loop {
                    let devices = adb::list_devices();
                    let _ = app_handle.emit("device-poll", &devices);
                    std::thread::sleep(Duration::from_millis(1500));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
