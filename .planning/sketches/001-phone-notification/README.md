---
sketch: 001
name: phone-notification
question: "What can 'cool and funky' be inside a system-drawn notification drawer, given zero install?"
winner: "D (A+C synthesis)"
tags: [notification, drawer, zero-install]
---

# Sketch 001: Phone Notification

## Design Question
What can "cool and funky" be inside the Android notification drawer when the transfer is happening — where the card chrome (colors, layout, radius) is system-drawn and we control only title, body, emoji, and unicode art?

## How to View
open .planning/sketches/001-phone-notification/index.html

## Variants
- **A: Signal** — numeric mono figures; 43% in amber; facts row (GB moved / total / category). Calm-cool, operator vibe.
- **B: Snatch mode** — emoji-forward personality: "snatching your files 🌀", "going into the box 📦". Warmest tone of the three.
- **C: Console** — unicode progress bar ▰▰▰▱▱ + live current-file line. Retro transfer-log character.
- **D: Signal × Console ★ WINNER** — A's living mono numbers carry the load; C's unicode bar and current-file line ride along in one mono block. User verdict: merge, prioritising A "for the animation".

## What to Look For
- Cycle **Streaming → Paused → Done** (buttons above the frames) — D covers all three states.
- Realism: the card renders as the host app "Shell" — on real devices adb posts show that attribution, and action buttons (like Pause) are impossible without an installed app. Honesty beats fantasy here.
- The funk ceiling is typographic: D uses live re-posts every ~2s as its "animation" (the bar fills, numbers tick).

## Constraints (verified against AOSP knowledge; live ColorOS test pending device)
- `cmd notification post` renders with system chrome; no custom color, layout, icon, or progress bar.
- Cannot attach actions; cannot style text color inside body except via emoji/unicode.
- Auto-updater replaces the card by re-posting with the same tag (~2s throttle planned).
