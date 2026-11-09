# Test Matrix Specification

## Go/No-Go Decision Reference
**Decision:** NO — virtual-source emulation is blocked (proprietary protocol + authentication barriers). Fallback: post-setup standard restore via MTP/ADB.

The test matrix below is executed to validate the **post-setup backup/restore path** (MTP/ADB), not the virtual-source hypothesis. Each row records whether the destination recognizes the desktop as a source, but the go/no-go determination (NO) means no rows are expected to pass the virtual-source recognition gate. All rows focus on backup completeness, integrity, and restore eligibility.

## 12 Matrix Fields (per PRD §12 and FR-043)

| Field | Description | Example |
|-------|---|---|
| **1. Source Model** | Android model identifier of the phone being backed up | `Realme 11 Pro+ 5G` |
| **2. Destination Model** | Android model identifier of the receiving phone | `Samsung Galaxy S25` |
| **3. Manufacturer** | OEM brand name | `Realme / Samsung` |
| **4. Android Version** | OS release version on source/destination | `Realme: RMX3031 Android 13` / `Samsung: S25 Android 14` |
| **5. Setup State** | Whether destination is at initial setup or already configured | `initial-setup` / `configured` |
| **6. USB Cable/Connection Mode** | Cable type and USB role/function | `USB-A to USB-C, MTP mode` |
| **7. Permissions & User Actions** | User-granted permissions and on-device actions | `USB debugging authorized`, `File transfer permitted` |
| **8. Backup Category** | Data categories selected for backup | `Photos, Videos, Audio, Documents, Downloads` |
| **9. Data Size** | Estimated total size of selected categories | `~45 GB` |
| **10. Destination Recognizes Source** | Whether the destination natively identifies the desktop as a transfer source | `NO` (expected per feasibility decision) |
| **11. Data Transferred & Verified** | Whether files were copied successfully and checksums match | `YES — 42/45 GB verified; 3 GB skipped (unsupported categories)` |
| **12. Error Conditions & Recovery** | Behavior on disconnect, insufficient storage, locked phone, canceled operation | `Disconnect mid-copy: resume on reconnect (BAK-05)` / `Insufficient space: preflight warning (FR-022)` |

## Go/No-Go Execution Rule
- **If** the go/no-go decision is **YES** (virtual-source supported): Matrix includes a dedicated "Virtual-Source Recognition" column; rows aim to confirm that the destination's setup-time flow accepts the desktop as a source peer.
- **If** the go/no-go decision is **NO** (virtual-source blocked, as determined in Phase 1): Matrix executes only the **post-setup backup/restore** sub-matrix. The "Destination Recognizes Source" field (Field 10) is expected to be `NO` for all rows. Success is defined by Fields 11 and 12 (data integrity and error recovery), not by source recognition.

## Required Scenarios (per PRD §12)

| Scenario | Matrix Fields Covered |
|---|---|
| Normal backup and restore | All 12 fields |
| Large file transfer | Fields 8, 9, 11, 12 |
| Duplicate filenames and directory structures | Fields 8, 11, 12 |
| Insufficient disk space | Fields 5, 9, 12 |
| USB disconnection mid-transfer | Fields 6, 12 |
| Locked phone or missing authorization | Fields 7, 12 |
| Unsupported file or app category | Fields 8, 11 (status = unsupported) |
| Destination with incompatible Android version | Fields 4, 10, 12 |
| Corrupt or incomplete backup manifest | Fields 3, 11 (checksum mismatch) |
| User cancellation and safe resume | Fields 6, 12 |
| Source phone data non-destructive guarantee | Field 12 (status = source_unchanged) |

## Success Criterion 4 Mapping
**Success criterion 4** (App verifies copied files with checksums and flags unreadable, skipped, or changed items) is satisfied by Matrix Field 11 (Data Transferred & Verified) and Field 12 (Error Conditions & Recovery). Each test row records per-item checksum status, and any item that fails verification or is flagged as unreadable/skipped is explicitly reported — the app never silently ignores verification failures.

## Summary
The test matrix provides a structured framework for validating the MTP/ADB backup/restore path. With the Phase 1 go/no-go decision set to NO, the matrix ensures that all subsequent development (Phases 3–7) operates from a confirmed baseline: the desktop app is a reliable backup/restore intermediary, but not a virtual migration source at setup time.