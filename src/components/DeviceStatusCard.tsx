import React from "react";
import { Smartphone, Battery, HardDrive, Cpu, CheckCircle2, AlertCircle, Usb } from "lucide-react";
import { DeviceInfo } from "../types/device";

interface DeviceStatusCardProps {
  device: DeviceInfo;
}

export const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({ device }) => {
  const isAuthorized = device.status === "Device";
  const isUnauthorized = device.status === "Unauthorized";

  return (
    <div className="h-12 bg-[#10131b] border-b border-[#1c212e] px-4 flex items-center justify-between gap-4 select-none flex-shrink-0">
      {/* Left: Device Identity */}
      <div className="flex items-center gap-2.5 min-w-[220px]">
        <div className="w-7 h-7 rounded bg-[#171b26] border border-[#23293a] flex items-center justify-center text-[#38bdf8] flex-shrink-0">
          <Smartphone className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-xs text-[#ededf0] tracking-tight">
            {device.model || "Android Device"}
          </span>
          {device.manufacturer && (
            <span className="text-[10px] uppercase font-mono text-[#576071]">
              {device.manufacturer}
            </span>
          )}
          <span className="text-[10px] font-mono text-[#3e4554]">
            ({device.serial})
          </span>
        </div>
      </div>

      {/* Middle Specs Grid */}
      <div className="flex items-center gap-4 text-xs">
        {/* OS & API */}
        {device.android_version && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#9aa2b1]">
            <Cpu className="w-3 h-3 text-[#576071]" />
            <span>Android {device.android_version}</span>
            {device.sdk_version && <span className="text-[#576071]">API {device.sdk_version}</span>}
          </div>
        )}

        <span className="text-[#202534]">·</span>

        {/* Battery */}
        {device.battery_level !== null && device.battery_level !== undefined && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#9aa2b1]">
            <Battery className="w-3.5 h-3.5 text-[#10b981]" />
            <span>{device.battery_level}%</span>
          </div>
        )}

        <span className="text-[#202534]">·</span>

        {/* Storage */}
        {device.storage_free_gb !== null && device.storage_free_gb !== undefined && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#9aa2b1]">
            <HardDrive className="w-3 h-3 text-[#38bdf8]" />
            <span>{device.storage_free_gb} GB free</span>
            {device.storage_total_gb ? <span className="text-[#576071]">/ {device.storage_total_gb} GB</span> : null}
          </div>
        )}
      </div>

      {/* Right: Authorization Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isAuthorized ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0d221b] border border-[#134435] text-[#10b981] text-[11px] font-mono font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Authorized</span>
          </div>
        ) : isUnauthorized ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#27190b] border border-[#482e14] text-[#f59e0b] text-[11px] font-mono font-medium">
            <AlertCircle className="w-3 h-3" />
            <span>Unauthorized</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#151924] border border-[#202636] text-[#9aa2b1] text-[11px] font-mono">
            <span className="status-dot status-dot-muted" />
            <span>{device.status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const DeviceStatusEmpty: React.FC = () => {
  return (
    <div className="h-12 bg-[#10131b] border-b border-[#1c212e] px-4 flex items-center justify-between select-none flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-[#151822] border border-[#1f2433] flex items-center justify-center text-[#576071]">
          <Usb className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs text-[#9aa2b1]">
          No phone connected — connect via USB with USB Debugging enabled
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#576071]">
        <span className="status-dot status-dot-amber" />
        <span>Scanning USB bus...</span>
      </div>
    </div>
  );
};
