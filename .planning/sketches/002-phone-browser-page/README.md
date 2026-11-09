---
sketch: 002
name: phone-browser-page
question: "If funk needs a real canvas, what does the browser progress page look like?"
winner: "none — rejected by user (drawer only)"
tags: [browser, adb-reverse, zero-install, rejected]
---

# Sketch 002: Phone Browser Page

## Design Question
Full design freedom (colors, layout, motion) — what does the transfer look like when it's served by the Mac over the USB cable and opened in the phone's browser? Constraint: the phone must stay unlocked with the page open, so this is an opt-in "show me" mode layered on top of the notification backbone.

## How to View
open .planning/sketches/002-phone-browser-page/index.html

## Variants
- **A: LED cockpit** — obsidian glass like the desktop app: giant amber JetBrains Mono %, thin rail, dot-matrix equalizer that dances with the stream, rolling current-file ticker. Desktop mascot energy on the phone.
- **B: Paper brutalist** — warm paper + ink; 120px figures, hatched rail filling amber-orange, ink dot matrix, "BUILT TO SURVIVE THE TRADE-IN". Loud, physical, memorable.

## What to Look For
- Both variants live-tick (~250ms) — feel which motion matches "cool and funky".
- Cycle Streaming → Paused → Done: A mutes into "● HOLDING", B stamps progress; Done freezes at 100% with the manifest-verified ticker line.
- These are the only two surfaces where a real progress BAR is possible (drawers can't paint one).

## Implementation notes (for the plan, not the sketch)
- Delivery: `adb reverse tcp:PORT tcp:PORT` + `am start -a android.intent.action.VIEW -d http://127.0.0.1:PORT` — no network, no install.
- Page data: same ProgressMessage stream, served over a tiny local HTTP endpoint or Tauri asset + SSE; pauses when phone locks (acceptable — drawer notification remains the backbone).
