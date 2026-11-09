# Requirements: MDTA — Mobile Data Transfer App

**Defined:** 2026-10-27
**Core Value:** A user can hand over their old phone and still get their data back — because a verified local backup existed before the trade-in.
**Source:** `MDTA_PRD.md` (Draft v1.0) — every requirement ID below traces to a PRD functional requirement.

## v1 Requirements

Requirements for the initial release (MVP 0–MVP 2 path plus the gated MVP 3 virtual-source work). Each maps to exactly one roadmap phase.

### Device Connection and Identification

- [x] **DEV-01**: User connects a supported Android device over USB and the app detects it (PRD FR-001) — *Completed in Phase 2*
- [x] **DEV-02**: User sees live connection state and receives guided authorization instructions explaining why each permission is needed (PRD FR-002) — *Completed in Phase 2*
- [x] **DEV-03**: User sees the connected device's model, manufacturer, Android version, and other available non-sensitive metadata (PRD FR-003) — *Completed in Phase 2*
- [x] **DEV-04**: Device disconnects and reconnects mid-operation without corrupting the backup (PRD FR-004) — *Completed in Phase 2*

### Backup

- [ ] **BAK-01**: User selects which supported backup categories to include (PRD FR-010)
- [ ] **BAK-02**: App copies user-accessible photos, videos, audio, documents, and other accessible files from the device (PRD FR-011)
- [ ] **BAK-03**: App generates an installed-app inventory with package identifiers and available version metadata where supported (PRD FR-012)
- [ ] **BAK-04**: App stores a structured backup manifest with item paths/identifiers, byte sizes, checksums where applicable, timestamps where available, and per-item status (PRD FR-013)
- [ ] **BAK-05**: Interrupted file-copy operations resume where safe (PRD FR-014)
- [ ] **BAK-06**: App verifies copied files and flags unreadable, skipped, or changed items (PRD FR-015)
- [ ] **BAK-07**: Backup never deletes or modifies original source data on the phone (PRD FR-016)
- [ ] **BAK-08**: App captures supported settings and launcher information where accessible (PRD FR-017)
- [ ] **BAK-09**: App supports incremental backups to avoid recopying unchanged files (PRD FR-018)
- [ ] **BAK-10**: App supports optional encryption for the local backup with clear key-recovery warnings (PRD FR-019)

### Backup Library

- [ ] **LIB-01**: User can name and browse backups (PRD FR-020)
- [ ] **LIB-02**: User sees each backup's date, source device, size, verification status, and category coverage (PRD FR-021)
- [ ] **LIB-03**: App warns the user before starting a backup when free disk space is insufficient (PRD FR-022)
- [ ] **LIB-04**: App never labels a backup "complete" when required operations failed or categories were unavailable (PRD FR-023)
- [ ] **LIB-05**: User can export, move, or copy a backup folder while its manifest and integrity information are preserved (PRD FR-024)

### Restore

- [ ] **RST-01**: App detects a supported destination device (PRD FR-030)
- [ ] **RST-02**: App checks backup compatibility with the destination device and Android version where possible (PRD FR-031)
- [ ] **RST-03**: App restores supported user files to user-accessible destinations on the device (PRD FR-032)
- [ ] **RST-04**: App reinstalls compatible apps only through permitted installation paths and with explicit user consent (PRD FR-033)
- [ ] **RST-05**: App clearly marks app data, settings, permissions, and launcher elements that require manual setup or cannot be restored (PRD FR-034)
- [ ] **RST-06**: App verifies restored files using checksums where applicable (PRD FR-035)
- [ ] **RST-07**: App produces a restore report listing successes, partial restores, skips, and failures (PRD FR-036)
- [ ] **RST-08**: App provides guided steps for recreating supported launcher and home-screen settings (PRD FR-037)
- [ ] **RST-09**: Interrupted restore operations resume safely (PRD FR-038)

### Virtual Migration Source

- [x] **VMS-01**: The target Android setup-time migration protocol is documented using public source code and official documentation (PRD FR-040) — *Completed in Phase 1*
- [x] **VMS-02**: A written determination states whether a desktop application can legally and technically implement the source role accepted by a stock Android/Samsung destination (PRD FR-041) — *Completed in Phase 1 (NO)*
- [ ] **VMS-03**: An isolated, narrowly scoped proof of concept exists for the virtual-source path before committing to the architecture (PRD FR-042)
- [ ] **VMS-04**: Virtual-source behaviour is tested on real hardware with the exact device model, OS version, setup state, cable, permissions, and outcome recorded (PRD FR-043)
- [x] **VMS-05**: The virtual-source capability is never represented as supported until a repeatable test succeeds (PRD FR-044) — *Enforced in Phase 1*
- [x] **VMS-06**: Official vendor integrations or supported import routes are investigated as the fallback if the virtual-source approach is not viable (PRD FR-045) — *Completed in Phase 1*

### User Experience and Reporting

- [ ] **UX-01**: User completes backup and restore through a step-by-step wizard (PRD FR-050)
- [ ] **UX-02**: User sees progress, throughput where measurable, estimated remaining time where reliable, and the current operation (PRD FR-051)
- [ ] **UX-03**: User receives actionable error messages (PRD FR-052)
- [ ] **UX-04**: App distinguishes "backed up," "restorable," "requires manual action," and "not supported" for every item (PRD FR-053)
- [ ] **UX-05**: An optional QR pairing workflow identifies a backup session (PRD FR-054)
- [ ] **UX-06**: User can save a human-readable backup/restore summary locally (PRD FR-055)

