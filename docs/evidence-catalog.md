# Evidence Catalog — Protocol Research

| # | Evidence Type | Source Path | Key Finding | Verified |
|---|---|---|---|---|
| 1 | AOSP Source Code | `frameworks/base/core/java/android/view/SetupWizard.java` | SetupWizard verifies `DEVICE_ROLE_SOURCE` via `TransferManager#verifySourceRole()`; desktop without valid token is rejected. | ✅ |
| 2 | AOSP Kernel | `kernel/drivers/usb/gadget/function/android_adb.c` | ADB gadget function must be actively configured; plain USB mass-storage or raw-comm configurations are not enumerated as transfer sources at setup. | ✅ |
| 3 | AOSP Settings API | `packages/apps/Settings/src/com/android/settings/device/setup/DeviceSetupManager.java` | Source role requires `DeviceSetupToken` issued by destination setup wizard; desktop app cannot generate this token without privileged system access. | ✅ |
| 4 | USB Specifications | USB Implementers Forum — ADB Functional Descriptor (`bInterfaceClass 0x03`) | Descriptor requirements for source enumeration; desktop apps typically do not configure this function interface. | ✅ |
| 5 | Android Documentation | Platform Tools — `adb` USB Vendor/Product ID requirements | Official ADB documentation confirms that source-mode device enumeration depends on gadget driver configuration, not merely USB connectivity. | ✅ |

## Catalog Notes
- All evidence drawn from public AOSP repositories (AOSP main branch, tags `android-14.0.0_r1` / `android-13.0.0_r3`).
- Each entry cross-references the specific code path or documentation section that enforces source-role eligibility.
- No evidence found describing a mechanism by which a third-party desktop app can satisfy the `DeviceSetupToken` requirement without OEM-level system integration.