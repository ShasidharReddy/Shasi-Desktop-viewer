<div align="center">
  <img src="client/assets/icon.png" width="96" alt="Desktop Viewer"/>
  <h1>Desktop Viewer</h1>
  <p><strong>AnyDesk-style remote desktop — screen share, full remote control, file transfer</strong><br/>
  Works on your local network. No cloud. No accounts. Just install and connect.</p>

  [![Release](https://img.shields.io/github/v/release/ShasidharReddy/Shasi-Desktop-viewer?style=flat-square&label=Latest%20Release&color=4f8ef7)](https://github.com/ShasidharReddy/Shasi-Desktop-viewer/releases/latest)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey?style=flat-square)](https://github.com/ShasidharReddy/Shasi-Desktop-viewer/releases/latest)
  [![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
</div>

---

## ⬇️ Download & Install

Go to the **[Releases page](https://github.com/ShasidharReddy/Shasi-Desktop-viewer/releases/latest)** and pick your file:

| Your machine | File to download | How to install |
|---|---|---|
| 🍎 **macOS Apple Silicon** (M1 / M2 / M3 / M4) | `Desktop Viewer-x.x.x-arm64.dmg` | Open DMG → drag app to Applications |
| 🍎 **macOS Intel** (2019 or older) | `Desktop Viewer-x.x.x.dmg` | Open DMG → drag app to Applications |
| 🪟 **Windows 10 / 11** (64-bit) | `Desktop Viewer Setup x.x.x.exe` | Double-click → Next → Install |

> **⚠️ First-run warnings are normal** — the app is unsigned (no $99/yr Apple certificate).
> - **macOS:** Right-click the app → **Open** → **Open Anyway**
> - **Windows:** Click **More info** → **Run anyway**

---

## ✨ Features

| Feature | Details |
|---|---|
| 📡 **Screen Share** | Stream your full desktop to another machine over WebRTC P2P |
| 🖱️ **Remote Control** | Viewer controls host's mouse, keyboard, scroll — full AnyDesk-style control |
| 📁 **File Transfer** | Drag & drop files to send. Any file type, any size. Save with one click |
| 🔒 **Private** | Direct peer-to-peer — nothing goes to any cloud server |
| 🌐 **Cross-platform** | Mac ↔ Mac, Windows ↔ Windows, Mac ↔ Windows |

---

## 🚀 Quick Start (3 steps)

### Step 1 — Run the Signaling Server (once, on any machine)

The signaling server just coordinates the initial WebRTC handshake. Run it on **either** laptop, or any machine on the same Wi-Fi.

```bash
# First time only
cd signaling-server
npm install

# Start the server
npm start
```

You'll see output like this:

```
=== Desktop Viewer Signaling Server ===
  Local:   http://localhost:3000
  Network: http://192.168.1.42:3000   ← note this IP
```

> 📌 Keep this terminal open. Both laptops need to reach this IP.

---

### Step 2 — Configure Both Laptops

On **both** machines:
1. Open **Desktop Viewer**
2. Click **⚙️ Settings** in the left sidebar
3. Enter the server IP (e.g. `192.168.1.42`) and port `3000`
4. Click **💾 Save Settings**

```
┌──────────────────────────────────────────┐
│  ⚙️  Settings                             │
│                                          │
│  Signaling Server IP                     │
│  ┌────────────────────┬──────┐           │
│  │  192.168.1.42      │ 3000 │           │
│  └────────────────────┴──────┘           │
│                                          │
│  [ 💾 Save Settings ]                    │
└──────────────────────────────────────────┘
```

---

### Step 3 — Connect

**Laptop A — Share your screen (Host):**

1. Click **📡 Share My Screen**
2. Click **▶ Start Sharing**
3. A **6-character room code** appears (e.g. `XK92AB`)
4. Tell that code to the other person

```
┌──────────────────────────────────────────┐
│  📡  Share My Screen                     │
│                                          │
│  ┌  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─ ┐  │
│     YOUR ROOM CODE                       │
│  │                                   │  │
│          X  K  9  2  A  B                │
│  │                                   │  │
│     Share this code with the viewer      │
│  └  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─ ┘  │
│                                          │
│  Waiting for viewer…              🟡     │
│                                          │
│  [ ▶ Start Sharing ]  [ ■ Stop ]         │
└──────────────────────────────────────────┘
```

**Laptop B — View the remote screen (Viewer):**

1. Click **🔗 Connect to Remote**
2. Type the 6-character code → click **🔗 Connect**
3. Laptop A's screen appears full-screen
4. Toggle **Control** in the top bar to take over mouse & keyboard

```
┌──────────────────────────────────────────┐
│  🔗  Connect to Remote                   │
│                                          │
│  Room Code                               │
│  ┌──────────────────────────────────┐    │
│  │        X  K  9  2  A  B          │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [ 🔗 Connect ]   [ ✖ Disconnect ]       │
└──────────────────────────────────────────┘
```

**Remote screen view (after connecting):**

```
┌──────────────────────────────────────────────────────────┐
│ 🖥 Desktop Viewer  ● Connected  [Control ⬜]  [📁 Files] [✖]│  ← top bar
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│              [ Host's desktop streams here ]             │
│                                                          │
│        Full screen · Mouse & keyboard when Control ON    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 File Transfer

File transfer works **once a connection is established** (either as host or viewer).

### From the Files tab (main window):
1. Click **📁 File Transfer** in the left sidebar
2. Drag & drop files onto the drop zone, or click to browse
3. Click **📤 Send Files**
4. The other person sees the file appear under **📥 Received Files** with a **💾 Save** button

### From inside the remote screen view:
1. Click the **📁 Files** button in the top bar
2. A side panel slides in — drop files or click to browse
3. Click **📤 Send** — files transfer in real time with a progress bar

```
┌─────────────────────────────────────────────────────────┬──────────────┐
│  Remote screen view                                     │ 📁 File      │
│                                                         │  Transfer    │
│                                                         │ ─────────── │
│                                                         │ 📂 Drop or  │
│       [ Host's desktop ]                                │  click...   │
│                                                         │             │
│                                                         │ 📎 report.pdf│
│                                                         │    2.3 MB   │
│                                                         │             │
│                                                         │ ████░░ 60%  │
│                                                         │             │
│                                                         │ 📥 Received │
│                                                         │ 📄 notes.txt│
│                                                         │    [💾 Save]│
└─────────────────────────────────────────────────────────┴──────────────┘
```

> **Both sides can send.** Host and viewer can each drag & drop files to the other.

---

## 🔑 macOS Permissions (first run only)

macOS requires explicit permission grants before the app can share or control:

| Permission | Who needs it | Where to grant |
|---|---|---|
| **Screen Recording** | Host machine | System Settings → Privacy & Security → Screen Recording |
| **Accessibility** | Host machine (for remote control) | System Settings → Privacy & Security → Accessibility |

**Desktop Viewer will guide you automatically** — a banner appears with an **Open System Settings** button when permission is needed.

```
┌────────────────────────────────────────────────────────────┐
│  🔒  Screen Recording Permission Required                  │
│                                                            │
│  Enable Desktop Viewer in System Settings → Privacy →      │
│  Screen Recording, then restart the app.                   │
│                                                            │
│  [ ⚙️ Open System Settings ]   [ 🔄 Restart ]              │
└────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

```
┌─────────────────┐   WebSocket (signaling)   ┌────────────────────┐
│  HOST laptop    │◄─────────────────────────►│  Signaling Server  │
│  (shares screen)│                           │  Node.js + Socket.io│
│                 │◄─────────────────────────►│  port 3000         │
│  VIEWER laptop  │   WebSocket (signaling)   └────────────────────┘
│  (views screen) │
│       │         │
│  WebRTC P2P ────┘   direct peer-to-peer after handshake
│  - Video track  →   screen stream
│  - Data channel →   remote control events + file transfer
└─────────────────┘
```

**Components:**

| Component | What it does |
|---|---|
| `signaling-server/server.js` | Node.js + Socket.io — relays WebRTC SDP offer/answer & ICE candidates. Also forwards remote control events. |
| `client/main.js` | Electron main process — creates window, handles screen capture permissions, injects mouse/keyboard via `robotjs` |
| `client/src/app.js` | All renderer logic — screen share, viewer, remote control, file transfer via WebRTC data channel |
| `client/src/index.html` | App UI — sidebar nav with Share / Connect / Files / Settings views |

---

## 🔧 Build from Source

### Prerequisites

```bash
# macOS
brew install node

# Windows — download from https://nodejs.org (LTS)
```

Node.js 18+ required.

### Run in development

```bash
# Terminal 1 — start signaling server
cd signaling-server
npm install && npm start

# Terminal 2 — run Electron app
cd client
npm install && npm start
```

### Build installers

```bash
cd client
npm run build:mac    # → dist/Desktop Viewer-x.x.x.dmg (Intel + ARM)
npm run build:win    # → dist/Desktop Viewer Setup x.x.x.exe
npm run build:all    # → both at once
```

Output goes to `client/dist/`.

---

## 📁 Project Structure

```
Shasi-Desktop-viewer/
├── signaling-server/
│   ├── package.json          ← Node.js dependencies
│   └── server.js             ← Express + Socket.io signaling server
│
├── client/
│   ├── package.json          ← electron-builder config + build scripts
│   ├── main.js               ← Electron main: window, permissions, robotjs injection
│   ├── preload.js            ← Context bridge: safe IPC between main ↔ renderer
│   ├── assets/
│   │   ├── icon.icns         ← macOS app icon
│   │   ├── icon.ico          ← Windows app icon
│   │   ├── icon.png          ← General icon
│   │   └── entitlements.mac.plist
│   └── src/
│       ├── index.html        ← App layout: sidebar + Share/Connect/Files/Settings
│       ├── app.js            ← All renderer logic (screen share + file transfer)
│       └── style.css         ← Dark theme styles
│
└── .github/workflows/
    └── build.yml             ← Auto-build .dmg + .exe on git tag push
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| **"Cannot connect to signaling server"** | Make sure `npm start` is running in `signaling-server/` and both laptops are on the **same Wi-Fi/LAN** |
| **"Room not found"** | Double-check the 6-char code. Host must still be sharing (haven't clicked Stop) |
| **Black screen on viewer** | macOS: re-grant Screen Recording in System Settings. Restart the app after granting |
| **Remote control not working** | macOS: grant Accessibility in System Settings → Privacy. Windows: run app as Administrator |
| **File transfer stuck / not starting** | Connection must be established first. Check the channel is open — disconnect and reconnect |
| **Windows Defender warning** | Click **More info** → **Run anyway** (app is unsigned) |
| **macOS Gatekeeper "unidentified developer"** | Right-click app → **Open** → **Open Anyway** |
| **High CPU on host** | Normal during screen capture. Reduce screen resolution or close other apps |
| **Laggy remote view** | Both machines need to be on the same LAN (not different SSIDs). Wired ethernet = best performance |

---

## ⚠️ Known Limitations

- Requires both machines on the **same network** (Wi-Fi or LAN). For internet connections, a TURN server is needed.
- **Audio is not captured** (video/screen only).
- One viewer per session.
- macOS requires permission grants on first use (guided by the app).

---

## 🤝 Contributing

Pull requests welcome. For large changes, open an issue first.

```bash
git clone https://github.com/ShasidharReddy/Shasi-Desktop-viewer.git
cd Shasi-Desktop-viewer/client
npm install && npm start
```

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/ShasidharReddy">ShasidharReddy</a>
</div>
