# MDTA — Mobile Data Transfer App

## What This Is

MDTA is a Windows/macOS desktop application that preserves an Android phone's transferable data and configuration into a verified local backup, so a user can surrender or trade in the old phone before migration is complete and later restore the saved data onto a replacement phone. The longer-term differentiator is a **virtual migration source**: the desktop presents the stored backup to a destination phone through a migration interface that the destination actually recognizes and accepts. That virtual-source capability is an explicit, unproven technical hypothesis — the first milestone must determine whether it is achievable.

## Core Value

**A user can hand over their old phone and still get their data back — because a verified local backup existed before the trade-in.**

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Phase 1: Source-backed determination of native setup protocol feasibility (FR-040, FR-041, FR-045). Outcome: NO on virtual-source emulation, fallback to post-setup standard restore confirmed.
- [x] Phase 2: Android device detection and identification over USB with authorization guidance (FR-001–FR-004) via Tauri v2, Rust ADB manager, and React UI wizard.

### Active

- [ ] User-selectable backup categories with preflight size/disk-space estimates (FR-010, FR-022)
- [ ] Verified file copy with checksums, resume-on-interrupt, and a persisted manifest (FR-011, FR-013–FR-015, FR-014)
- [ ] A backup library that names, browses, and reports backup status and category coverage (FR-020–FR-024)
- [ ] Restore of supported user files to a compatible destination with checksum verification (FR-030–FR-032, FR-035)
- [ ] Permitted app reinstall with explicit user consent, and honest reporting of what needs manual setup (FR-033, FR-034)
- [ ] Restore report distinguishing successes, partial restores, skips, and failures (FR-036)
- [ ] Step-by-step backup/restore wizard with progress, errors, and backup-state labels (FR-050–FR-053)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Byte-for-byte clone of one Android phone onto another** — Android sandboxes, encryption, and DRM make this impossible without security bypasses
- **Bypassing Android sandboxing, bootloader security, device encryption, app DRM, or OEM security controls** — unlawful and brittle; use documented APIs only
- **Extracting private data from arbitrary apps without their supported backup/export mechanism** — no lawful supported path exists
- **Transferring passwords, auth tokens, banking credentials, or hardware-bound protected keys** — security-critical and not meaningfully transferable
- **Guaranteeing all apps remain logged in after migration** — depends on each app's own credential handling
- **Guaranteeing exact restoration of third-party launcher, widgets, default apps, or permissions across OEMs** — depends on launcher export support and OEM behavior
- **iPhone/iOS migration in the first release** — Android is the first source/destination family
- **Cloud backup as the default store** — local-first privacy is a core product principle
- **Fixed compression-ratio claims (e.g. 216 GB → 700–800 MB)** — mathematically impossible for already-compressed content; report actual ratios instead
- **Marketing the virtual-source capability before it is validated on named devices and OS versions** — FR-044 is an explicit gate

## Context

- **Product source of truth:** `MDTA_PRD.md` (Draft v1.0, 2026-10-27) in the project root. This file and the roadmap are derived from it.
- **Reference scenario:** Realme 11 Pro+ 5G (source, ~216 GB mixed data, O Launcher setup) → Samsung Galaxy S25 (destination), via a Windows PC or Mac.
- **Central technical hypothesis:** Evaluated in Phase 1 — **NO** for virtual source emulation. Destination requires proprietary closed protocol and Samsung-signed credentials. Fallback is the post-setup standard restore path via MTP and ADB.
- **Desktop framework:** Tauri v2 (Rust backend + React / TypeScript / Tailwind CSS frontend), confirmed and scaffolded in Phase 2.

