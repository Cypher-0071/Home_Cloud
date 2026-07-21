# Home Cloud — V1 Roadmap

This document records all completed milestones and features built in **V1** of the Home Cloud Docker Manager platform.

> [!IMPORTANT]
> **Implementation Strategy Decision:**
> We rejected embedding Portainer in an iframe. To maximize system integration, performance, and resume impact, we built a custom, fully-featured Docker manager in-house. This includes container metrics, control panels, interactive shells, and lifecycle management communicating directly with the Docker Unix socket `/var/run/docker.sock`.

---

## Completed Architecture & UI

The Docker Manager lives as a single OS window on the desktop (peer to Terminal, File Explorer, Activity Monitor). It features a multi-tab interface:

```
Docker Manager Window
│
├── Containers tab  — main workhorse (table, controls, stats, inspect, logs, interactive exec console)
├── Images tab      — pull with layer progress, list, prune, and run container modal
└── Stacks tab      — docker-compose.yml deployment (V2 Roadmap)
```

---

## 🚀 V1 Completed Milestones

### Phase 1: Backend Docker Engine Connection ✅
* [x] **Docker Socket Configuration:** Configured backend permissions to access the local Unix socket (`/var/run/docker.sock`).
* [x] **Library Setup:** Installed `dockerode` (the Node.js client library for the Docker Remote API) to interact with the socket.
* [x] **Container Status Routes:** Created endpoints to list all containers, retrieve their current states (Running, Stopped, Exited), and fetch CPU/Memory usage metrics.
* [x] **Container Controls:** Implemented routes to `start`, `stop`, `restart`, and `delete` specific containers.

---

### Phase 2: Complete Backend API Surface ✅

#### 2a — Container Stats & Inspection ✅
* [x] **Live stats SSE endpoint:** `GET /api/docker/containers/:id/stats` — opens a persistent Server-Sent Events stream using `container.stats({ stream: true })`. Pushes real-time raw metrics to the frontend to prevent server-side interval overhead and frontend rendering lag.
* [x] **Container inspect endpoint:** `GET /api/docker/containers/:id/inspect` — calls `container.inspect()`. Returns the full container config: env vars, volume mounts, port bindings, network settings, restart policy, entrypoint, labels.
* [x] **Handle no-op state errors:** Catches dockerode's `304 Not Modified` when starting an already-running container or stopping an already-stopped one. Returns `409 Conflict` with a descriptive message like `"Container is already running"` instead of a generic 500.

#### 2b — Live Container Logs (SSE + HTTP) ✅
* [x] **Log streaming SSE route:** `GET /api/docker/containers/:id/logs` — opens a persistent Server-Sent Events stream calling `container.logs({ stdout: true, stderr: true, follow: true, tail: 200, timestamps: true })`. Demuxes 8-byte TTY headers when Tty is false and pipes output over SSE.
* [x] **Stateless log download route:** `GET /api/docker/containers/:id/logs/download` — triggers a browser file attachment download by getting `container.logs({ stdout: true, stderr: true, follow: false })` and streaming it back instantly as a `.log` file.

#### 2c — Container Console (docker exec) ✅
* [x] **Exec WebSocket handler:** In `sockets/containerExec.js`, created a PTY-backed exec session into a running container using dockerode's `container.exec()` API.
* [x] **Auth:** Same JWT cookie check as terminal and log WebSocket handlers.
* [x] **Shell fallback chain:** Inline launcher (`if [ -x /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi`) with `TERM=xterm-256color` environment variable for immediate prompt rendering across all containers (including Alpine Linux).

#### 2d — Images API ✅
* [x] **List images endpoint:** `GET /api/docker/images` — calls `docker.listImages({ all: false })`. Returns repository, tag, image ID (short), size, and created timestamp.
* [x] **Pull image endpoint:** `GET /api/docker/images/pull` — accepts query parameter `?image=nginx:latest`. Calls `docker.pull()` and streams layer progress events back via SSE.
* [x] **Delete image endpoint:** `DELETE /api/docker/images/:id` — calls `docker.getImage(id).remove()`. Returns 409 if the image is in use by a container.
* [x] **Prune dangling images endpoint:** `POST /api/docker/images/prune` — calls `docker.pruneImages()`. Returns the list of deleted image IDs and disk space reclaimed.

#### 2e — Container Creation API ✅
* [x] **Create container endpoint:** `POST /api/docker/containers/create` — accepts `{ name, image, env, ports, volumes, restartPolicy }`. Configures and invokes `docker.createContainer()` via dockerode, then immediately starts it. Handles 409 (name collision) and 404 (image missing).

---

### Phase 3: Live Container Log Streaming (Frontend) ✅
* [x] **Log viewer panel:** In the Containers tab detail view, a "Logs" button opens a scrollable log terminal view. Connects to the Server-Sent Events (SSE) logs endpoint via `EventSource`.
* [x] **Log controls:** Timestamps toggle, pause/resume streaming, clear button, download historical log file.
* [x] **Reconnect on drop:** Automatic reconnection on network interrupts.

---

### Phase 4: Docker Manager Frontend UI ✅

#### 4a — Containers Tab ✅
* [x] **Container table:** Dense data table with columns: Name, Image (tag), Status badge (colored: green=running, grey=stopped, red=exited), Ports (host:container), Age, Actions.
* [x] **Actions per row:** Start / Stop / Restart / Delete (inline icon buttons). Confirmation dialog before delete, plus inline error alerts on conflicts.
* [x] **Detail panel (slide-in or expand):** Sub-tabs for:
  * [x] **Logs** — log streaming terminal & viewer
  * [x] **Console** — xterm.js exec terminal (docker exec into the container over WebSockets)
  * [x] **Inspect** — formatted display of env vars, volumes, port bindings, restart policy, labels
  * [x] **Stats** — live-streamed CPU/RAM/network/disk bar charts
* [x] **State management:** Poll `GET /api/docker/containers` every 5s to refresh the table.
* [x] **Sub-Tab Session Preservation:** Preserves xterm.js console state & history using CSS display toggling while navigating between Stats, Inspect, Logs, and Console.

#### 4b — Images Tab ✅
* [x] **Images table:** Repository, Tag, Image ID (short 12-char), Size, Created. Action buttons: Run Container, Delete.
* [x] **Pull new image form:** Input field (`nginx:latest` style) + Pull button. Real-time layer progress card with 5s error banner retention.
* [x] **Prune button:** "Remove dangling images" (Prune Unused) with real-time refresh.

#### 4d — Container Creation UI ✅
* [x] **Run Container trigger:** Added a purple "Run" (play) button to each image row to open the creation modal.
* [x] **Configuration modal form:** Input fields for Container Name, Port mappings (host:container), Environment variables (key=value), Volume mounts (host:container), and Restart policy.
* [x] **Creation handler:** Dispatches request to creation endpoint, handles conflict error alerts, and automatically switches to the Containers tab upon successful start.
