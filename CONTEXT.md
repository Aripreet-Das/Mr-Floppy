# Project Context — MDTA Migration Protocol Research

## Product
MDTA (Mobile Data Transfer App) — a Windows/macOS desktop application that preserves an Android phone's transferable data and configuration into a verified local backup, enabling users to trade in their old phone before migration is complete and later restore saved data onto a replacement phone.

## Core Technical Hypothesis (Phase 1)
Can a desktop application be accepted as a recognized migration source by a stock Android/Samsung destination during initial setup-time flow? **Answer: NO.** The destination requires proprietary closed protocol and Samsung-signed credentials. Fallback: post-setup standard restore via MTP/ADB.

## Phase 1 Plans (Wave 1)
Three independent plans completed in sequence:

### Plan 01-01: Protocol Research Dossier
- **Outputs:** `docs/protocol-research.md`, `docs/evidence-catalog.md`
- **Criteria:** ≥3 verified AOSP source citations; success criteria 1 & 2 for Phase 1
- **Result:** Three AOSP source citations established that source-role eligibility at setup time depends on USB gadget ADB function configuration, DeviceSetupToken possession, and proprietary credential handshakes — all infeasible for a third-party desktop app.

### Plan 01-02: Feasibility Decision Record
- **Outputs:** `docs/feasibility-decision.md`, `docs/fallback-assessment.md`
- **Criteria:** Clear YES/NO determination; specific technical requirements if YES; fallback route if NO; success criteria 2, 3, 5 for Phase 1
- **Result:** Decision = NO. Technical rationale covers three gates (USB gadget ADB function, DeviceSetupToken, proprietary credential handshake). Fallback = post-setup standard restore via MTP/ADB. Criteria 2 (clear determination), 3 (disk-space warning via FR-022), 5 (resume logic via BAK-05/DEV-04) satisfied.

### Plan 01-03: Test Matrix Specification
- **Outputs:** `docs/test-matrix-spec.md`
- **Criteria:** All 12 matrix fields per PRD §12 and FR-043; references go/no-go decision; success criterion 4 for Phase 1
- **Result:** 12 matrix fields documented (Source Model, Destination Model, Manufacturer, Android Version, Setup State, USB Cable/Connection Mode, Permissions & User Actions, Backup Category, Data Size, Destination Recognizes Source, Data Transferred & Verified, Error Conditions & Recovery). Go/no-go decision (NO) referenced throughout. Success criterion 4 mapped to Fields 11 & 12 (checksum verification + error/recovery reporting).

## Success Criteria Summary — Phase 1

| Criterion | Status |
|---|---|
| 1 — Documented AOSP source evidence | ✅ 3+ verified citations in `docs/evidence-catalog.md` |
| 2 — Clear go/no-go determination | ✅ NO decision with technical rationale in `docs/feasibility-decision.md` |
| 3 — Specific technical requirements named (if YES) | ✅ Three gates documented; not applicable (NO) |
| 4 — Fallback route documented | ✅ MTP/ADB post-setup path in `docs/fallback-assessment.md` |
| 5 — Test matrix with all required fields | ✅ 12 fields specified in `docs/test-matrix-spec.md` |

## Project Status
- **Phase 1:** Complete (3/3 plans executed, all success criteria met)
- **Phase 2:** Complete (Tauri v2 + Rust ADB manager + React UI; all 3 plans done)
- **Current Focus:** Phase 3 — Backup Core Engine planning
- **Next:** Phase 3 planning with verified foundation from Phase 1 research