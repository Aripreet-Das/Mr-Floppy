import React from "react";
import { DeviceInfo } from "../types/device";
import { DeviceStatusCard, DeviceStatusEmpty } from "./DeviceStatusCard";
import { AuthorizationGuide } from "./AuthorizationGuide";

interface DeviceWizardProps {
  devices: DeviceInfo[];
  polling: boolean;
  onRefresh: () => void;
}

export const DeviceWizard: React.FC<DeviceWizardProps> = ({ devices }) => {
  const activeDevice = devices.length > 0 ? devices[0] : null;
  const isUnauthorized = activeDevice?.status === "Unauthorized";

  return (
    <div className="flex-shrink-0">
      {activeDevice ? (
        <DeviceStatusCard device={activeDevice} />
      ) : (
        <DeviceStatusEmpty />
      )}

      {isUnauthorized && <AuthorizationGuide />}
    </div>
  );
};
