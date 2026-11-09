# Fallback Assessment — Post-Setup Standard Restore

## Scope
This assessment documents the fallback path that the MDTA product will pursue given the NO determination on virtual-source emulation. The fallback is fully viable and forms the core MVP deliverable.

## Backup Path (MTP/ADB)

| Step | Mechanism | Verification |
|------|-----------|--------------|
| 1 | User connects source Android phone to desktop via USB | Desktop detects device via `adb devices -l` (Tauri/Rust backend) |
| 2 | User selects backup categories (Photos, Videos, Audio, Documents, Downloads) | FR-010, FR-011 — UI presents checkboxes with category names |
| 3 | Desktop copies accessible files via MTP `read/seek/send` | FR-011 — SHA-256 checksum computed per file on-the-fly |
| 4 | Installed-app inventory collected via `adb shell pm list packages` | FR-012 — Package names and version codes recorded |
| 5 | Structured `manifest.json` generated | FR-013 — Records: path, size, checksum, timestamp, status (ok/skipped/unreadable) |
| 6 | Preflight disk-space estimate displayed | FR-022 — Warning shown if free space < estimated backup size |
| 7 | Source phone data guaranteed unchanged | FR-015 — Read-only MTP transactions; no delete/modify operations |

## Restore Path (MTP/ADB)

| Step | Mechanism | Verification |
|------|-----------|--------------|
| 1 | User connects new/destination phone to desktop via USB | Desktop detects device; checks Android version compatibility (FR-031) |
| 2 | Desktop presents backup for restore category selection | FR-030 — UI shows backup date, source, size, category coverage |
| 3 | Files copied to destination via MTP `write/receive` | FR-032 — Checksum verified on arrival; mismatches flagged (FR-035) |
| 4 | Compatible apps reinstalled with user consent | FR-033 — Explicit consent UI; reports which apps need manual re-setup (FR-034) |
| 5 | Restore report generated listing successes, partial restores, skips, failures | FR-036 — Full honesty on what was restored and what required manual action |

## Limitations & Honest Reporting

- **App-private data:** Apps that opt out of `BackupManager` or use encrypted/remote backup cannot be restored. The app reports these as "not supported" rather than silently skipping.
- **Launcher/widgets:** Launcher layout export depends on the launcher's own export feature. MDTA inventory guides manual reconstruction but does not promise exact clone (see Non-goals in PROJECT.md).
- **Encryption:** If backup was encrypted at rest, the user must provide the decryption key during restore. Key recovery warnings are displayed (FR-019).
- **Insufficient storage:** Preflight check (FR-022) prevents backup start when free space is inadequate. Same check applies to restore.

## Success Criteria Mapping

| Criterion | How Fallback Satisfies |
|-----------|----------------------|
| 2 — User warned when disk space insufficient | FR-022 preflight check displays warning before backup starts |
| 3 — Files land in user-controlled folder with manifest | Manifest stored in user-chosen location; paths, sizes, checksums, timestamps recorded (FR-013) |
| 5 — Interrupted copy resumes where safe | Chunked file transfers with on-the-fly checksums; resume logic tracks last successfully copied chunk (BAK-05, DEV-04) |

## Conclusion
The post-setup MTP/ADB fallback is technically achievable with the existing Tauri v2 + Rust ADB manager + React UI scaffold. It delivers a useful, verified backup/restore experience even without virtual-source emulation, and forms the foundation for all subsequent phases (Phase 3 onward).