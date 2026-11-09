# 💿 Mr. Floppy — Android Migration Engine

**Mr. Floppy** is a macOS desktop application (Tauri v2 + Rust + React) that backs up your Android phone's transferable data to your Mac **before** you trade it in — then restores it onto a replacement phone.

Built as a local-first, privacy-preserving migration tool. Nothing leaves your machine; no cloud, no account, no tracking.

---

## ✨ What it does

| Capability | Details |
|---|---|
| **Backup** | Streams photos, videos, music, documents, downloads, contacts, and installed-app installers from your Android phone over ADB to your Mac. |
| **SHA-256 verification** | Every file is checksummed on-the-fly during transfer — integrity is proven before the file is considered done. |
| **Pause / Resume / Abort** | Pause a long backup mid-stream, resume later, or cancel entirely without corrupting partial files. |
| **Progress tracking** | Live byte-level progress bar, file count, MB transferred, and a real-time session inspector log. |
| **Restore** | Pushes a previous backup back onto a replacement Android device, category by category, with verification. |
| **Manifest** | A `manifest.json` records every file's path, size, and SHA-256 so you can browse exactly what was saved. |
| **Read-only source** | Your phone is never written to during backup. Zero phone writes. |

---

## 🖼️ Screenshot

> Working build shown below — backup in progress at 100% with live ADB stream, file inspector, and SHA-256 integrity check.

<img width="1132" height="832" alt="image" src="https://github.com/user-attachments/assets/2534b34c-f3fd-4ae2-bfa7-a96a8c38ed1f" />


> **Note:** Add this image to the repo at `docs/screenshots/mr-floppy-working.png` (the image you shared) so it renders here.

---

## 🏗️ How it works (architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  macOS (Tauri v2 window)                                    │
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │ React UI     │  │  Rust Core (src-tauri/src/)         │ │
│  │ (Vite + TS)  │  │  ├─ backup.rs  — ADB streaming      │ │
│  │              │  │  ├─ restore.rs — adb push restore   │ │
│  │              │  │  ├─ phone_notifier.rs — phone alerts│ │
│  │              │  │  └─ lib.rs    — Tauri command reg.  │ │
│  └──────┬───────┘  └──────────────┬─────────────────────┘ │
│         │                          │                        │
│         └───── invoke() / events ──┘                        │
│                                │                            │
│                                ▼                            │
│                        ┌───────────────┐                   │
│                        │   ADB (adb)   │                   │
│                        │  exec-out cat │                   │
│                        └───────┬───────┘                   │
│                                │                            │
│                                ▼                            │
│                        ┌───────────────┐                   │
│                        │  Android Phone│                   │
│                        │  (RMX3741,    │                   │
│                        │  Android 15)  │                   │
│                        └───────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**The backup pipeline:**

1. **Scan** — `adb shell find` lists every file under each selected category root (`/sdcard/DCIM`, `/sdcard/Movies`, etc.). `adb shell du -k -s` measures total bytes so progress is byte-based and smooth.
2. **Stream** — Each file is pulled via `adb exec-out cat <path>`, read in 16 KiB chunks, and written to `~/Backups/MrFloppy/<relative-path>` on your Mac.
3. **Verify** — Every chunk is fed into a SHA-256 hasher. When the file finishes, the digest is compared and recorded in `manifest.json`.
4. **Emit progress** — A `backup-progress` Tauri event fires every ~100 ms with `bytes_transferred`, `processed_files`, `total_files`, `progress` (0–1), and `current_file`. The React UI consumes this to update the progress bar, percentage pill, dot-matrix equalizer, and inspector log.
5. **Manifest** — After all categories finish, `manifest.json` is written atomically (`.tmp` → rename) so you can browse the backup later with `list_backup_contents`.

**The restore pipeline:**

1. Read `manifest.json` from your backup directory.
2. Filter entries to the selected categories.
3. `adb push` each file from Mac → `/sdcard/<path>` on the phone, creating parent directories as needed.
4. Emit `restore-progress` events per file with bytes transferred and completion status.

