# Design — On-Phone Transfer Notification (Zero Install)

**Date:** 2026-11-02
**Status:** Approved pending spec review
**Scope:** Phone-side only. Desktop engine, UI, and manifests untouched except one-line hooks.
**Sketches:** `.planning/sketches/001-phone-notification/` (winner D), `002-phone-browser-page/` (rejected — drawer only)

## Objective
While a backup streams, the phone's notification drawer shows a live, silent, non-launchable notification. Zero installs, zero network on the phone. When the job ends in any way, the notification clears itself.

## Non-goals
- **No browser page** — user decision: "No Browser page please only system notification."
- No progress bar styles, custom colors, icon, or actions in the drawer — system draws the chrome; adb cannot reshape it.
- No tap action (non-launchable; actions require an installed app).

## The notification (winner D: Signal × Console)

Rendered as bigtext under title **"Mr. Floppy"**, attributed by the system to the host app "Shell" (honest platform behavior; noted to the user in-app at most once).

Body, mono-aligned, four lines:

```
43% ▰▰▰▰▱▱▱▱▱▱
▸ IMG_20260114_0912.jpg
2,132 of 4,900 files
18.6 GB · Photos
```

- L1: percent (integer) + 10-cell unicode bar, filled = `round(pct × 10)` (43% → 4 filled cells)
- L2: current file; while scanning: `▸ Scanning storage…`
- L3 (counts) only once the scan is done; L4 (GB) only from real bytes-flow data (the engine knows bytes moved, not the transfer total — the sketch's "18.6 / 42.1 GB" split was aspirational; real L4 shows the moved part)
- L4's label = selected categories joined (`Photos+Videos`), truncated to ~24 chars
- The "animation" is the 2-second re-post cycle: bar fills, numbers tick.

### State table

| Job state | Title | Body (D format) | Removal |
|---|---|---|---|
| Streaming | Mr. Floppy | L1–L4 per above | — (lives until end-of-job) |
| Paused | Mr. Floppy | `⏸ 43% ▰▰▰▰▱▱▱▱▱▱` / `□ Holding — say the word on the Mac` / counts / (GB omitted — engine has no byte count mid-pause) | — |
| Completed | Mr. Floppy | `✓ 100% ▰▰▰▰▰▰▰▰▰▰` / `✓ manifest.json — every byte verified` / counts / `42.1 GB · Backup complete` | auto-cleared after ~5 s (goodbye moment) |
| Cancelled / error / abort | — | — | removed immediately (desktop carries the story) |

No file paths beyond the leaf name (glance privacy). English copy.

## Architecture

Grounded in the real Phase 3 engine (`src-tauri/src/backup.rs`):

1. **Tap point** — the forwarder task inside `backup_worker` (backup.rs:202-206) already receives every `ProgressMessage` from the mpsc channel before emitting to the frontend. It gains one line: `phone_notifier::on_progress(&msg);`. The streaming loop itself is untouched.
2. **Pause/resume truth** — `pause_backup` and `resume_backup` (backup.rs:436-453) push a single `ProgressMessage{status:"Paused"/"Streaming"}` through the job's stored `progress_tx`, so the drawer reflects pause without new plumbing and without per-message emission from the pause-sleep loop.
3. **Module** — new `src-tauri/src/phone_notifier.rs`. Owns: state machine (Idle → Scanning → Streaming ⇄ Paused → Completed | Cancelled | Unavailable), the 2 s throttle (immediate on status change), the adb command assembly, and serial caching.
4. **Serial** — resolved once from `adb::list_devices()` (first entry with `"Device"` status) at the first message of a job; cached for the job. Multi-phone setups pick one (documented limitation).
5. **Commands** (device-pinned, one shell string per call — adb joins args and the device shell word-splits, so the body travels as a single-quoted arg; `'` in filenames is escaped `'\''`):
   - Post: `adb -s <serial> shell cmd notification post -S bigtext -t 'Mr. Floppy' mrfloppy '<body>'`
   - Remove: `adb -s <serial> shell cmd notification remove mrfloppy`

## Error handling / degradation
- First post of a job is the viability test. On failure (non-zero exit or denied): mark **Unavailable** for that job, emit one desktop log line ("Phone notifications unavailable on this device"), never retry during the job. Next job retries once.
- Phone unplugged mid-job: posts fail silently; no crash, no retry storm; re-plug resumes updates.
- Removal failures are swallowed.

## Testing
- **Rust unit tests** (no device): body formatter (percent/bar/count/category, truncation), `'`-escaping of filenames, throttle gating as a pure function over injected time.
- **Live UAT** (needs phone plugged in — pending):
  1. Start a real backup → drawer card appears within ~2 s, numbers tick.
  2. Pause on the Mac → drawer shows `⏸ Holding…` within ~2 s.
  3. Resume → streaming again.
  4. Complete → `✓ 100%` line shows, card clears within ~5 s.
  5. Cancel → card clears immediately.
- **ColorOS go/no-go** — the very first live post answers whether Realme UI 2/Android 15 admits shell notifications at all (expected yes; not yet verified).

## Risks
| Risk | Handling |
|---|---|
| ColorOS restricts `cmd notification` | Defined degradation to desktop log; feature is additive |
| Notification spam | Hard 2 s throttle; state-change posts only on transitions |
| Filename with quotes/spaces | Single-arg shell string with `'\''` escaping, unit-tested |
| "Shell" attribution surprises the user | Documented; optional one-line explanation in desktop log at first post |
