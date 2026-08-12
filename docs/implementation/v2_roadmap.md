# Home Cloud — V2 Roadmap

This document outlines all completed milestones, architectural goals, and features built in **V2** of the Home Cloud platform.

---

## 🎯 V2 Completed Milestones & Checkpoints

### Phase 1: Cloudflare Tunnel Auto-Wiring (Ingress Routing) ✅ *COMPLETED — 2026-07-27*

This feature automates DNS routing and HTTPS subdomain generation for any running container without opening public ports on your router.

* [x] **Expose Container endpoint:** `POST /api/docker/containers/:id/expose` — accepts `{ subdomain }`. Extracts the container's mapped host port to prepare it for external routing.
* [x] **Safe Ingress File Writer:** Write logic to parse and insert the subdomain routing rules into `~/.cloudflared/config.yml` without syntax or indentation errors.
* [x] **Dynamic DNS Record Creator:** Implement client calls to the Cloudflare API to dynamically create a CNAME record pointing the new subdomain to the tunnel URL.
* [x] **Zero-Downtime Reloading:** Implement process signaling in the backend using `SIGHUP` to notify the `cloudflared` daemon of configuration changes without dropping active tunnel connections.

---

### Phase 2: Stacks API & UI (docker-compose Deployments) ✅ *COMPLETED — 2026-08-11*

This feature enables deploying complex, multi-container applications (e.g. Nextcloud + Postgres + Redis) using standard `docker-compose.yml` templates.

* [x] **Research & Runtime Integration:** Spawning `docker compose -p <name> up -d` inside `~/.home-cloud/stacks/<name>/` and integrating `dockerode-compose` + Docker socket label filtering.
* [x] **Deploy stack endpoint:** `POST /api/docker/stacks/deploy` — accepts `{ name, yaml }`. Writes the YAML to disk and spawns `docker compose up -d`, streaming output line-by-line via SSE.
* [x] **List stacks endpoint:** `GET /api/docker/stacks` — scans `~/.home-cloud/stacks/` and cross-references containers by label `com.docker.compose.project` for instant state detection.
* [x] **Start, Stop & Delete stack endpoints:** `POST /api/docker/stacks/:name/start`, `POST /api/docker/stacks/:name/stop`, and `DELETE /api/docker/stacks/:name` (`docker compose down -v` + dir cleanup).
* [x] **Multi-container log streaming endpoint:** `GET /api/docker/stacks/:name/logs` — streams live stack logs via SSE.
* [x] **Stacks Tab UI:** Workspace tab featuring stack cards grid, running service counters, service state pills, quick templates dropdown (*WordPress*, *Nextcloud*, *PostgreSQL*, *Nginx*), YAML code editor, SSE deployment console, and multi-service log viewer modal.

---

### Phase 3: UI/UX Overhaul ✅ *COMPLETED — 2026-07-26*

Complete visual redesign of the entire desktop shell and all app surfaces.

* [x] **OKLCH Design Token System** — Replaced all hardcoded hex with a layered OKLCH palette (`--bg-base/surface/raised/overlay`), electric teal accent, semantic status colors (`--ok`, `--warn`, `--error`), and motion easing tokens in `index.css`.
* [x] **Shell Restructure — Taskbar** — Removed top bar. Replaced floating dock with a full-width 48px taskbar (grid layout: empty left | app icons center | system tray right). Tunnel status, clock, and sign-out moved to taskbar right zone.
* [x] **Windows-style Window Chrome** — `OSWindow.tsx` rebuilt with right-side controls (minimize `—`, maximize/restore `□`, close `✕`), `46×36px` hit targets, close fills `--error` on hover. Window icon shown left of title.
* [x] **System Monitor Redesign** — Replaced circular `GaugeRing` gauges with horizontal `MeterBar` (6px pill, threshold-colored: teal → amber → red). Added `SparklineChart` (rolling 60-point SVG polyline for CPU history). Modular micro-components.
* [x] **Docker CSS Token Cleanup** — All purple accent removed. Teal tokens applied. Running row tint uses `--ok-dim`. Action button hover states use semantic colors. Modal overlay uses OKLCH alpha.
* [x] **File Explorer CSS Token Cleanup** — Purple selections → teal `accent-dim`. Breadcrumb uses `--mono`. Icon colors rationalized (folders: teal, images: green, docs: red, zips: amber). Gradient progress bars removed.
* [x] **Metrics CSS Token Cleanup** — `backdrop-filter: blur` removed (glassmorphism ban). Status dot pulse animation removed. All hardcoded hex replaced.
* [x] **Absolute bans enforced** — No gradient text, no animated glow spots, no glassmorphism, no side-stripe decorative borders, no status dot pulse.

---

## 📊 Feature Comparison

| Feature | Umbrel | CasaOS | **Home Cloud** |
|---|---|---|---|
| Container list + controls | ✅ | ✅ | ✅ V1 Completed |
| Per-container CPU/RAM | ❌ | ✅ | ✅ V1 Completed |
| Live log streaming | ❌ | ✅ | ✅ V1 Completed |
| Container exec console | ❌ | ❌ | ✅ V1 Completed |
| Images management | ❌ | ✅ | ✅ V1 Completed |
| Container creation modal | ❌ | ✅ | ✅ V1 Completed |
| OKLCH design system + token architecture | ❌ | ❌ | ✅ V2 Completed |
| Windows-style OS shell (taskbar + window chrome) | ❌ | ❌ | ✅ V2 Completed |
| Sparkline CPU history chart | ❌ | ❌ | ✅ V2 Completed |
| Cloudflare Ingress Auto-wiring | ❌ | ❌ | ✅ V2 Completed |
| Stacks (docker-compose API & UI) | ❌ | ✅ partial | ✅ V2 Completed |
| No iframe / no extra port | ❌ | ❌ | ✅ |
