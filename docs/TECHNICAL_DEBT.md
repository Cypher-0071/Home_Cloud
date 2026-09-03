# Home Cloud - Technical Debt & Tradeoffs

This document outlines the current technical limitations, security tradeoffs, operational gaps, and implementation shortcuts in the Home Cloud codebase.

---

## 🚨 Active Bugs & Operational Stability

### 1. Ingress Auto-Trigger & Missing `await` on Container Stop
* **Debt**: In `agent/routes/docker.js` (`router.post("/containers/:id/stop")`), `removeIngressByPort(hostPort)` is an asynchronous function returning a Promise. The code evaluates `if (hostPort && removeIngressByPort(hostPort))` synchronously without `await`. In JavaScript, an unresolved Promise is always truthy, causing `removedAny` to evaluate to `true` whenever any container with mapped ports is stopped, regardless of whether it had an ingress rule. Furthermore, `reloadCloudflared()` is called without `await`.
* **Tradeoff / Risk**: Stopping any container unnecessarily triggers a background reload/restart of the Cloudflare tunnel daemon, potentially interrupting active tunnel connections for other exposed services.

### 2. Broken Symlinks Crash Directory Listing in File Explorer
* **Debt**: In `agent/routes/file.js` (`router.get("/")`), `Promise.all(files.map(async (file) => fs.stat(filepath)))` queries metadata for all directory entries. `fs.stat` follows symbolic links and throws `ENOENT` if the target file does not exist (dangling symlink).
* **Tradeoff / Risk**: If a directory contains even a single broken symlink (common in development repos, `.cache`, or `node_modules`), the unhandled error rejects the entire `Promise.all` and returns HTTP 403 `Error reading directory`, completely preventing the user from viewing that folder in File Explorer.

---

## ⚡ Performance & Architecture Gaps

### 3. Tunnel Process Recycling Race Condition
* **Debt**: In `agent/tunnel.js` (`startTunnel()`), recycling an existing tunnel process sends `activeChild.kill("SIGTERM")` and immediately calls `spawn("cloudflared")` on the next line without awaiting the previous process's `close` event.
* **Tradeoff / Risk**: If the outgoing `cloudflared` process takes 100–300ms to clean up socket bindings and release credentials, the newly spawned instance can collide, causing transient restart failures or warnings.

### 4. Monolithic Dashboard Bundle & Missing Route/Window Code-Splitting
* **Debt**: In `dashboard/src/pages/desktop.tsx`, all OS window applications (`DockerApp.tsx`, `FileExplorer`, `TerminalApp.tsx`, and `SystemMonitorApp.tsx`) are statically imported at the root. `DockerApp.tsx` alone contains ~4,500 lines.
* **Tradeoff / Risk**: Vite bundles the entire desktop and all application logic into a single monolithic `~950 kB` JavaScript chunk (`dist/assets/index-*.js`), increasing initial page load latency. Using `React.lazy()` dynamic imports for window applications would cut the initial load bundle by ~60%.

### 5. Uncached Filesystem Drive Metrics
* **Debt**: In `agent/routes/file.js` (`router.get("/drives")`), `si.fsSize()` executes a system shell call (`df`) every time File Explorer opens or navigates to a folder.
* **Tradeoff / Risk**: Rapid directory browsing repeatedly shells out to disk inspection utilities, adding unnecessary latency and CPU overhead. A 5–10 second in-memory cache would eliminate this overhead.

---

## 🔒 Intentional MVP Architectural Tradeoffs

### 6. Hardcoded Security Password
* **Debt**: The security passcode is loaded statically from environment variables (`process.env.PASSWORD`) on the agent.
* **Tradeoff**: There is no client-side UI or API endpoint to change the security passcode dynamically. Password updates require manual editing of the `.env` file on the spare PC and restarting the agent.

### 7. Single-Tenant Authentication
* **Debt**: Authentication handles a single authorized user session via a shared token cookie.
* **Tradeoff**: Multi-user tenancy, role-based access controls (RBAC), and session expiration control panels do not exist. Any user possessing the passcode obtains root control over the system shell.

### 8. Hardcoded Networking & Service Ports
* **Debt**: The agent port `3000` is hardcoded. Cloudflare Tunnel endpoints and VNC terminal target protocols are configured statically.
* **Tradeoff**: Users cannot change binding interfaces or re-route inbound connections to alternative local ports without modifying the agent startup script.

---

## ⏳ Deferred Roadmap Milestones

### 9. Terminal WebSocket Disconnections & Session Resumption (Deferred to Resume Session Milestone)
* **Debt**: The dashboard WebSocket connection for terminal sessions in `TerminalApp.tsx` closes permanently on network hiccups, and the backend immediately destroys the underlying PTY shell process on connection close.
* **Tradeoff**: There is no automatic exponential backoff reconnection mechanism; users must refresh the browser page or re-open the terminal window if the connection drops.
* **Roadmap Plan**: Deferring standalone reconnection fixes to the unified **"Resume Session"** milestone, which will introduce persistent headless PTY sessions (daemonized bash/tmux-style processes) and desktop window state persistence so that shell sessions and running commands survive browser restarts, device switching, and network disconnects seamlessly.

### 10. File Explorer Usability & Navigation (Deferred)
* **Debt**: Keyboard navigation (Arrow keys, Enter to open, Delete/Backspace to delete) is not implemented.
* **Tradeoff**: Users must perform all navigation and operations via mouse actions, limiting efficiency.

### 11. Grid / Tiles View Toggle (Deferred)
* **Debt**: The file list is locked to the tabular list row layout.
* **Tradeoff**: Alternate visual layouts (such as grid or tiles view) are not implemented, making browsing visual media (like images) less convenient.

### 12. Details Info Pane (Deferred)
* **Debt**: The side info pane for displaying file details, large previews, and extended metadata is not rendered.
* **Tradeoff**: Users cannot inspect detailed file properties without viewing or opening the file.