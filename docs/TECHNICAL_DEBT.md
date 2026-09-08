# Home Cloud - Technical Debt & Tradeoffs

This document outlines the current technical limitations, security tradeoffs, operational gaps, and implementation shortcuts in the Home Cloud codebase.

---

## ⚡ Performance & Architecture Gaps

### 1. Tunnel Process Recycling Race Condition
* **Debt**: In `agent/tunnel.js` (`startTunnel()`), recycling an existing tunnel process sends `activeChild.kill("SIGTERM")` and immediately calls `spawn("cloudflared")` on the next line without awaiting the previous process's `close` event.
* **Tradeoff / Risk**: If the outgoing `cloudflared` process takes 100–300ms to clean up socket bindings and release credentials, the newly spawned instance can collide, causing transient restart failures or warnings.

### 2. Uncached Filesystem Drive Metrics
* **Debt**: In `agent/routes/file.js` (`router.get("/drives")`), `si.fsSize()` executes a system shell call (`df`) every time File Explorer opens or navigates to a folder.
* **Tradeoff / Risk**: Rapid directory browsing repeatedly shells out to disk inspection utilities, adding unnecessary latency and CPU overhead. A 5–10 second in-memory cache would eliminate this overhead.

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