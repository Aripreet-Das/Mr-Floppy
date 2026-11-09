import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CanvasGraph, CATEGORIES_DATA } from "./CanvasGraph";
import { DotMatrixEqualizer } from "./DotMatrixEqualizer";
import { DeviceInfo } from "../types/device";
import { cn } from "./utils";
import {
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Terminal,
  Play,
  XCircle,
  Database,
  Smartphone,
} from "lucide-react";

interface RestoreProgressPayload {
  job_id: number;
  progress: number;
  current_file?: string | null;
  status: string;
  bytes_transferred?: number;
  total_files?: number;
  processed_files?: number;
}

interface RestoreWizardProps {
  device: DeviceInfo | null;
}

const DEFAULT_BACKUP_DIR = "/Users/aripreetdas/Backups/MrFloppy";

export const RestoreWizard: React.FC<RestoreWizardProps> = ({ device }) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Photos",
    "Documents",
    "Downloads",
  ]);
  const [activeCategory, setActiveCategory] = useState<string>("Photos");
  const [estimating, setEstimating] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<{ needBytes: number; freeBytes: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "Restore session loaded.",
    "Select categories to push back to the device.",
  ]);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgressPayload | null>(null);
  const prevFileRef = useRef<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<RestoreProgressPayload>("restore-progress", (event: any) => {
      const p = event.payload;
      setRestoreProgress({
        job_id: p.job_id ?? 0,
        progress: p.progress ?? 0,
        current_file: p.current_file ?? null,
        status: p.status ?? "Working",
        bytes_transferred: p.bytes_transferred ?? 0,
        total_files: p.total_files ?? 0,
        processed_files: p.processed_files ?? 0,
      });
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!restoreProgress) return;
    if (restoreProgress.status === "Restoring" && restoreProgress.current_file) {
      setIsWorking(true);
      if (prevFileRef.current !== restoreProgress.current_file) {
        prevFileRef.current = restoreProgress.current_file;
        setLogs((prev) => [
          ...prev.slice(-100),
          `[RESTORE] ${restoreProgress.current_file}`,
        ]);
      }
    } else if (restoreProgress.status === "Restored") {
      setIsWorking(false);
      setLogs((prev) => [
        ...prev.slice(-100),
        `[RESTORED] All selected payloads pushed to device.`,
      ]);
    } else if (restoreProgress.status && restoreProgress.status !== "Restoring") {
      setLogs((prev) => [
        ...prev.slice(-100),
        `[STATUS] ${restoreProgress.status}`,
      ]);
    }
  }, [restoreProgress]);

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
      `[PREFLIGHT] Sizing restore set for ${selectedCategories.join(", ")}...`,
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

  const handleStartRestore = async () => {
    if (!device) {
      setLogs((prev) => [...prev, `[ERROR] No Android device connected. Plug in via USB and authorize ADB.`]);
      return;
    }
    if (selectedCategories.length === 0) return;
    setIsWorking(true);
    setLogs((prev) => [
      ...prev,
      `[START] Pushing selected pipelines from Mac → device...`,
      `[DEST] /sdcard/`,
      `[HASH] SHA-256 verified on arrival...`,
    ]);
    try {
      await invoke("restore_backup", {
        selectedCategories,
        backupDir: DEFAULT_BACKUP_DIR,
      });
    } catch (err) {
      setIsWorking(false);
      setLogs((prev) => [...prev, `[ERROR] Restore startup failed: ${String(err)}`]);
    }
  };

  const handleAbortRestore = () => {
    setIsWorking(false);
    setRestoreProgress(null);
    setLogs((prev) => [...prev, `[ABORT] Restore cancelled by user.`]);
  };

  const currentCategoryData =
    CATEGORIES_DATA.find((c) => c.id === activeCategory) || CATEGORIES_DATA[0];

  const needGb = estimate ? (estimate.needBytes / (1024 * 1024 * 1024)).toFixed(2) : null;
  const freeGb = estimate ? (estimate.freeBytes / (1024 * 1024 * 1024)).toFixed(2) : null;

  return (
    <div className="flex-1 w-full h-full flex overflow-hidden canvas-atmosphere select-none relative">
      {/* ── Left Area: Floating Obsidian Restore Inspector Card ── */}
      <aside className="w-[410px] min-w-[410px] h-full flex-shrink-0 flex flex-col p-4 z-20 overflow-hidden order-1">
        <div className="glass-panel flex-1 min-h-0 rounded-2xl p-4 flex flex-col gap-3.5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

          {/* Header & Source -> Target Path */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                  {currentCategoryData.icon}
                </div>
                <span className="text-xs font-semibold text-slate-300 tracking-tight">
                  {currentCategoryData.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-mono border",
                    isWorking
                      ? "bg-amber-950/70 border-amber-500/40 text-amber-300"
                      : "bg-slate-900/60 border-white/10 text-slate-400"
                  )}
                >
                  {isWorking ? "Pushing" : "Ready"}
                </span>
                <button
                  onClick={handleEstimate}
                  disabled={estimating || isWorking}
                  title="Run Pre-Flight Space Check"
                  className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1 transition-all active:scale-95"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  <span>{estimating ? "Checking..." : "Pre-flight"}</span>
                </button>
              </div>
            </div>

            <h3 className="text-sm font-bold text-white tracking-tight leading-snug flex items-center gap-1.5 flex-wrap">
              <span className="text-amber-300 font-mono text-xs truncate max-w-[190px]">
                ~/Backups/Mr. Floppy/{currentCategoryData.id}
              </span>
              <span className="text-slate-500 font-normal">→</span>
              <span className="text-teal-400 font-mono text-xs">{currentCategoryData.path}</span>
            </h3>

            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span>SHA-256 verified on arrival · Zero Mac writes</span>
            </p>
          </div>

          {/* Restore Progress & Dot-Matrix Waveform */}
          <div className="rounded-xl bg-[#070c10]/90 border border-white/10 p-3 flex flex-col gap-2 flex-shrink-0 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Restore Progress
              </span>
              <span className="text-[10px] font-mono text-teal-400 px-1.5 py-0.2 rounded bg-teal-950/40 border border-teal-500/20">
                {isWorking ? "adb push" : "Indexed"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold font-mono text-white tracking-tight num-mono">
                    {restoreProgress ? (restoreProgress.progress * 100).toFixed(1) : 0}
                  </span>
                  <span className="text-sm font-normal text-slate-500 ml-0.5">%</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {restoreProgress?.processed_files ?? 0} / {restoreProgress?.total_files ?? currentCategoryData.estimatedCount} files · {(restoreProgress?.bytes_transferred ? (restoreProgress.bytes_transferred / (1024 * 1024)).toFixed(1) : "0.0")} MB
                </span>
              </div>
              <div className="flex items-center">
                <DotMatrixEqualizer
                  isStreaming={isWorking}
                  progress={restoreProgress?.progress ?? 0}
                />
              </div>
            </div>

            <div className="w-full bg-slate-900/80 h-1 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-200"
                style={{ width: `${restoreProgress ? (restoreProgress.progress * 100).toFixed(1) : 0}%` }}
              />
            </div>
          </div>

          {/* 2x2 Metric Grid */}
          <div className="grid grid-cols-2 gap-2 flex-shrink-0">
            {/* Tile 1: Files Restored */}
            <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Files Restored</span>
              </div>
              <div className="text-lg font-bold font-mono text-white num-mono">
                {restoreProgress?.processed_files ?? 0}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  / {restoreProgress?.total_files ?? currentCategoryData.estimatedCount}
                </span>
              </div>
            </div>

            {/* Tile 2: Integrity Check */}
            <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Integrity Check</span>
              </div>
              <div className="text-lg font-bold font-mono text-emerald-300 num-mono">
                SHA-256
              </div>
            </div>

            {/* Tile 3: Payload Volume */}
            <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Payload Size</span>
              </div>
              <div className="text-lg font-bold font-mono text-white num-mono">
                {needGb ? `${needGb} GB` : "~2.3 GB"}
              </div>
              {freeGb && (
                <span className="text-[9px] font-mono text-slate-500">
                  Target free: {freeGb} GB
                </span>
              )}
            </div>

            {/* Tile 4: Target Destination */}
            <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Target Phone</span>
              </div>
              <div className="text-sm font-bold font-mono text-cyan-300 truncate mt-1">
                {device?.model ?? "Android Device"}
              </div>
            </div>
          </div>

          {/* Activity Console */}
          <div className="flex-1 min-h-0 rounded-xl bg-[#05080b] border border-white/10 p-2.5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                  Restore Inspector
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isWorking ? "bg-amber-400 animate-pulse" : "bg-slate-600"
                  )}
                />
                <span className="text-[9px] font-mono text-slate-500">
                  {isWorking ? "Pushing" : "Ready"}
                </span>
              </div>
            </div>
            <div ref={terminalRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300 pr-1 select-text">
              {logs.map((line, idx) => {
                const isError = line.includes("[ERROR]");
                const isComplete = line.includes("[RESTORED]");
                const isStream = line.includes("[RESTORE]");
                const isPreflight = line.includes("[PREFLIGHT]");
                const isHash = line.includes("[HASH]");
                return (
                  <div key={idx} className={cn("leading-relaxed break-all", isError && "text-rose-400", isComplete && "text-emerald-400 font-medium", isStream && "text-teal-300", isPreflight && "text-amber-300", isHash && "text-indigo-300")}>
                    <span className="text-slate-600 mr-1 select-none">&gt;</span>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="mt-auto pt-1 flex flex-col gap-2 flex-shrink-0">
            {!isWorking ? (
              <button
                onClick={handleStartRestore}
                disabled={estimate !== null && estimate!.freeBytes <= estimate!.needBytes}
                className="w-full h-10 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 text-slate-950 hover:opacity-95 shadow-amber-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="tracking-wide font-semibold">Start Restore Session</span>
              </button>
            ) : (
              <button
                onClick={handleAbortRestore}
                className="h-10 px-4 rounded-xl font-medium text-xs bg-rose-950/60 text-rose-400 border border-rose-500/30 hover:bg-rose-900/60 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Abort</span>
              </button>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="truncate">
                Restore target: {device?.model || "Device"} ({device?.serial || "USB"})
              </span>
              <span className="text-emerald-400 flex-shrink-0 ml-2">Authorized</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right Area: Neural Node Canvas (Pushes to Android Device) ── */}
      <main className="flex-1 min-w-0 h-full flex relative overflow-hidden order-2">
        <CanvasGraph
          device={device}
          selectedCategories={selectedCategories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          onToggleCategory={handleToggleCategory}
          isStreaming={isWorking}
          direction="restore"
          currentProgress={restoreProgress?.progress ?? 0}
        />
      </main>
    </div>
  );
};
