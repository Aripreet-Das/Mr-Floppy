use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;

type DeviceStaticCache = HashMap<String, (Option<String>, Option<String>, Option<String>, Option<String>)>;
static STATIC_CACHE: OnceLock<Mutex<DeviceStaticCache>> = OnceLock::new();

fn get_cache() -> &'static Mutex<DeviceStaticCache> {
    STATIC_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceConnectionStatus {
    Unauthorized,
    Device,
    Offline,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub serial: String,
    pub status: DeviceConnectionStatus,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub android_version: Option<String>,
    pub sdk_version: Option<String>,
    pub battery_level: Option<u8>,
    pub storage_free_gb: Option<f64>,
    pub storage_total_gb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdbStatus {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

pub fn find_adb_binary() -> Option<PathBuf> {
    // 1. Check Homebrew path
    let brew_adb = PathBuf::from("/opt/homebrew/bin/adb");
    if brew_adb.exists() {
        return Some(brew_adb);
    }
    let usr_local_adb = PathBuf::from("/usr/local/bin/adb");
    if usr_local_adb.exists() {
        return Some(usr_local_adb);
    }

    // 2. Check environment variables
    if let Ok(android_home) = std::env::var("ANDROID_HOME") {
        let p = PathBuf::from(android_home).join("platform-tools").join("adb");
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(android_root) = std::env::var("ANDROID_SDK_ROOT") {
        let p = PathBuf::from(android_root).join("platform-tools").join("adb");
        if p.exists() {
            return Some(p);
        }
    }

    // 3. Check macOS standard Library location
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join("Library/Android/sdk/platform-tools/adb");
        if p.exists() {
            return Some(p);
        }
    }

    // 4. Fallback to `which adb`
    if let Ok(output) = Command::new("which").arg("adb").output() {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() {
                let p = PathBuf::from(s);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    None
}

pub fn check_adb_status() -> AdbStatus {
    match find_adb_binary() {
        Some(path) => {
            let version = match Command::new(&path).arg("version").output() {
                Ok(output) if output.status.success() => {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    out_str.lines().next().map(|s| s.to_string())
                }
                _ => None,
            };
            AdbStatus {
                found: true,
                path: Some(path.to_string_lossy().to_string()),
                version,
            }
        }
        None => AdbStatus {
            found: false,
            path: None,
            version: None,
        },
    }
}

pub fn list_devices() -> Vec<DeviceInfo> {
    let adb_path = match find_adb_binary() {
        Some(p) => p,
        None => return Vec::new(),
    };

    let output = match Command::new(&adb_path).args(["devices", "-l"]).output() {
        Ok(out) if out.status.success() => out,
        _ => return Vec::new(),
    };

    let out_str = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in out_str.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("List of devices") || line.starts_with('*') {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let state_str = parts[1];

        let status = match state_str {
            "device" => DeviceConnectionStatus::Device,
            "unauthorized" => DeviceConnectionStatus::Unauthorized,
            "offline" => DeviceConnectionStatus::Offline,
            _ => DeviceConnectionStatus::Offline,
        };

        // Extract metadata if model/product exists in line
        let mut model: Option<String> = None;
        for part in &parts[2..] {
            if let Some(val) = part.strip_prefix("model:") {
                model = Some(val.replace('_', " "));
            }
        }

        let mut device_info = DeviceInfo {
            serial: serial.clone(),
            status: status.clone(),
            model,
            manufacturer: None,
            android_version: None,
            sdk_version: None,
            battery_level: None,
            storage_free_gb: None,
            storage_total_gb: None,
        };

        // If authorized, query full properties
        if status == DeviceConnectionStatus::Device {
            populate_device_properties(&adb_path, &serial, &mut device_info);
        }

        devices.push(device_info);
    }

    devices
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_adb_binary() {
        let adb = find_adb_binary();
        assert!(adb.is_some(), "ADB binary should be located on system");
    }

    #[test]
    fn test_check_adb_status() {
        let status = check_adb_status();
        assert!(status.found);
        assert!(status.path.is_some());
        assert!(status.version.is_some());
    }

    #[test]
    fn test_list_devices_no_crash() {
        let devices = list_devices();
        println!("Detected devices count: {}", devices.len());
    }
}

fn populate_device_properties(adb_path: &PathBuf, serial: &str, info: &mut DeviceInfo) {
    // Check static properties cache (model, manufacturer, android_version, sdk_version)
    let cached = {
        let lock = get_cache().lock().unwrap();
        lock.get(serial).cloned()
    };

    if let Some((m, mf, v, s)) = cached {
        if m.is_some() { info.model = m; }
        info.manufacturer = mf;
        info.android_version = v;
        info.sdk_version = s;
    } else {
        // 1. Model
        if let Ok(out) = Command::new(adb_path)
            .args(["-s", serial, "shell", "getprop", "ro.product.model"])
            .output()
        {
            if out.status.success() {
                let m = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !m.is_empty() {
                    info.model = Some(m);
                }
            }
        }

        // 2. Manufacturer
        if let Ok(out) = Command::new(adb_path)
            .args(["-s", serial, "shell", "getprop", "ro.product.manufacturer"])
            .output()
        {
            if out.status.success() {
                let m = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !m.is_empty() {
                    info.manufacturer = Some(m);
                }
            }
        }

        // 3. Android Version
        if let Ok(out) = Command::new(adb_path)
            .args(["-s", serial, "shell", "getprop", "ro.build.version.release"])
            .output()
        {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !v.is_empty() {
                    info.android_version = Some(v);
                }
            }
        }

        // 4. SDK Version
        if let Ok(out) = Command::new(adb_path)
            .args(["-s", serial, "shell", "getprop", "ro.build.version.sdk"])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    info.sdk_version = Some(s);
                }
            }
        }

        // Cache the queried static values
        let mut lock = get_cache().lock().unwrap();
        lock.insert(
            serial.to_string(),
            (
                info.model.clone(),
                info.manufacturer.clone(),
                info.android_version.clone(),
                info.sdk_version.clone(),
            ),
        );
    }

    // 5. Battery Level
    if let Ok(out) = Command::new(adb_path)
        .args(["-s", serial, "shell", "dumpsys", "battery"])
        .output()
    {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            for l in s.lines() {
                let l = l.trim();
                if l.starts_with("level:") {
                    if let Some(val) = l.strip_prefix("level:") {
                        if let Ok(num) = val.trim().parse::<u8>() {
                            info.battery_level = Some(num);
                            break;
                        }
                    }
                }
            }
        }
    }

    // 6. Storage (/sdcard free space)
    if let Ok(out) = Command::new(adb_path)
        .args(["-s", serial, "shell", "df", "-k", "/sdcard"])
        .output()
    {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            let lines: Vec<&str> = s.lines().collect();
            if lines.len() >= 2 {
                let parts: Vec<&str> = lines[1].split_whitespace().collect();
                if parts.len() >= 4 {
                    if let (Ok(total_k), Ok(free_k)) = (parts[1].parse::<f64>(), parts[3].parse::<f64>()) {
                        info.storage_total_gb = Some(((total_k / (1024.0 * 1024.0)) * 10.0).round() / 10.0);
                        info.storage_free_gb = Some(((free_k / (1024.0 * 1024.0)) * 10.0).round() / 10.0);
                    }
                }
            }
        }
    }
}
