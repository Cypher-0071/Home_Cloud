# Home Cloud — V4 Operations & Resiliency Roadmap

This document outlines the container operations, automated maintenance, and desktop workspace enhancements planned for **V4** of Home Cloud once the system is running autonomously on the host server.

---

## 🎯 V4 Milestones & Checkpoints

### Phase 1: Container Crash Watchdog & Webhook Notifications 🔔

This feature monitors container health in the background and immediately dispatches alerts if a critical service crashes or enters a restart loop, without requiring heavy external monitoring tools like Prometheus.

* [ ] **Container Watchdog Engine:**
  * Lightweight background polling worker in the Node.js Agent utilizing the Docker events stream (`docker.getEvents()`) and health check APIs.
  * Real-time detection of non-zero container exit codes (`exited`), failed health checks (`unhealthy`), and OOM (Out Of Memory) kills.
  * Exponential throttling and debounce to prevent notification spam during rapid crash loops.
* [ ] **Webhook Alert Dispatcher:**
  * Outbound webhook integration supporting **Telegram Bots** (`chat_id` + Bot Token) and **Discord Webhooks** (`webhook_url`).
  * Formatted alert cards containing container name, image, exit code, timestamp, and the last 10 lines of container error logs.
* [ ] **Notification Settings UI:**
  * Dedicated settings view in the dashboard to configure webhook destinations, test alert delivery, and toggle specific alert types (Crash, OOM, High Memory).

---

### Phase 2: Simple Automated Volume & Database Backups 💾

This feature ensures application data and state stored inside Docker volumes and bind mounts can be safely backed up and restored without manual command-line intervention.

* [ ] **Automated Volume Snapshots:**
  * Stream-based archive creation (`.tar.gz`) for Docker named volumes and container data directories directly to a designated host backup location.
  * Point-in-time database dump triggers (e.g. `pg_dump` or `mysqldump` executed directly through `docker exec`).
* [ ] **Cron-Scheduled Backup Policies:**
  * Configurable backup frequency (daily, weekly, or custom cron expression) with automatic retention rotation (e.g., keep last 7 daily, 4 weekly snapshots).
* [ ] **Backup Management & Download UI:**
  * Dashboard panel to list available snapshots, view size and creation timestamps, trigger manual backup runs, and download archives directly through the browser.

---

### Phase 3: Desktop Window Layout State Persistence 🖥️

This feature transforms the browser experience from a transient session into a persistent operating environment that remembers exactly how you left your workspace.

* [ ] **Window Layout Persistence Store:**
  * Track open window states, position coordinates (`x`, `y`), dimensions (`width`, `height`), minimized/maximized state, and active z-index stacking order.
  * Client-side persistent cache in `localStorage` synchronized with an agent user profile endpoint for cross-device continuity.
* [ ] **Workspace Session Restoration:**
  * On dashboard login or page reload, automatically restore previously opened windows in their exact positions and sizes.
  * Seamless integration with lazy code-splitting and persistent terminal sessions, reattaching terminal and container monitors smoothly on reload.

