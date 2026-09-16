# Home Cloud - Technical Debt & Tradeoffs

This document outlines the current technical limitations, security tradeoffs, operational gaps, and implementation shortcuts in the Home Cloud codebase.

---

## ⚡ Performance & Architecture Gaps

### 1. Tunnel Process Recycling Race Condition (Resolved ✅)
* **Status**: Resolved in V3 Phase 4, Step 1.
* **Resolution**: Implemented clean, asynchronous process termination and recycling in `agent/tunnel.js`. When starting, restarting, or stopping the tunnel, existing `activeChild` processes are sent `SIGTERM` and awaited on `'close'` with a 3000ms `SIGKILL` escalation fallback before spawning any new process. Added graceful shutdown signal handling (`SIGTERM`/`SIGINT`), HTTP connection draining, WebSocket and PTY cleanup (`closeAllSessions()`), and an exponential backoff tunnel retry loop (2s to 30s) for boot-time network resilience.

### 2. Uncached Filesystem Drive Metrics (Resolved ✅)
* **Status**: Resolved.
* **Resolution**: Implemented in-memory TTL caching (10s) and in-flight promise request coalescing in `agent/routes/file.js` via `getFilteredDrives()`. Rapid folder navigation in File Explorer now returns cached filesystem drive metadata instantaneously with zero repeated `df` system shell calls or disk I/O overhead. Verified with automated test suite in `agent/tests/verify_drives_cache.mjs`.

---

## 🔒 Intentional MVP Architectural Tradeoffs

### 3. Hardcoded Security Password
* **Debt**: The security passcode is loaded statically from environment variables (`process.env.PASSWORD`) on the agent.
* **Tradeoff**: There is no client-side UI or API endpoint to change the security passcode dynamically. Password updates require manual editing of the `.env` file on the spare PC and restarting the agent.

### 4. Single-Tenant Authentication
* **Debt**: Authentication handles a single authorized user session via a shared token cookie.
* **Tradeoff**: Multi-user tenancy, role-based access controls (RBAC), and session expiration control panels do not exist. Any user possessing the passcode obtains root control over the system shell.

### 5. Hardcoded Networking & Service Ports
* **Debt**: The agent port `3000` is hardcoded. Cloudflare Tunnel endpoints and VNC terminal target protocols are configured statically.
* **Tradeoff**: Users cannot change binding interfaces or re-route inbound connections to alternative local ports without modifying the agent startup script.

---

## ⏳ Deferred Roadmap Milestones

### 6. Desktop Window Layout State Persistence (Deferred to V4 Roadmap Milestone)
* **Debt**: Active open windows, positions, and coordinates are held in transient React state in `desktop.tsx` and reset upon browser refresh.
* **Tradeoff**: Refreshing the browser or logging in from another device opens a blank desktop shell rather than restoring the user's active window layout.

### 7. File Explorer Usability & Navigation (Deferred)
* **Debt**: Keyboard navigation (Arrow keys, Enter to open, Delete/Backspace to delete) is not implemented.
* **Tradeoff**: Users must perform all navigation and operations via mouse actions, limiting efficiency.

### 8. Grid / Tiles View Toggle (Deferred)
* **Debt**: The file list is locked to the tabular list row layout.
* **Tradeoff**: Alternate visual layouts (such as grid or tiles view) are not implemented, making browsing visual media (like images) less convenient.

### 9. Details Info Pane (Deferred)
* **Debt**: The side info pane for displaying file details, large previews, and extended metadata is not rendered.
* **Tradeoff**: Users cannot inspect detailed file properties without viewing or opening the file.