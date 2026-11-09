export type DeviceConnectionStatus = "Unauthorized" | "Device" | "Offline" | "Disconnected";

export interface DeviceInfo {
  serial: string;
  status: DeviceConnectionStatus;
  model?: string | null;
  manufacturer?: string | null;
  android_version?: string | null;
  sdk_version?: string | null;
  battery_level?: number | null;
  storage_free_gb?: number | null;
  storage_total_gb?: number | null;
}

export interface AdbStatus {
  found: boolean;
  path?: string | null;
  version?: string | null;
}

