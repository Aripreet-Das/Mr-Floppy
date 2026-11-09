import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CanvasGraph, CATEGORIES_DATA } from "./CanvasGraph";
import { InspectorPanel } from "./InspectorPanel";
import { BackupFileTree } from "./BackupFileTree";
import { DeviceInfo } from "../types/device";

interface BackupProgressPayload {
  job_id: number;
  progress: number;
  current_file?: string | null;
  status: string;
  bytes_transferred?: number;
  total_files?: number;
  processed_files?: number;
}

interface ManifestEntry {
  relative_path: string;
  size_bytes: number;
  sha256: string;
  modified_ts: number;
  status: string;
}

interface BackupWizardProps {
  device: DeviceInfo | null;
  progress?: BackupProgressPayload | null;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export const BackupWizard: React.FC<BackupWizardProps> = ({
  device,
  progress,
  onCancel,
  onPause,
  onResume,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Photos",
    "Documents",
    "Downloads",
  ]);
  const [activeCategory, setActiveCategory] = useState<string>("Photos");
  const [estimating, setEstimating] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<{ needBytes: number; freeBytes: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "Ready. Neural migration graph loaded.",
    "Select categories or click a node to inspect payload details.",
  ]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [showFileTree, setShowFileTree] = useState<boolean>(false);
  const [backupEntries, setBackupEntries] = useState<ManifestEntry[] | null>(null);
  const prevFileRef = useRef<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const DEFAULT_BACKUP_DIR = "/Users/aripreetdas/Backups/MrFloppy";

  // Sync incoming progress events
  useEffect(() => {
    if (!progress) return;

    if (progress.status === "Streaming" && progress.current_file) {
      setIsWorking(true);
      if (prevFileRef.current !== progress.current_file) {
        prevFileRef.current = progress.current_file;
        setLogs((prev) => [
          ...prev.slice(-100),
          `[STREAM] ${progress.current_file}`,
        ]);
      }
    } else if (progress.status === "Completed") {
      setIsWorking(false);
      setIsPaused(false);
      setLogs((prev) => [
        ...prev.slice(-100),
        `[COMPLETE] All selected payloads transferred. Checksums verified.`,
      ]);
    } else if (progress.status && progress.status !== "Streaming") {
      if (prevStatusRef.current !== progress.status) {
        prevStatusRef.current = progress.status;
        setLogs((prev) => [
          ...prev.slice(-100),
          `[STATUS] ${progress.status}`,
        ]);
      }
    }
  }, [progress]);

  // Pull the manifest tree once the backup completes so the user can browse
  // what was actually written to the Mac backup directory.
  useEffect(() => {
    if (!progress || progress.status !== "Completed" || backupEntries !== null) return;
    (async () => {
      try {
        const entries = await invoke<ManifestEntry[]>("list_backup_contents", {
          backupDir: DEFAULT_BACKUP_DIR,
        });
        setBackupEntries(entries);
        setShowFileTree(true);
        setLogs((prev) => [
          ...prev,
          `[MANIFEST] ${entries.length} files indexed in backup directory.`,
        ]);
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          `[ERROR] Could not read backup manifest: ${String(err)}`,
        ]);
      }
    })();
  }, [progress, backupEntries]);

  const handleSelectCategory = (id: string) => {
    setActiveCategory(id);
  };

  const handleToggleCategory = (id: string) => {
    if (isWorking) return;
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setEstimate(null);
  };

  const handleEstimate = async () => {
    if (selectedCategories.length === 0) return;
    setEstimating(true);
    setLogs((prev) => [
      ...prev,
      `[PREFLIGHT] Estimating size for ${selectedCategories.join(", ")}...`,
    ]);

    try {
      const res = await invoke<[number, number]>("estimate_backup_size", {
        selectedCategories,
      });
      const [needBytes, freeBytes] = res;
      setEstimate({ needBytes, freeBytes });
      setLogs((prev) => [
        ...prev,
        `[PREFLIGHT] Required: ${(needBytes / (1024 * 1024 * 1024)).toFixed(2)} GB · Mac free: ${(freeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      ]);
    } catch (err) {
      setLogs((prev) => [...prev, `[ERROR] Size estimation failed: ${String(err)}`]);
    } finally {
      setEstimating(false);
    }
  };

  const handleStartBackup = async () => {
    if (!device) {
      setLogs((prev) => [...prev, `[ERROR] No Android device connected. Plug in via USB and authorize ADB.`]);
      return;
    }
    if (selectedCategories.length === 0) return;
    setIsWorking(true);
    setIsPaused(false);
    prevFileRef.current = null;
    prevStatusRef.current = null;

    const defaultBackupDir = "/Users/aripreetdas/Backups/MrFloppy";
    setLogs((prev) => [
      ...prev,
      `[START] Connecting to ADB daemon and streaming selected pipelines...`,
      `[DEST] ${defaultBackupDir}`,
      `[HASH] Initializing SHA-256 on-the-fly verification engine...`,
    ]);

    try {
      await invoke("start_backup", {
        selectedCategories,
        backupDir: defaultBackupDir,
      });
    } catch (err) {
      setIsWorking(false);
      setLogs((prev) => [...prev, `[ERROR] Backup startup failed: ${String(err)}`]);
    }
  };

  const handleTogglePause = () => {
    if (isPaused) {
      if (onResume) onResume();
      setIsPaused(false);
      setLogs((prev) => [...prev, `[RESUME] Migration stream resumed.`]);
    } else {
      if (onPause) onPause();
      setIsPaused(true);
      setLogs((prev) => [...prev, `[PAUSE] Migration stream paused.`]);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    setIsWorking(false);
    setIsPaused(false);
    setLogs((prev) => [...prev, `[ABORT] Migration cancelled by user.`]);
  };

  const currentCategoryData =
    CATEGORIES_DATA.find((c) => c.id === activeCategory) || CATEGORIES_DATA[0];

  return (
    <div className="flex-1 w-full h-full flex overflow-hidden canvas-atmosphere select-none relative">
      {/* ── Left Area: Interactive Neural Node Canvas ── */}
      <main className="flex-1 min-w-0 h-full flex relative overflow-hidden">
        <CanvasGraph
          device={device}
          selectedCategories={selectedCategories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          onToggleCategory={handleToggleCategory}
          isStreaming={isWorking && !isPaused}
          direction="backup"
          currentProgress={progress?.progress ?? 0}
        />
      </main>

      {/* ── Right Area: Floating Obsidian Inspector Card ── */}
      <InspectorPanel
        category={currentCategoryData}
        progress={progress}
        logs={logs}
        isWorking={isWorking}
        isPaused={isPaused}
        estimating={estimating}
        estimate={estimate}
        onEstimate={handleEstimate}
        onStartBackup={handleStartBackup}
        onTogglePause={handleTogglePause}
        onCancel={handleCancel}
      />

      {/* ── Backup directory tree (visible after completion) ── */}
      {showFileTree && backupEntries && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[55%]">
          <BackupFileTree entries={backupEntries} onClose={() => setShowFileTree(false)} />
        </div>
      )}
    </div>
  );
};
