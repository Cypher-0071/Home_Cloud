# Home Cloud — V2 Future Roadmap

This document outlines all upcoming milestones, architectural goals, and features planned for **V2** of the Home Cloud platform.

---

## 🎯 V2 Milestones & Checkpoints

### Phase 1: Cloudflare Tunnel Auto-Wiring (Ingress Routing) 🌟 *(The Headline Feature)*

This feature automates DNS routing and HTTPS subdomain generation for any running container without opening public ports on your router.

* [ ] **Expose Container endpoint:** `POST /api/docker/containers/:id/expose` — accepts `{ subdomain }`. Extracts the container's mapped host port to prepare it for external routing.
* [ ] **Safe Ingress File Writer:** Write logic to parse and insert the subdomain routing rules into `~/.cloudflared/config.yml` without syntax or indentation errors.
* [ ] **Dynamic DNS Record Creator:** Implement client calls to the Cloudflare API to dynamically create a CNAME record pointing the new subdomain to the tunnel URL.
* [ ] **Zero-Downtime Reloading:** Implement process signaling in the backend using `SIGHUP` to notify the `cloudflared` daemon of configuration changes without dropping active tunnel connections.

---

### Phase 2: Stacks API & UI (docker-compose Deployments)

This feature enables deploying complex, multi-container applications (e.g. Nextcloud + Postgres + Redis) using standard `docker-compose.yml` templates.

* [ ] **Research:** Evaluate running `docker compose` v2 CLI from Node.js by spawning `docker compose -p <name> up -d` inside `~/.home-cloud/stacks/<name>/`.
* [ ] **Deploy stack endpoint:** `POST /api/docker/stacks` — accepts `{ name, composeYaml }`. Writes the YAML to disk and spawns `docker compose up -d`, streaming stdout/stderr back via SSE.
* [ ] **List stacks endpoint:** `GET /api/docker/stacks` — reads stack directories and calls `docker compose ps --format json` to get multi-service status.
* [ ] **Stop & Delete stack endpoints:** `POST /api/docker/stacks/:name/stop` (`docker compose down`) and `DELETE /api/docker/stacks/:name` (`docker compose down --volumes`).
* [ ] **Stacks Tab UI:** Frontend workspace tab featuring stack cards, status badges, log streaming, and a `docker-compose.yml` code editor/deployer.

---

### Phase 3: Complete UI & UX Overhaul

This phase polishes the visual design, animations, and responsiveness across the entire desktop environment.

* [ ] **Unified Theme Engine:** Consolidate design tokens, color palettes, and fonts into CSS variables across the entire dashboard to match the premium dark theme (pure black backing, subtle borders, high contrast badges).
* [ ] **Responsive Split-Pane Layouts:** Refactor the Containers list + detail panel layout to adapt smoothly to smaller windows, collapsing into a single-pane view on narrow viewports.
* [ ] **Interactive Micro-Animations:** Introduce smooth hover scaling, fade-in transitions for split-panes, custom progress loading bars, and tab-switch animations.
* [ ] **Rich Empty States & Feedback:** Upgrade all empty tables and loading screens with custom vector icons, inline instruction cards, and high-fidelity loaders.

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
| Cloudflare Ingress Auto-wiring | ❌ | ❌ | ⏳ V2 Planned (Phase 1) |
| Stacks (docker-compose) | ❌ | ✅ partial | ⏳ V2 Planned (Phase 2) |
| Native OS window UI | ❌ | ❌ | ✅ |
| No iframe / no extra port | ❌ | ❌ | ✅ |