---

## 📦 Download & Installation

### Option A — Pre-built release (easiest)

1. Go to the **Releases** page on this repository.
2. Download the latest **`.dmg`** (macOS disk image).
3. Open the DMG and drag **Mr. Floppy.app** into your **Applications** folder.
4. Launch Mr. Floppy. On first run macOS may block it because it's not notarized — go to **System Settings → Privacy & Security → Security** and click **Open Anyway**.
5. Plug your Android phone in via USB, enable **USB Debugging** (Developer Options), and authorize the computer when prompted on the phone.
6. Click **Backup**, select categories, and hit **Start Migration Session**.

> Requires: macOS, `adb` installed (see below), an Android phone with USB debugging enabled.

### Option B — Build from source

If you want to build it yourself (or contribute):

#### Prerequisites

- **macOS** (the app is bundled for `aarch64-apple-darwin` / Apple Silicon; Intel builds need a target change)
- **Node.js** (v18+) and **npm**
- **Rust** toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Tauri CLI** v2 (`cargo install tauri-cli --version 2`)
- **Android SDK platform-tools** (`adb`) — install via Homebrew:
  ```bash
  brew install android-platform-tools
  ```
  Verify: `adb version` → should print something like `Android Debug Bridge version 1.0.41`.

#### Build steps

```bash
# 1. Clone the repo
git clone https://github.com/Aripreet-Das/mr-floppy.git
cd mr-floppy

# 2. Install frontend dependencies
npm install

# 3. Build the Tauri app (macOS release .app + .dmg)
PATH="$HOME/.cargo/bin:$PATH" npm run tauri build
```

Outputs appear in:
- `src-tauri/target/release/bundle/macos/Mr. Floppy.app`
- `src-tauri/target/release/bundle/dmg/Mr. Floppy_<version>_aarch64.dmg`

#### Dev mode (hot-reload)

```bash
PATH="$HOME/.cargo/bin:$PATH" npm run tauri dev
```

This starts the Vite dev server and the Rust backend together so you can iterate on the UI.

---

## 🎮 How to use Mr. Floppy

### First-time setup

1. On your Android phone: **Settings → System → Developer options → USB debugging** → ON.
2. Connect the phone to your Mac via USB.
3. On the phone, tap **"Allow USB debugging?"** when the prompt appears (check "Always allow").
4. Open Mr. Floppy. The header should show `adb 1.0.41` with a green check, and the footer should show `Linked: <your phone model>`.

### Running a backup

1. Make sure **Backup** mode is selected (center toggle under the app name).
2. Select the categories you want (Photos, Documents, Downloads, Contacts, Apps, etc.). Default: Photos, Documents, Downloads.
3. Click **Pre-flight** to check you have enough free space on your Mac.
4. Click **Start Migration Session** (amber play button).
5. Watch the live progress: percentage, files transferred, MB, current filename, and the inspector log.
6. Use **Pause** / **Resume** if you need to step away. Use **Abort** to cancel.
7. When done, the inspector shows `[COMPLETE]` and a `manifest.json` is saved to `~/Backups/MrFloppy/`.

### Running a restore (on a replacement phone)

1. Switch to **Restore** mode (center toggle).
2. Connect the new/replacement Android phone via USB with debugging authorized.
3. Select the categories to push back.
4. Click **Pre-flight** (optional), then **Start Restore Session**.
5. Files stream Mac → phone with SHA-256 verification on arrival.
6. When finished, the inspector shows `[RESTORED]`.

---

## 🔧 Tech stack

