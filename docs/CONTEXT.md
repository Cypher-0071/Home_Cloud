# Home Cloud - Project Context

## What is this?

A self-hosted cloud platform that turns a spare PC (running Linux) into a remotely managed server. Accessible from any browser tab, on any device, anywhere in the world. Think ngrok + AnyDesk combined into one unified web dashboard.

The goal is personal utility. Replace the need for a paid cloud server by using a spare PC at home as a full server, while being able to access and manage it remotely as if it were a real cloud server. Software-wise the experience is identical to a cloud VM. Hardware-wise it is your own physical machine sitting at home.

---

## Core Concepts

**Agent** - A lightweight Node.js background process running on the spare PC. It never needs inbound connections. It opens an outbound connection to Cloudflare's servers, which relay traffic from the browser to the agent. This bypasses NAT and ISP restrictions entirely.

**Cloudflare Tunnel (cloudflared)** - Free tunneling solution. The agent spawns a cloudflared process which creates a secure outbound tunnel and exposes the agent publicly via a stable HTTPS URL. No VPS required, no port forwarding needed. Works even on Indian ISPs with CGNAT.

**Dashboard** - A React SPA served as static files by the agent itself. Accessed from any browser.

---

## How Networking Works

The spare PC is behind home NAT (no public IP). Cloudflare Tunnel solves this by flipping the direction of connections:

```
1. cloudflared on spare PC opens an OUTBOUND WebSocket connection to Cloudflare's servers
2. Cloudflare assigns a public HTTPS URL
3. When browser hits that URL, Cloudflare routes the request through the existing tunnel to the agent
4. Agent handles the request locally and sends the response back through the same tunnel
```

No inbound ports needed. Your router allows outbound connections so this just works.

---

## Architecture

```
SPARE PC (Linux, always on, lid closed)
└── Node.js Agent (Express + WebSocket server)
    ├── Serves React dashboard (static build from ../dashboard/dist)
    ├── REST API (files, metrics, docker, auth)
    ├── WebSocket server (terminal sessions, live metrics)
    ├── node-pty → browser terminal (PTY, not child_process)
    ├── systeminformation → system metrics
    ├── dockerode → Docker management
    ├── fs + multer → file management
    ├── jsonwebtoken → auth
    └── cloudflared (child process) → public HTTPS tunnel
            |
            | outbound tunnel
            v
    Cloudflare Edge Network
            |
            | HTTPS
            v
BROWSER (Main PC / any device)
└── React Dashboard
    ├── Terminal tab (xterm.js over WebSocket)
    ├── File manager tab (upload, download, browse)
    ├── Monitoring tab (CPU, RAM, disk, network - live)
    ├── Docker tab (containers, images, deploy)
    ├── Remote desktop tab (noVNC - VNC client in browser)
    ├── Tunnel tab (expose local ports publicly)
    └── Processes tab (list, kill, monitor)
```

---

## Tech Stack

### Agent (Backend)
- **Runtime**: Node.js v24
- **Module system**: CommonJS (require, not import) - mandatory because node-pty and dockerode use native C++ bindings that compile to .node files. These work reliably with CommonJS. ESM adds friction with native modules for zero benefit.
- **Framework**: Express
- **WebSockets**: ws library, attached to the same HTTP server as Express (single port)
- **Terminal**: node-pty (creates a real PTY, not child_process.exec - programs like vim and htop check isatty() and behave differently without a real terminal)
- **System info**: systeminformation
- **Docker**: dockerode (talks to Docker socket)
- **Auth**: jsonwebtoken
- **File uploads**: multer
- **Dev**: nodemon
- **Tunnel**: cloudflared binary (spawned as child process)

### Dashboard (Frontend)
- **Framework**: React
- **Build tool**: Vite
- **Language**: TypeScript + React Compiler
- **Terminal UI**: xterm.js
- **Remote desktop**: noVNC

### Monorepo
- **Package manager**: pnpm with pnpm workspaces
- **Dev orchestration**: concurrently (runs agent + dashboard dev servers simultaneously)
- No Turborepo, no overkill. Only 2 packages.

---

## Project Structure

