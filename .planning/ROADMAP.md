# Roadmap: MDTA — Mobile Data Transfer App

## Overview

Start with evidence, not code. Phase 1 answers the question the whole product hinges on: can a desktop app be accepted as a migration source by a stock Android/Samsung destination? Only then do we build outward — device detection, a verified backup engine, a backup library and wizard, a restore engine, advanced trust features, and finally (only if Phase 1 says go) the virtual-source integration. The product must be useful even if the virtual-source hypothesis fails, so the core backup/restore path is built as a standalone deliverable.

## Phases

- [x] **Phase 1: Migration Protocol Research & Feasibility Decision** - Establish, from public sources and official documentation, whether a desktop app can act as a recognized migration source for stock Android/Samsung setup-time flow, and record a written go/no-go with a fallback route. **COMPLETE — Decision: NO. Fallback: post-setup standard restore via MTP/ADB.**
- [x] **Phase 2: Device Detection & Identification** - Deliver a working desktop prototype that detects, identifies, and guides authorization for connected Android devices over USB. **COMPLETE — Tauri v2 + Rust ADB daemon watcher + React/Tailwind authorization wizard.**
- [ ] **Phase 3: Backup Core Engine** - Deliver verified file backup with category selection, manifest, checksums, safe resume, and disk-space preflight.
- [ ] **Phase 4: Backup Library, App Inventory & Wizard** - Deliver the browsable backup library, installed-app inventory, supported settings capture, and the step-by-step backup wizard with honest status labelling.
- [x] **Phase 5: Restore Core Engine** - Deliver restore to a compatible destination with checksum verification, safe resume, and a full success/partial/skip/fail report. ✅ Plans 05-01/05-02/05-03 complete
- [ ] **Phase 6: Trust & Convenience Features** - Deliver incremental backup, optional encryption, backup-folder portability, permitted app reinstall, guided launcher reconstruction, QR pairing, and savable summaries.
- [ ] **Phase 7: Smart Switch Format Compatibility Investigation (REPURPOSED)** - Phase 1 concluded NO for virtual-source emulation. Phase 7 is now a research investigation into whether MDTA can produce a Smart Switch-compatible backup archive format that Samsung Smart Switch desktop can import natively.
      idk try to

## Phase Details

### Phase 1: Migration Protocol Research & Feasibility Decision

**Status:** ✅ COMPLETE
**Outcome:** NO — virtual-source emulation is blocked (proprietary protocol + authentication barriers). Fallback: post-setup standard restore (MTP/ADB).

### Phase 2: Device Detection & Identification

**Status:** ✅ COMPLETE
**Outcome:** Tauri v2 application initialized and building. Rust ADB service (`src-tauri/src/adb.rs`) running background polling every 1.5s. React + Tailwind wizard UI (`src/App.tsx`, `Header.tsx`, `DeviceStatusCard.tsx`, `AuthorizationGuide.tsx`) with real-time events. Unit tests passed.

### Phase 3: Backup Core Engine

**Goal:** A real backup engine that copies supported user-accessible files to local storage with category selection, manifest, checksums, safe resume, and an honest preflight disk-space check.
**Depends on:** Phase 2
**Requirements:** [BAK-01, BAK-02, BAK-04, BAK-05, BAK-06, BAK-07, LIB-03]
**Success Criteria** (what must be TRUE):

1. User selects backup categories and sees an estimated size before anything is copied.
2. User is warned when free disk space is insufficient, before the backup starts.
3. Copied files land in a local backup folder that the user controls, and a manifest records paths, sizes, checksums, timestamps, and per-item status.
4. App verifies copied files with checksums and flags unreadable, skipped, or changed items rather than silently ignoring them.
5. An interrupted copy resumes where safe instead of restarting from zero.
6. The source phone's original data is never deleted or modified by the backup operation.
   **Plans:** 3/3 — ✅ 03-01 (Chunked file pull with SHA-256 verification), ✅ 03-02 (Manifest generation and verified backup state), ✅ 03-03 (Pause/resume on disconnect + source phone data non-destructive guarantee)

### Phase 4: Backup Library, App Inventory & Wizard

**Status:** ✅ Complete — 3/3 plans executed
**Outcome:** Browsable backup library with installed-app inventory, supported settings capture, and step-by-step wizard with honest status labelling. Virtual-source remains blocked (Phase 1 NO-go); all functionality built on post-setup MTP/ADB restore fallback.
**Depends on:** Phase 3
**Requirements:** [BAK-03, BAK-08, LIB-01, LIB-02, LIB-04, UX-01, UX-02, UX-03, UX-04] — all satisfied

### Phase 5: Restore Core Engine

**Status:** ✅ Complete — 3/3 plans executed
**Goal:** A restore engine that checks destination compatibility, restores supported files to a compatible destination device, verifies what it wrote, resumes safely after interruption, and reports outcomes with full honesty.
**Depends on:** Phase 4
**Requirements:** [RST-01, RST-02, RST-03, RST-05, RST-06, RST-07, RST-09]
**Plans:** 05-01 (Device detection & compatibility checking), 05-02 (File restoration with checksum verification), 05-03 (App reinstall, manual marking, restore report, safe resume) — all executed successfully

### Phase 6: Trust & Convenience Features

**Goal:** The trust and convenience layer — incremental backup, optional encryption with honest key-recovery warnings, portable backup folders, permitted app reinstall with consent, guided launcher reconstruction, optional QR pairing, and savable human-readable summaries.
**Depends on:** Phase 5
**Requirements:** [BAK-09, BAK-10, LIB-05, RST-04, RST-08, UX-05, UX-06]

### Phase 7: Smart Switch Format Compatibility Investigation (REPURPOSED)

**Goal:** Research whether MDTA can produce a Smart Switch-compatible backup archive format.
**Depends on:** Phase 1 (complete), Phase 5 (when complete)

## Progress

| Phase                                                 | Plans Complete | Status      | Completed  |
| ----------------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Migration Protocol Research & Feasibility Decision | 3/3            | ✅ Complete | 2026-10-28 |
| 2. Device Detection & Identification                  | 3/3            | ✅ Complete | 2026-10-29 |
| 3. Backup Core Engine                                 | 3/3            | ✅ Complete | 2026-10-29 |
| 4. Backup Library, App Inventory & Wizard             | 3/3            | ✅ Complete | 2026-10-29 |
| 5. Restore Core Engine                                | 3/3            | ✅ Complete | 2026-10-29 |
| 6. Trust & Convenience Features                       | 0/TBD          | Not started | -          |
| 7. Smart Switch Format Compatibility (Repurposed)     | 0/TBD          | Not started | -          |
