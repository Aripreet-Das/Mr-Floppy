import React, { useRef, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  Terminal,
  Sparkles,
  Database,
} from "lucide-react";
import { DotMatrixEqualizer } from "./DotMatrixEqualizer";
import { CategoryItem } from "./CanvasGraph";
import { cn } from "./utils";

interface InspectorPanelProps {
  category: CategoryItem;
  progress?: {
    progress: number;
    current_file?: string | null;
    status: string;
    bytes_transferred?: number;
    total_files?: number;
    processed_files?: number;
  } | null;
  logs: string[];
  isWorking: boolean;
  isPaused: boolean;
  estimating: boolean;
  estimate: { needBytes: number; freeBytes: number } | null;
  onEstimate: () => void;
  onStartBackup: () => void;
  onTogglePause: () => void;
  onCancel: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  category,
  progress,
  logs,
  isWorking,
  isPaused,
  estimating,
  estimate,
  onEstimate,
  onStartBackup,
  onTogglePause,
  onCancel,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const rawPercent = progress ? progress.progress * 100 : 0;
  const percentDisplay = progress
    ? rawPercent > 0 && rawPercent < 1
      ? rawPercent.toFixed(1)
      : Math.round(rawPercent).toString()
    : "0";
  const progressWidth = Math.min(100, Math.max(rawPercent > 0 ? 0.8 : 0, rawPercent));

  const transferredMb = progress?.bytes_transferred
    ? (progress.bytes_transferred / (1024 * 1024)).toFixed(1)
    : "0.0";

  const needGb = estimate ? (estimate.needBytes / (1024 * 1024 * 1024)).toFixed(2) : null;
  const freeGb = estimate ? (estimate.freeBytes / (1024 * 1024 * 1024)).toFixed(2) : null;
  const hasSpace = estimate ? estimate.freeBytes > estimate.needBytes : true;