```
home-cloud/
├── pnpm-workspace.yaml
├── package.json              <- root, concurrently dev script
├── CONTEXT.md                <- this file
├── agent/                    <- Node.js backend
│   ├── index.js              <- entry point (CommonJS)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── files.js
│   │   ├── metrics.js
│   │   ├── docker.js
│   │   └── tunnel.js
│   ├── sockets/
│   │   ├── terminal.js
│   │   └── metrics.js
│   └── package.json          <- NO "type": "module" - must stay CommonJS
└── dashboard/                <- React frontend (Vite + TypeScript)
    ├── src/
    └── package.json
```

---

## Key Architecture Decisions

**Single port for everything** - The agent HTTP server and WebSocket server share port 3000. ws library attaches to the HTTP server via the `upgrade` event, not a separate port. One cloudflared tunnel covers everything.

**Express route ordering** - Critical. Must be:
1. API routes first (`/api/*`)
2. Static file serving (`express.static('../dashboard/dist')`)
3. Catch-all LAST (`app.get('*')` returns index.html)

The catch-all exists because React Router handles client-side routing. On a hard refresh to `/docker`, the browser asks the server for `/docker`. Express finds no file called `docker` in dist. Without the catch-all it returns 404. With it, Express returns `index.html`, React loads, React Router reads the URL and renders the right tab.

**SSE for metrics, WebSocket for terminal** - Metrics flow one direction (server to client). SSE is cleaner for this. WebSocket is bidirectional, mandatory for the terminal where keystrokes go up and output comes down.

**Why not Next.js** - Next.js doesn't support WebSockets natively and is too heavy to run as a background daemon on a spare PC.

**Why not Turborepo** - Only 2 packages. Concurrently is sufficient.

---

## Real-time Data Flow

### Terminal (WebSocket)
```
User presses 'l' in xterm.js (browser)
  -> xterm.js captures keydown
  -> sends WebSocket frame: { type: "input", data: "l" }
  -> agent receives in ws.on('message')
  -> agent calls pty.write("l")
  -> PTY passes "l" to bash
  -> bash writes output back to PTY
  -> PTY emits data event on agent
  -> agent sends WebSocket frame: { type: "output", data: "l" }
  -> xterm.js renders the character
```

### Metrics (SSE)
```
Agent reads CPU/RAM every second via systeminformation
  -> formats as SSE event: "data: {cpu: 45, ram: 62}\n\n"
  -> browser EventSource receives it
  -> React state updates
  -> chart re-renders
```

### Why not plain long HTTP request for metrics
Three reasons:
1. Timeouts - proxies, CDNs, Cloudflare itself will kill a long-running HTTP request
2. Buffering - HTTP middleware buffers the body expecting a complete response. Data sits in a buffer, never reaches browser until connection closes
3. No framing - raw bytes in a stream with no concept of where one event ends and another begins

SSE solves all three. `\n\n` is the frame delimiter. Browser parses each event. No buffering because browsers treat SSE specially.

---

## Development Environment

**OS**: WSL2 (Ubuntu) on Windows. The agent uses Linux-specific packages (node-pty, VNC, system metrics). Developing on Windows natively causes native binding compilation failures.

**Project files location**: `~/projects/home_cloud` inside WSL filesystem. NOT on `/mnt/e/` (Windows drive mounted in WSL). The mounted Windows filesystem has terrible I/O performance and causes issues with native modules.

**VS Code**: Open from WSL terminal via `code .`. VS Code runs on Windows but connects to WSL environment via the WSL extension. Terminal inside VS Code is Linux.

**Native builds**: node-pty and other packages with C++ bindings need `build-essential` and `python3` installed in WSL:
```bash
sudo apt install -y build-essential python3
```
If you ever see `gyp ERR! not found: make`, this is why. Check with `make --version`.

**Running**:
```bash
# from root, runs both agent and dashboard
pnpm dev

# agent only
pnpm --filter agent start

# dashboard only
pnpm --filter dashboard dev
```

## Linux Config for Spare PC

To keep the spare PC on with lid closed:

```bash
# /etc/systemd/logind.conf
HandleLidSwitch=ignore
```

Then: `systemctl restart systemd-logind`    