import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Header } from "./components/Header";
import { BackupWizard } from "./components/BackupWizard";
import { RestoreWizard } from "./components/RestoreWizard";
import { AuthorizationGuide } from "./components/AuthorizationGuide";
import { DeviceInfo, AdbStatus } from "./types/device";
import { ShieldCheck, Cpu } from "lucide-react";
import "./App.css";

export function App() {
  const [adbStatus, setAdbStatus] = useState<AdbStatus | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [polling, setPolling] = useState<boolean>(false);
  const [backupProgress, setBackupProgress] = useState<{
    job_id: number;
    progress: number;
    current_file?: string | null;
    status: string;
    bytes_transferred?: number;
    total_files?: number;
    processed_files?: number;
  } | null>(null);

  const [mode, setMode] = useState<"backup" | "restore">("backup");

  // Manual query
  const refreshDevices = useCallback(async () => {
    setPolling(true);
    try {
      const adb = await invoke<AdbStatus>("get_adb_status");
      setAdbStatus(adb);

      const devList = await invoke<DeviceInfo[]>("get_devices");
      setDevices(devList);
    } catch (err) {
      console.error("Failed to query devices:", err);
    } finally {
      setTimeout(() => setPolling(false), 400);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    refreshDevices();

    // Listen for background device poll events emitted by Rust every 1.5s
    let unlistenDevice: (() => void) | undefined;
    listen<DeviceInfo[]>("device-poll", (event) => {
      setDevices(event.payload);
    }).then((dispose) => {
      unlistenDevice = dispose;
    });

    // Listen for backup progress events from Rust
    let unlistenBackup: (() => void) | undefined;
    listen("backup-progress", (event: any) => {
      const p: any = event.payload;
      setBackupProgress({
        job_id: p.job_id ?? 0,
        progress: p.progress ?? 0,
        current_file: p.current_file ?? null,
        status: p.status ?? "Working",
        bytes_transferred: p.bytes_transferred ?? 0,
        total_files: p.total_files ?? 0,
        processed_files: p.processed_files ?? 0,
      });
    }).then((dispose) => {
      unlistenBackup = dispose;
    });

    return () => {
      if (unlistenDevice) unlistenDevice();
      if (unlistenBackup) unlistenBackup();
    };
  }, [refreshDevices]);

  const handleCancel = useCallback(() => {
    try {
      invoke("cancel_backup");
    } catch {}
    setBackupProgress(null);
  }, []);

  const handlePause = useCallback(() => {
    try {
      invoke("pause_backup");
    } catch {}
  }, []);

  const handleResume = useCallback(() => {
    try {
      invoke("resume_backup");
    } catch {}
  }, []);

  const activeDevice = devices.find((d) => d.status === "Device") ?? null;
  const isUnauthorized = activeDevice?.status === "Unauthorized";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#05080a] text-slate-100 overflow-hidden select-none font-sans">
      {/* ── Native Mac Window Titlebar (with drag region & traffic light inset) ── */}
      <Header
        adbStatus={adbStatus}
        polling={polling}
        onRefresh={refreshDevices}
        mode={mode}
        onModeChange={setMode}
      />

      {/* ── Conditional Authorization Notice if unauthorized ── */}
      {isUnauthorized && (
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/20">
          <AuthorizationGuide />
        </div>
      )}

      {/* ── Spatial Neural Migration Workbench ── */}
      {mode === "restore" ? (
        <RestoreWizard device={activeDevice} />
      ) : (
        <BackupWizard
          device={activeDevice}
          progress={backupProgress}
          onCancel={handleCancel}
          onPause={handlePause}
          onResume={handleResume}
        />
      )}

      {/* ── Native Mac App Footer Status Bar ── */}
      <footer className="h-7 border-t border-white/5 bg-[#06090d]/95 px-4 flex items-center justify-between text-[11px] font-mono text-slate-500 select-none flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">~/Backups/Mr. Floppy</span>
          <span className="text-slate-700">·</span>
          <span>
            {activeDevice ? (
              <span className="text-teal-400 flex items-center gap-1">
                <span>Linked:</span>
                <span className="font-semibold text-slate-200">
                  {activeDevice.model || activeDevice.serial}
                </span>
              </span>
            ) : (
              <span className="text-slate-500">Scanning USB for Android device...</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Local-First Sandbox</span>
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-500" />
            <span>Rust Core</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