  return (
    <aside className="w-[410px] min-w-[410px] h-full flex-shrink-0 flex flex-col p-4 z-20 overflow-hidden">
      {/* ── Floating Obsidian Inspector Card ── */}
      <div className="glass-panel flex-1 min-h-0 rounded-2xl p-4 flex flex-col gap-3.5 shadow-2xl relative overflow-hidden">
        {/* Subtle warm amber ambient radial highlight in top corner */}
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        {/* ── Section 1: Header & Category Identity ── */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                {category.icon}
              </div>
              <span className="text-xs font-semibold text-slate-300 tracking-tight">
                {category.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-mono border",
                  isWorking
                    ? "bg-teal-950/70 border-teal-500/40 text-teal-400"
                    : "bg-slate-900/60 border-white/10 text-slate-400"
                )}
              >
                {isWorking ? (isPaused ? "Paused" : "Active Stream") : "Ready"}
              </span>

              <button
                onClick={onEstimate}
                disabled={estimating || isWorking}
                title="Run Pre-Flight Space Check"
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1 transition-all active:scale-95"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                <span>{estimating ? "Checking..." : "Pre-flight"}</span>
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-white tracking-tight leading-snug">
            {category.path}
            <span className="text-slate-500 mx-1.5 font-normal">→</span>
            <span className="text-teal-400 font-mono text-xs">~/Backups/Mr. Floppy</span>
          </h3>

          <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span>SHA-256 On-the-fly verify · Zero phone writes</span>
          </p>
        </div>

        {/* ── Section 2: Progress & Dot-Matrix Waveform Card (Inspiration Match) ── */}
        <div className="rounded-xl bg-[#070c10]/90 border border-white/10 p-3 flex flex-col gap-2 flex-shrink-0 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Transfer Progress
            </span>
            <span className="text-[10px] font-mono text-teal-400 px-1.5 py-0.2 rounded bg-teal-950/40 border border-teal-500/20">
              {isWorking ? "Live adb exec-out" : "Indexed"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            {/* Big percentage & metrics */}
            <div className="flex flex-col">
              <div className="flex items-baseline">
                <span className="text-3xl font-bold font-mono text-white tracking-tight num-mono">
                  {percentDisplay}
                </span>
                <span className="text-sm font-normal text-slate-500 ml-0.5">%</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 mt-0.5">
                {progress?.processed_files ?? 0} / {progress?.total_files && progress.total_files > 0 ? progress.total_files : category.estimatedCount} files · {transferredMb} MB
              </span>
            </div>

            {/* Dot-Matrix Waveform Equalizer */}
            <div className="flex items-center">
              <DotMatrixEqualizer
                isStreaming={isWorking && !isPaused}
                progress={progress?.progress ?? 0}
              />
            </div>
          </div>

          {/* Active Streaming File Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/5 text-[10px] font-mono">
            <span className="text-slate-500 uppercase tracking-wider text-[9px] flex-shrink-0">
              Active:
            </span>
            <span className="text-teal-300 truncate flex-1 font-mono">
              {progress?.current_file
                ? progress.current_file
                : isWorking
                ? "Indexing files on device..."
                : "Idle"}
            </span>
          </div>

          {/* Linear bar underneath */}
          <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden mt-0.5">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-150 ease-out"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>

        {/* ── Section 3: 2x2 Metric Tiles (Matching Inspiration Grid) ── */}
        <div className="grid grid-cols-2 gap-2 flex-shrink-0">
          {/* Tile 1: Copied Files */}
          <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[10px] uppercase font-mono tracking-wider">Files Transferred</span>
            </div>
            <div className="text-lg font-bold font-mono text-white num-mono">
              {progress?.processed_files ?? 0}
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {progress?.total_files && progress.total_files > 0 ? progress.total_files : category.estimatedCount}
              </span>
            </div>
          </div>

          {/* Tile 2: Verified Hashes */}
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
              <span className="text-[10px] uppercase font-mono tracking-wider">Storage Needed</span>
            </div>
            <div className="text-lg font-bold font-mono text-white num-mono">
              {needGb ? `${needGb} GB` : "~2.3 GB"}
            </div>
            {freeGb && (
              <span className="text-[9px] font-mono text-slate-500">
                Mac free: {freeGb} GB
              </span>
            )}
          </div>

          {/* Tile 4: Source Safety */}
          <div className="rounded-xl bg-[#080d12]/75 border border-white/5 p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] uppercase font-mono tracking-wider">Safety Guarantee</span>
            </div>
            <div className="text-lg font-bold font-mono text-cyan-300 num-mono">
              Read-Only
            </div>
          </div>
        </div>

        {/* ── Section 4: Live Activity Console ── */}
        <div className="flex-1 min-h-0 rounded-xl bg-[#05080b] border border-white/10 p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                Session Inspector
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isWorking ? "bg-teal-400 animate-pulse" : "bg-slate-600"
                )}
              />
              <span className="text-[9px] font-mono text-slate-500">
                {isWorking ? "Streaming" : "Ready"}
              </span>
            </div>
          </div>

          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300 pr-1 select-text"
          >
            {logs.map((line, idx) => {
              const isError = line.includes("[ERROR]");
              const isComplete = line.includes("[COMPLETE]");
              const isStream = line.includes("[STREAM]");
              const isPreflight = line.includes("[PREFLIGHT]");
              const isHash = line.includes("[HASH]");

              return (
                <div
                  key={idx}
                  className={cn(
                    "leading-relaxed break-all",
                    isError && "text-rose-400",
                    isComplete && "text-emerald-400 font-medium",
                    isStream && "text-teal-300",
                    isPreflight && "text-amber-300",
                    isHash && "text-indigo-300"
                  )}
                >
                  <span className="text-slate-600 mr-1 select-none">&gt;</span>
                  {line}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 5: Bottom Floating Action Capsule (Matching Inspiration) ── */}
        <div className="mt-auto pt-1 flex flex-col gap-2 flex-shrink-0">
          {!isWorking ? (
            <button
              onClick={onStartBackup}
              disabled={estimate !== null && !hasSpace}
              className={cn(
                "w-full h-10 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]",
                "bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 text-slate-950 hover:opacity-95 shadow-amber-500/20",
                estimate !== null && !hasSpace && "opacity-40 cursor-not-allowed"
              )}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="tracking-wide font-semibold">Start Migration Session</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePause}
                className={cn(
                  "flex-1 h-10 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 border transition-all active:scale-[0.98]",
                  isPaused
                    ? "bg-emerald-500 text-slate-950 border-emerald-400"
                    : "bg-[#141b22] text-amber-400 border-amber-500/30 hover:bg-[#1c2630]"
                )}
              >
                {isPaused ? <RotateCcw className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>

              <button
                onClick={onCancel}
                className="h-10 px-4 rounded-xl font-medium text-xs bg-rose-950/60 text-rose-400 border border-rose-500/30 hover:bg-rose-900/60 flex items-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Abort</span>
              </button>
            </div>
          )}

          {/* Destination Path Pill */}
          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="truncate">SSD: /Users/aripreetdas/Backups/MrFloppy</span>
            <span className="text-teal-400 flex-shrink-0 ml-2">Verified</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
