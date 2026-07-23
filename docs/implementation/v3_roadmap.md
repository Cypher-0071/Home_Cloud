# Home Cloud — V3 Advanced Roadmap

This document outlines upcoming architectural enhancements, data protection tools, and advanced server automation planned for **V3** of the Home Cloud platform.

---

## 🎯 V3 Milestones & Checkpoints

### Phase 1: Smart Network Switcher & Split-Horizon DNS (LAN vs. Remote Detection) ⚡

This feature intelligently routes user traffic based on client location to maximize speed and eliminate bandwidth bottlenecks.

* [ ] **Local Network Detection Engine:** Implement a client-side network detector in the dashboard that performs a micro-ping check to test if the client device is on the same Local Area Network (LAN/Wi-Fi) as the Spare PC.
* [ ] **Automatic Route Selection:**
  * **On Local Network (LAN):** Automatically route container links directly to the host's local IP and port (`http://192.168.x.x:8080`) for instant `< 2ms` latency and 1Gbps local Wi-Fi speeds (essential for 4K video streaming & large file transfers).
  * **On Remote Network (4G/5G / External):** Automatically route traffic through the Cloudflare HTTPS Tunnel subdomain (`https://app.home-cloud.live`).
* [ ] **Dual-Link UI Action Toggle:** Add a dual-action trigger on container cards displaying both the fast **Local LAN Link** (`:8080`) and the secure **Remote Tunnel Link** (`.home-cloud.live`).
* [ ] **Zero Feature Degradation:** Ensure all WebSockets, SSE streams, and container APIs function identically across both local and remote routing paths.

---

### Phase 2: Automated Volume & Database Backup Engine 💾

This feature protects self-hosted app data against hardware failure, corruption, or accidental deletion.

* [ ] **Snapshot Manager:** Build backend worker logic to generate compressed `.tar.gz` archives of container volume mount directories (`/home/rudra-unix/apps/...`).
* [ ] **Database Dump Support:** Implement specialized database backup routines (`pg_dump` for Postgres, `mysqldump` for MariaDB/MySQL) executed via container exec sockets.
* [ ] **Scheduled Cron Backups:** Integrate configurable backup schedules (daily/weekly) with automatic retention policies (e.g. keep last 7 daily backups).
* [ ] **One-Click Restore:** Build a UI restore flow to extract volume snapshots back into host paths and restart affected containers.

---

### Phase 3: Container Health Watchdog & Push Notifications 🔔

This feature monitors app uptime and alerts the host owner immediately if a service crashes or runs out of resources.

* [ ] **Watchdog Monitoring Worker:** Periodically monitor container health states (Detecting `exited`, `unhealthy`, or `restarting` loops).
* [ ] **Threshold Monitoring:** Track containers exceeding high CPU (>90%) or Memory usage limits for sustained periods.
* [ ] **Webhook Alert Dispatcher:** Support sending real-time alert notifications to Discord Webhooks, Telegram Bots, or Ntfy channels.
* [ ] **Alert Preferences UI:** Allow users to toggle notification types and enter webhook URLs directly from the dashboard settings.

---

### Phase 4: Dynamic Resource Quotas & Tuning (`docker update`) ⚙️

This feature prevents individual containers from hogging system memory or CPU and crashing the host OS.

* [ ] **Resource Tuning Endpoint:** `POST /api/docker/containers/:id/resources` — calls `container.update({ Memory, NanoCPUs })` via dockerode.
* [ ] **Live Slider UI:** Add memory (e.g. 256MB, 512MB, 2GB) and CPU core limit sliders inside the container inspect/stats panel.
* [ ] **Dynamic Application:** Apply resource limits on-the-fly without needing to recreate or restart the running container.

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
| **Multi-Container Stacks (`docker-compose`)** | ✅ *(V2: `docker-compose.yml` deployer)* | ✅ | ❌ | ✅ *(Partial)* | ✅ |
| **Smart Split-Horizon DNS (LAN vs Remote)** | ✅ *(V3: `<2ms` LAN vs Remote fallback)* | ❌ | ❌ | ❌ | ❌ *(Requires custom DNS server)* |
| **Automated Volume & DB Snapshots** | ✅ *(V3: `.tar.gz` + DB dumps + Cron)* | ❌ *(Requires extension)* | ❌ | ❌ *(Requires third-party app)* | ✅ |
| **Health Watchdog & Push Notifications** | ✅ *(V3: Discord / Telegram / Ntfy)* | ✅ *(Paid EE only)* | ❌ | ❌ | ✅ |
| **Dynamic Live Resource Tuning (`docker update`)** | ✅ *(V3: Live RAM/CPU sliders)* | ✅ | ❌ | ❌ | ❌ *(Requires container recreate)* |
