import React, { useState, useEffect, useRef } from "react";
import {
  Image,
  Film,
  Music,
  FileText,
  DownloadCloud,
  Check,
  Smartphone,
  HardDrive,
  Users,
  Package,
} from "lucide-react";
import { DeviceInfo } from "../types/device";
import { cn } from "./utils";

export interface CategoryItem {
  id: string;
  name: string;
  path: string;
  icon: React.ReactNode;
  estimatedCount: number;
  note?: string;
  subNodes: { name: string; tag: string; type: "folder" | "ssd" | "hash" }[];
}

export const CATEGORIES_DATA: CategoryItem[] = [
  {
    id: "Photos",
    name: "Photos & Camera",
    path: "/sdcard/DCIM",
    icon: <Image className="w-4 h-4 text-[#38bdf8]" />,
    estimatedCount: 133,
    subNodes: [
      { name: "DCIM/Camera", tag: "124 items", type: "folder" },
      { name: "DCIM/Screenshots", tag: "9 items", type: "folder" },
      { name: "DCIM/RawCapture", tag: "Archive", type: "folder" },
      { name: "~/Backups/Mr. Floppy/DCIM", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Videos",
    name: "Movies & Recordings",
    path: "/sdcard/Movies",
    icon: <Film className="w-4 h-4 text-[#a78bfa]" />,
    estimatedCount: 12,
    subNodes: [
      { name: "Movies/ScreenRecords", tag: "8 files", type: "folder" },
      { name: "Movies/Clips", tag: "4 files", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Movies", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Audio",
    name: "Music & Audio",
    path: "/sdcard/Music",
    icon: <Music className="w-4 h-4 text-[#f472b6]" />,
    estimatedCount: 48,
    subNodes: [
      { name: "Music/Recordings", tag: "32 tracks", type: "folder" },
      { name: "Music/Audiobooks", tag: "16 files", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Music", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Documents",
    name: "Documents & PDFs",
    path: "/sdcard/Documents",
    icon: <FileText className="w-4 h-4 text-[#fb923c]" />,
    estimatedCount: 24,
    subNodes: [
      { name: "Documents/PDFs", tag: "18 files", type: "folder" },
      { name: "Documents/Work", tag: "6 files", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Documents", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Downloads",
    name: "Downloads & Files",
    path: "/sdcard/Download",
    icon: <DownloadCloud className="w-4 h-4 text-[#34d399]" />,
    estimatedCount: 32,
    subNodes: [
      { name: "Download/Browser", tag: "22 items", type: "folder" },
      { name: "Download/Telegram", tag: "10 items", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Download", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Contacts",
    name: "Contacts",
    path: "/content/com.android.contacts",
    icon: <Users className="w-4 h-4 text-[#c4b5fd]" />,
    estimatedCount: 247,
    note: "Content provider · names, phones, emails",
    subNodes: [
      { name: "Contacts Provider", tag: "Names · Phones", type: "folder" },
      { name: "VCF Export Format", tag: "vCard 3.0", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Contacts", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
  {
    id: "Apps",
    name: "Installed Apps",
    path: "/data/app",
    icon: <Package className="w-4 h-4 text-[#818cf8]" />,
    estimatedCount: 82,
    note: "APK installers · app data not extractable",
    subNodes: [
      { name: "APK Installers", tag: "82 packages", type: "folder" },
      { name: "App Metadata", tag: "Version · Size", type: "folder" },
      { name: "~/Backups/Mr. Floppy/Apps", tag: "Mac SSD", type: "ssd" },
      { name: "SHA-256 Stream Engine", tag: "Read-Only", type: "hash" },
    ],
  },
];

interface CanvasGraphProps {
  device: DeviceInfo | null;
  selectedCategories: string[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
  onToggleCategory: (id: string) => void;
  isStreaming: boolean;
  direction?: "backup" | "restore";
  currentProgress?: number;
}

export const CanvasGraph: React.FC<CanvasGraphProps> = ({
  device,
  selectedCategories,
  activeCategory,
  onSelectCategory,
  onToggleCategory,
  isStreaming,
  direction = "backup",
  currentProgress = 0,
}) => {
  const isRestore = direction === "restore";

  // No device connected — show an honest empty state
  if (!device) {
    return (
      <div className="relative flex-1 h-full w-full min-w-0 overflow-hidden select-none flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-[#0a1217]/60 border border-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Smartphone className="w-10 h-10 text-slate-500" />
          </div>
          <h3 className="text-white font-semibold mb-1">No device connected</h3>
          <p className="text-slate-500 text-sm font-mono">
            Plug in your Android phone via USB and authorize ADB debugging.
          </p>
        </div>
      </div>
    );
  }

  // Canvas Stage Geometry (unified coordinate space)
  const svgWidth = 680;
  const svgHeight = 520;

  // Category Nodes Vertical Distribution (7 categories)
  const catNodeHeight = 50;
  const catSpacing = 58;
  const catYPositions = CATEGORIES_DATA.map((_, i) => 75 + i * catSpacing);

  // Phone Y is centered to the middle category (Documents at i=3)
  const phoneAttachY = catYPositions[3]; // 249px

  // Column Positions:
  // Backup:  Phone (left: 25px) -> Categories (left: 255px) -> Leaf (left: 490px)
  // Restore: Leaf (left: 20px)  -> Categories (left: 250px) -> Phone (left: 485px)
  const phoneAttachX = isRestore ? 485 : 195;
  const phoneBoxLeft = isRestore ? 485 : 25;

  const catAttachLeftX = isRestore ? 250 : 255;
  const catAttachRightX = isRestore ? 425 : 430;
  const catBoxLeft = isRestore ? 250 : 255;

  const leafAttachX = isRestore ? 190 : 490;
  const leafBoxLeft = isRestore ? 20 : 490;

  const activeCatIndex = CATEGORIES_DATA.findIndex((c) => c.id === activeCategory);
  const activeItem = CATEGORIES_DATA[activeCatIndex >= 0 ? activeCatIndex : 0];
  const activeY = catYPositions[activeCatIndex >= 0 ? activeCatIndex : 0];

  // Leaf subnodes fan-out calculations
  const leafCount = activeItem.subNodes.length;
  const leafSpacing = 38;
  const leafStartY = Math.max(60, activeY - ((leafCount - 1) * leafSpacing) / 2);

  // Stage scaling
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setScale(Math.min(1, width / svgWidth, height / svgHeight));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgWidth, svgHeight]);

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 h-full w-full min-w-0 overflow-hidden select-none flex items-center justify-center"
    >
      <div
        className="relative flex-shrink-0"
        style={{
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* ── Dynamic SVG Connection Fibers ── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <defs>
            <linearGradient id="tealGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="1" />
            </linearGradient>

            <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ── Fibers: Backup Mode (Phone -> Categories -> Leaf) ── */}
          {!isRestore && (
            <>
              {/* Phone -> Category */}
              {CATEGORIES_DATA.map((cat, idx) => {
                const targetY = catYPositions[idx];
                const isSelected = selectedCategories.includes(cat.id);
                const isActive = cat.id === activeCategory;
                const isActivelyStreaming = isStreaming && isSelected;

                const x1 = phoneAttachX; // 195
                const y1 = phoneAttachY; // 249
                const x2 = catAttachLeftX; // 255
                const y2 = targetY;
                const dx = x2 - x1; // 60
                const cx1 = x1 + dx * 0.45;
                const cx2 = x2 - dx * 0.45;
                const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={`fiber-phone-${cat.id}`}
                    d={pathD}
                    className={cn(
                      "fiber-line",
                      isActive && "active",
                      isActivelyStreaming && "streaming"
                    )}
                    style={{
                      stroke: isActive
                        ? "url(#goldGradient)"
                        : isSelected
                        ? "rgba(45, 212, 191, 0.45)"
                        : "rgba(255, 255, 255, 0.08)",
                      strokeWidth: isActive ? 2.4 : isSelected ? 1.75 : 1,
                    }}
                  />
                );
              })}

              {/* Category -> Leaf */}
              {activeItem.subNodes.map((_, leafIdx) => {
                const leafY = leafStartY + leafIdx * leafSpacing;
                const x1 = catAttachRightX; // 430
                const y1 = activeY;
                const x2 = leafAttachX; // 490
                const y2 = leafY;
                const dx = x2 - x1; // 60
                const cx1 = x1 + dx * 0.45;
                const cx2 = x2 - dx * 0.45;
                const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={`fiber-leaf-${leafIdx}`}
                    d={pathD}
                    className={cn("fiber-line", isStreaming ? "streaming" : "active")}
                    style={{
                      stroke: isStreaming
                        ? "url(#tealGradient)"
                        : "rgba(251, 191, 36, 0.45)",
                      strokeWidth: 1.5,
                    }}
                  />
                );
              })}
            </>
          )}

          {/* ── Fibers: Restore Mode (Leaf -> Categories -> Phone) ── */}
          {isRestore && (
            <>
              {/* Leaf -> Category */}
              {activeItem.subNodes.map((_, leafIdx) => {
                const leafY = leafStartY + leafIdx * leafSpacing;
                const x1 = leafAttachX; // 190
                const y1 = leafY;
                const x2 = catAttachLeftX; // 250
                const y2 = activeY;
                const dx = x2 - x1; // 60
                const cx1 = x1 + dx * 0.45;
                const cx2 = x2 - dx * 0.45;
                const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={`fiber-restore-leaf-${leafIdx}`}
                    d={pathD}
                    className={cn("fiber-line", isStreaming ? "streaming" : "active")}
                    style={{
                      stroke: isStreaming
                        ? "url(#tealGradient)"
                        : "rgba(251, 191, 36, 0.45)",
                      strokeWidth: 1.5,
                    }}
                  />
                );
              })}

              {/* Category -> Phone */}
              {CATEGORIES_DATA.map((cat, idx) => {
                const targetY = catYPositions[idx];
                const isSelected = selectedCategories.includes(cat.id);
                const isActive = cat.id === activeCategory;
                const isActivelyStreaming = isStreaming && isSelected;

                const x1 = catAttachRightX; // 425
                const y1 = targetY;
                const x2 = phoneAttachX; // 485
                const y2 = phoneAttachY; // 249
                const dx = x2 - x1; // 60
                const cx1 = x1 + dx * 0.45;
                const cx2 = x2 - dx * 0.45;
                const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={`fiber-restore-phone-${cat.id}`}
                    d={pathD}
                    className={cn(
                      "fiber-line",
                      isActive && "active",
                      isActivelyStreaming && "streaming"
                    )}
                    style={{
                      stroke: isActive
                        ? "url(#goldGradient)"
                        : isSelected
                        ? "rgba(245, 158, 11, 0.45)"
                        : "rgba(255, 255, 255, 0.08)",
                      strokeWidth: isActive ? 2.4 : isSelected ? 1.75 : 1,
                    }}
                  />
                );
              })}
            </>
          )}
        </svg>

        {/* ── Node Layer: Canvas Elements in 3 Tiers ── */}
        <div className="relative z-10 w-full h-full flex items-center pointer-events-auto">
          {/* ── TIER: Phone Root Node ── */}
          <div
            className="absolute flex flex-col items-center justify-center text-center transition-all duration-300"
            style={{ left: `${phoneBoxLeft}px`, top: `${phoneAttachY - 72}px`, width: "170px" }}
          >
            {/* Outer Atmospheric Disc */}
            <div className="relative w-36 h-36 rounded-full flex items-center justify-center p-2">
              <div className="absolute inset-0 rounded-full bg-[#0a1217]/70 border border-white/10 shadow-2xl backdrop-blur-md" />
              <div className="particle-ring absolute inset-1 rounded-full border border-teal-500/20 border-dashed" />
              <div className="phone-orb orb-float relative w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Smartphone className="w-7 h-7 text-white drop-shadow-md stroke-[2]" />
              </div>
            </div>

            {/* Phone Identity Label & Specs */}
            <div className="mt-2.5 flex flex-col items-center">
              <span className="font-semibold text-[13px] text-white tracking-tight">
                {device.model}
              </span>
              <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider mt-0.5">
                {`${device.manufacturer} · Android ${device.android_version || "15"}`}
              </span>

              {/* Progress & Storage Pills */}
              <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-center">
                <div className="px-2 py-0.5 rounded-full bg-amber-900/60 border border-amber-500/40 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                  <HardDrive className="w-2.5 h-2.5" />
                  <span>
                    {currentProgress * 100 > 0 && currentProgress * 100 < 1
                      ? (currentProgress * 100).toFixed(1)
                      : Math.round(currentProgress * 100)}
                    %
                  </span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono flex items-center gap-1">
                  <HardDrive className="w-2.5 h-2.5" />
                  <span>{device.storage_free_gb ?? "?"}G Free</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── TIER: Category Nodes Column ── */}
          <div
            className="absolute inset-x-0 top-0 transition-all duration-300"
            style={{ left: `${catBoxLeft}px`, width: "175px", height: `${svgHeight}px` }}
          >
            {CATEGORIES_DATA.map((cat, idx) => {
              const isSelected = selectedCategories.includes(cat.id);
              const isActive = cat.id === activeCategory;

              return (
                <div
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${catYPositions[idx] - catNodeHeight / 2}px`,
                    height: `${catNodeHeight}px`,
                    animationDelay: `${idx * 0.08}s`,
                  }}
                  className={cn(
                    "glass-node px-3 rounded-xl flex items-center justify-between cursor-pointer group category-enter",
                    isActive && "node-glow active-gold",
                    !isActive && isSelected && "border-teal-500/30 bg-[#0d1a22]/80"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                        isActive
                          ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                          : "bg-white/5 border border-white/10 text-slate-300"
                      )}
                    >
                      {cat.icon}
                    </div>
                    <div className="min-w-0 text-left">
                      <div
                        className={cn(
                          "text-[12px] font-semibold tracking-tight truncate",
                          isActive ? "text-amber-200" : "text-slate-200"
                        )}
                      >
                        {cat.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {cat.estimatedCount} items
                      </div>
                      {cat.note && (
                        <div className="text-[9px] text-slate-500/70 font-mono mt-0.5 truncate">
                          {cat.note}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inclusion Checkbox Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCategory(cat.id);
                    }}
                    title={isSelected ? "Deselect category" : "Select category"}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 flex-shrink-0 ml-1.5",
                      isSelected
                        ? "bg-teal-400 border-teal-400 text-slate-950 shadow-sm shadow-teal-500/50"
                        : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── TIER: Leaf Sub-Nodes Fan-Out ── */}
          <div
            className="absolute flex flex-col gap-2.5 pointer-events-auto transition-all duration-300"
            style={{ left: `${leafBoxLeft}px`, top: `${leafStartY - 14}px`, width: "170px" }}
          >
            {activeItem.subNodes.map((sub, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 h-7 rounded-lg bg-[#0a1117]/85 border border-white/10 backdrop-blur-md shadow-md text-xs hover:border-white/20 transition-all"
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    sub.type === "ssd"
                      ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                      : sub.type === "hash"
                      ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                      : "bg-teal-400 shadow-[0_0_6px_#2dd4bf]"
                  )}
                />
                <span className="font-mono text-[11px] text-slate-300 truncate flex-1 text-left">
                  {sub.name}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-slate-400 flex-shrink-0">
                  {sub.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
