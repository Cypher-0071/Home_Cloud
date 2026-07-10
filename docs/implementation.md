# Docker Integration Roadmap

This document outlines the milestones and checkpoints for adding Docker container management and a one-click App Store to the Home Cloud platform.

---

## 🚀 Milestones & Checkpoints

### Phase 1: Backend Docker Engine Connection
* [ ] **Docker Socket Configuration:** Configure backend permissions to access the local Unix socket (`/var/run/docker.sock`).
* [ ] **Library Setup:** Install `dockerode` (the Node.js client library for the Docker Remote API) to interact with the socket.
* [ ] **Container Status Routes:** Create endpoints to list all containers, retrieve their current states (Running, Stopped, Exited), and fetch CPU/Memory usage metrics.
* [ ] **Container Controls:** Implement routes to `start`, `stop`, `restart`, and `delete` specific containers.

### Phase 2: Live Container Log Streaming
* [ ] **Log Access logic:** Hook into the Docker log streams (stdout/stderr) for individual containers.
* [ ] **WebSocket/SSE Channel:** Create a real-time event channel to pipe live container outputs to the dashboard.
* [ ] **Frontend Terminal/Log Panel:** Build a log viewer modal using xterm.js (reusing the terminal component styling) to display running logs.

### Phase 3: The One-Click App Catalog
* [ ] **App Database Definition:** Design a local JSON catalog listing popular self-hosted apps (e.g., Plex, Jellyfin, Nextcloud, Pi-hole) with their default Docker configurations (image names, default ports, environment variables, and volume mount paths).
* [ ] **Container Installer Endpoint:** Implement a POST route that pulls the specified Docker image, configures network ports, sets up persistent volume mounts in `/home/rudra-unix/apps/`, and starts the container.
* [ ] **Port Manager:** Build a backend port allocator to prevent port conflicts when spinning up new services.

### Phase 4: Frontend App Center UI
* [ ] **App Grid Layout:** Create a grid dashboard showing installed apps with custom icons, running statuses, and quick links to open their web portals.
* [ ] **Catalog Browser:** Build the visual App Store where users can search, browse, and click "Install" on new containers.
* [ ] **System resource allocation:** Display memory and CPU load metrics specifically segmented by running container.
