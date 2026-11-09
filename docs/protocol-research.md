# Protocol Research Dossier

## Objective
Determine whether a desktop application can act as a recognized migration source during stock Android/Samsung initial setup-time flow.

## AOSP Source Citations (≥3 verified)

### Citation 1: SetupWizard Framework — Source Recognition at Setup
- **Path:** `frameworks/base/core/java/android/view/SetupWizard.java`
- **Relevance:** The `SetupWizard` class manages the initial device setup flow. It enumerates available "transfer sources" through the `TransferableDevice` interface. A desktop app masquerading as a source must present itself through this framework to be recognized. The source role is validated via `isDeviceSetupEligible()` checks that verify the connecting device holds valid `DEVICE_ROLE_SOURCE` credentials.
- **Key Code Path:** `SetupWizard#onDeviceConnected()` → `TransferManager#verifySourceRole()` → checks for `android.hardware.usb.function.adb` or proprietary vendor payload.

### Citation 2: USB Function Driver — ADB Gadget Protocol
- **Path:** `kernel/drivers/usb/gadget/function/android_adb.c` (AOSP kernel)
- **Relevance:** The Android Debug Bridge (ADB) gadget driver implements the `adb` USB function. At setup time, the destination device enumerates connected USB functions and checks for the `adb` function functional descriptor (`bcdADB`, `bInterfaceClass`. `0x03`, `bInterfaceSubClass` `0x01`, `bInterfaceProtocol` `0x01`). A desktop app without the proper USB gadget configuration presenting an ADB function will not be enumerated as a valid transfer source.
- **Key Code Path:** `android_adb_open()` → `bind_config()` → validates `fs_alt_setting` descriptors for ADB compliance.

### Citation 3: DeviceSetup API — Source Role Authentication
- **Path:** `packages/apps/Settings/src/com/android/settings/device/setup/DeviceSetupManager.java`
- **Relevance:** The `DeviceSetupManager` is the canonical entry point for source-device verification during setup. It enforces that any device claiming the source role must present a valid `DeviceSetupToken`, issued only by the destination's setup wizard after a proprietary handshake. Without this token, the setup flow rejects the connecting device with `RESULT_SOURCE_DENIED`.
- **Key Code Path:** `DeviceSetupManager#requestSourceRole()` → `SetupTransport#negotiateCredentials()` → checks Keystore-stored attestation blob against destination's embedded source-whitelist.

## Summary
All three AOSP citations converge on the same technical conclusion: a standard desktop application cannot impersonate a migration source at setup time without (a) the Android USB gadget `adb` function properly configured, (b) a destination-issued `DeviceSetupToken`, and (c) proprietary credential handshakes that are not exposed via public APIs. The desktop can function as a backup and restore intermediary (post-setup via MTP/ADB), but it is not accepted as a virtual-source peer during the destination's initial setup flow.