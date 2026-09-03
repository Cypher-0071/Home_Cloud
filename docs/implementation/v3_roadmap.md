# Home Cloud — V3 Advanced Roadmap

This document outlines upcoming architectural enhancements, data protection tools, and reliability automation planned for **V3** of the Home Cloud platform.

---

## 🎯 V3 Milestones & Checkpoints

### Phase 1: Smart Network Switcher & Split-Horizon DNS (LAN vs. Remote Detection) ⚡ ✅ *COMPLETED*

This feature intelligently routes user traffic based on client location to maximize speed and eliminate bandwidth bottlenecks.

* [x] **Local Network Detection Engine:** Implemented a client-side network detector in the dashboard (`useNetworkDetector.ts`) that performs a micro-ping check to `/api/health` with Private Network Access headers to verify whether the client device is on the same Local Area Network (LAN/Wi-Fi) as the server.
* [x] **Automatic Route Selection:**
  * **On Local Network (LAN):** Automatically offers direct routing to the host's local IP and port (`http://192.168.x.x:8080`) for instant `< 2ms` latency and 1Gbps local Wi-Fi speeds (crucial for 4K streaming and large file transfers).
  * **On Remote Network (External):** Transparently routes traffic through the Cloudflare HTTPS Tunnel subdomain (`https://dash.home-cloud.live`).
* [x] **Dual-Link UI Action Toggle:** Added dual-action triggers in the container list displaying both the fast **Direct Local LAN Link** (`:port`) and the secure **Remote Tunnel Link** (`.home-cloud.live`).
* [x] **Taskbar Status & Upgrade Badge:** Integrated a real-time network indicator in the desktop system tray showing connection mode (Direct LAN vs. Tunnel) with one-click instant LAN redirection.

---

### Phase 2: Simple Automated Volume & Database Backups 💾

This feature protects self-hosted application data against power loss, disk failure, or accidental container deletion without unnecessary enterprise complexity.

* [ ] **Volume Tarball Backups:** Build lightweight backend worker logic to generate compressed `.tar.gz` archives of container volume mount directories (`~/apps/...` or named volumes) to a designated `~/backups/` directory or external drive.
* [ ] **Database Dump Integration:** Implement automated database export routines (`pg_dump` for PostgreSQL, `mariadb-dump` / `mysqldump` for MySQL) triggered directly via container exec before snapshotting.
* [ ] **Scheduled Cron Backups:** Provide simple configurable backup schedules (daily/weekly) with automatic retention rotation (e.g., keep the last 7 daily archives).
* [ ] **One-Click Restore Flow:** Build a straightforward UI restore flow to unpack backup archives back into host volume directories and restart affected containers.

---

### Phase 3: Persistent Sessions & State Resumption ("Resume Session") 🖥️

This feature decouples the user's interactive sessions from transient network connections, ensuring long-running tasks survive laptop sleep, device switching, or browser restarts.

* [ ] **Decoupled Backend PTY Daemon:** Refactor `agent/sockets/terminal.js` so that closing a browser tab or experiencing a Wi-Fi drop does not immediately kill the underlying `bash`/`zsh` process. Keep the PTY alive in the background with an output ring buffer.
* [ ] **Seamless Terminal Re-attachment:** When reconnecting from the same or another device, automatically re-attach to the existing running PTY session, replay recent terminal buffer lines, and preserve running processes.
* [ ] **Desktop Window Layout Persistence:** Persist active window states, coordinates, and open applications so logging back into the dashboard restores the workspace exactly where the user left off.

---

### Phase 4: Container Crash Watchdog & Webhook Notifications 🔔

This feature monitors service health and alerts the server owner immediately if a container crashes, without needing heavy monitoring infrastructure.

* [ ] **Crash Watchdog Worker:** Lightweight background polling worker that detects containers entering `exited` (non-zero exit code), `unhealthy`, or rapid restart loops.
* [ ] **Webhook Alert Dispatcher:** Simple outbound webhook integration supporting **Telegram Bots** and **Discord Webhooks** with clean Markdown alert cards.
* [ ] **Notification Settings UI:** Minimal settings panel in the dashboard to configure webhook URLs, test alerts, and toggle notification events.

---

## 📊 Complete Industry Feature Comparison

| Feature Capability | **Home Cloud** | Portainer CE/EE | Umbrel OS | CasaOS | Unraid / Synology DSM |
|---|---|---|---|---|---|
| **Native Desktop Windowing UI** | ✅ *(Pure SPA, zero iframe/extra port)* | ❌ *(Single-app web UI)* | ❌ *(Fixed web grid)* | ❌ *(Fixed web grid)* | ❌ *(Web admin dashboard)* |
| **Container Lifecycle & Telemetry (SSE)** | ✅ *(Real-time raw metrics)* | ✅ *(Polling)* | ❌ | ✅ | ✅ |
| **Interactive Container Console (`docker exec`)** | ✅ *(WebSockets + PTY + `/bin/sh` fallback)* | ✅ | ❌ | ❌ | ❌ *(Requires SSH)* |
| **Live Log Streaming & Attachment Download** | ✅ *(SSE stream + `.log` attachment)* | ✅ | ❌ *(Static view)* | ✅ *(Static view)* | ✅ |
| **Image Management (Layer SSE Pull/Prune)** | ✅ *(Layer-by-layer progress bar)* | ✅ | ❌ | ✅ | ✅ |
| **Custom Container Creation Modal** | ✅ *(Ports, Envs, Mounts, Restart policy)* | ✅ | ❌ | ✅ | ✅ |
| **Zero-Downtime Cloudflare Ingress Auto-Wiring** | ✅ *(V2: CNAME API + `SIGHUP` reload)* | ❌ *(Manual proxy)* | ❌ *(Manual proxy)* | ❌ *(Manual proxy)* | ❌ *(Manual proxy)* |
| **Multi-Container Stacks (`docker-compose`)** | ✅ *(V2: Native compose CLI + 2-way sync)* | ✅ | ❌ | ✅ *(Partial)* | ✅ |
| **Smart Split-Horizon DNS (LAN vs Remote)** | ✅ *(V3: `<2ms` LAN vs Remote fallback)* | ❌ | ❌ | ❌ | ❌ *(Requires custom DNS server)* |
| **Simple Automated Volume & DB Backups** | ⏳ *(V3: `.tar.gz` + DB dumps + Cron)* | ❌ *(Requires extension)* | ❌ | ❌ *(Requires third-party app)* | ✅ |
| **Persistent Sessions ("Resume Session")** | ⏳ *(V3: Headless PTY + Workspace resume)* | ❌ | ❌ | ❌ | ❌ |
| **Crash Watchdog & Webhook Alerts** | ⏳ *(V3: Discord / Telegram notifications)* | ✅ *(Paid EE only)* | ❌ | ❌ | ✅ |