| Layer | Technology |
|---|---|
| Shell / Window | **Tauri v2** (Rust) |
| Frontend | **React 19** + **TypeScript** + **Vite** |
| Icons | **Lucide React** |
| Styling | **Tailwind CSS** (via `@import "tailwindcss"`) |
| Mobile comms | **ADB** (`adb exec-out cat`, `adb push`, `adb shell find/du`) |
| Integrity | **SHA-256** (Rust `sha2` crate) computed streamingly |
| Events | Tauri `emit` / `listen` (`backup-progress`, `restore-progress`, `device-poll`) |
| Build target | `aarch64-apple-darwin` (Apple Silicon macOS) |

---

## 📁 Project structure

```
mr-floppy/
├── README.md                 # this file
├── package.json              # frontend deps + scripts
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite build config
├── index.html                # app entry
├── src/
│   ├── App.tsx               # main shell, mode toggle, device polling
│   ├── App.css               # obsidian glass theme + animations
│   ├── components/
│   │   ├── Header.tsx        # app name + Backup/Restore toggle + ADB status
│   │   ├── BackupWizard.tsx  # backup flow (canvas + inspector + file tree)
│   │   ├── RestoreWizard.tsx # restore flow (canvas + inspector)
│   │   ├── CanvasGraph.tsx   # spatial node graph (phone → categories → leaves)
│   │   ├── InspectorPanel.tsx# progress bar, metrics, live terminal log
│   │   ├── BackupFileTree.tsx# manifest tree browser (post-backup)
│   │   └── DotMatrixEqualizer.tsx
│   └── types/device.ts       # DeviceInfo, AdbStatus types
├── src-tauri/
│   ├── Cargo.toml            # Rust deps (serde, sha2, tokio, tauri)
│   ├── src/
│   │   ├── lib.rs            # Tauri command registrations
│   │   ├── backup.rs         # backup/restore worker, progress events, manifest
│   │   └── phone_notifier.rs # on-phone drawer notifications (optional)
│   ├── tauri.conf.json       # Tauri config (productName: Mr. Floppy)
│   └── target/release/bundle/# built .app and .dmg land here
├── docs/                     # Phase 1 research (protocol, feasibility, test matrix)
├── dist/                     # Vite build output (gitignored)
└── node_modules/             # npm deps (gitignored)
```

---

## ⚙️ Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server only |
| `PATH="$HOME/.cargo/bin:$PATH" npm run tauri dev` | Full dev mode (Rust + React hot reload) |
| `npm run build` | TypeScript check + Vite production build |
| `PATH="$HOME/.cargo/bin:$PATH" npm run tauri build` | Build release `.app` + `.dmg` bundle |

---

## ⚠️ Limitations & known constraints

- **macOS only** for the bundled desktop app. Windows/Linux builds would need a Tauri target change.
- **Setup-time flow is not supported.** A stock Android/Samsung destination during its own initial setup wizard requires proprietary Samsung-signed credentials that a third-party desktop app cannot provide (see `docs/feasibility-decision.md`). Mr. Floppy works **post-setup** via standard ADB/MTP.
- **App data (TOTP seeds, encrypted app databases) is not extractable** — these live in the app's private `/data/data` area and are hardware-keystore bound. Only APK installers are backed up under "Installed Apps."
- **Requires USB debugging** to be enabled and authorized on the phone.

---

## 🛣️ Roadmap (Phase context)

- **Phase 1** ✅ Complete — Protocol research, feasibility decision (NO to setup-time source role), test matrix spec.
- **Phase 2** ✅ Complete — Tauri v2 + Rust ADB manager + React UI; all plans executed.
- **Phase 3** — Backup Core Engine (current): verified manifests, live byte-level progress, pause/resume, restore-to-device.

See `docs/` for the full Phase 1 dossier (`protocol-research.md`, `evidence-catalog.md`, `feasibility-decision.md`, `fallback-assessment.md`, `test-matrix-spec.md`).

---

## 📄 License

Private / internal project. All rights reserved.

---

### Contributing

Pull requests welcome. Please open an issue first to discuss the change you want to make.

Built with Rust, Tauri, React, and a lot of coffee. — Mr. Floppy
