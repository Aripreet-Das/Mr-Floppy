import React from "react";
import {
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AdbStatus } from "../types/device";
import { cn } from "./utils";

interface HeaderProps {
  adbStatus: AdbStatus | null;
  polling: boolean;
  onRefresh: () => void;
  mode?: "backup" | "restore";
  onModeChange: (mode: "backup" | "restore") => void;
}

export const Header: React.FC<HeaderProps> = ({
  adbStatus,
  polling,
  onRefresh,
  mode = "backup",
  onModeChange,
}) => {
  return (
    <header
      data-tauri-drag-region
      className="h-14 border-b border-white/10 bg-[#06090d]/95 backdrop-blur-xl px-4 flex items-center justify-between select-none relative z-50 flex-shrink-0"
    >
      {/* ── Left: Dedicated macOS traffic lights safe zone (160px empty drag area) ── */}
      <div data-tauri-drag-region className="w-40 min-w-[160px] h-full flex-shrink-0" />

      {/* ── Center: App Name & ADB Status with Refresh Button ── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* App Identity Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c141d]/90 border border-teal-500/30 shadow-md">
          <div className="w-5 h-5 rounded-md bg-teal-500/20 flex items-center justify-center text-teal-300 flex-shrink-0">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">Mr. Floppy</span>
          <span className="text-slate-500 text-xs">/</span>
          <span className="text-xs font-medium text-slate-300 tracking-tight">Android Migration Engine</span>
        </div>

        {/* ADB Status Badge */}
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-[#0c141d]/90 border border-white/15 text-xs font-mono text-slate-200 shadow-sm">
          {adbStatus?.found ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-emerald-300">
                {adbStatus.version ? `adb ${adbStatus.version.split(" ")[4] || "1.0.41"}` : "adb active"}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-amber-300 font-semibold">adb not found</span>
            </>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={polling}
          title="Refresh ADB connected devices"
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center bg-[#0c141d]/90 border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-sm",
            polling && "cursor-not-allowed opacity-60"
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", polling && "animate-spin text-teal-400")} />
        </button>
      </div>

      {/* ── Right: Segmented Mode Selector (Backup ↔ Restore) (160px width matches left) ── */}
      <div className="w-40 min-w-[160px] flex items-center justify-end flex-shrink-0">
        <div className="inline-flex items-center bg-[#0a1117] border border-white/15 rounded-xl p-1 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => onModeChange("backup")}
            className={cn(
              "px-3.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all active:scale-95 flex items-center gap-1.5",
              mode === "backup"
                ? "bg-teal-500/25 text-teal-200 border border-teal-400/50 shadow-sm shadow-teal-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                mode === "backup" ? "bg-teal-400 shadow-[0_0_6px_#2dd4bf]" : "bg-transparent"
              )}
            />
            <span>Backup</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange("restore")}
            className={cn(
              "px-3.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all active:scale-95 flex items-center gap-1.5",
              mode === "restore"
                ? "bg-amber-400/25 text-amber-200 border border-amber-400/50 shadow-sm shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                mode === "restore" ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]" : "bg-transparent"
              )}
            />
            <span>Restore</span>
          </button>
        </div>
      </div>
    </header>
  );
};
