# Home Cloud - Technical Debt & Tradeoffs

This document outlines the current technical limitations, security tradeoffs, and implementation shortcuts in the Home Cloud codebase.

### 1. Hardcoded Security Password
* **Debt**: The security passcode is loaded statically from environment variables (`process.env.PASSWORD`) on the agent.
* **Tradeoff**: There is no client-side UI or API endpoint to change the security passcode dynamically. Password updates require manual editing of the `.env` file on the spare PC and restarting the agent.

### 2. Single-Tenant Authentication
* **Debt**: Authentication handles a single authorized user session via a shared token cookie.
* **Tradeoff**: Multi-user tenancy, role-based access controls (RBAC), and session expiration control panels do not exist. Any user possessing the passcode obtains root control over the system shell.

### 3. Hardcoded Networking & Service Ports
* **Debt**: The agent port `3000` is hardcoded. Cloudflare Tunnel endpoints and VNC terminal target protocols are configured statically.
* **Tradeoff**: Users cannot change binding interfaces or re-route inbound connections to alternative local ports without modifying the agent startup script.

### 4. Direct WebSocket Connections without Auto-Reconnect
* **Debt**: The dashboard WebSocket connection for terminal sessions in `TerminalApp.tsx` closes permanently on network hiccups.
* **Tradeoff**: There is no automatic exponential backoff reconnection mechanism; users must refresh the browser page or re-open the terminal window if the connection drops.

### 5. File Explorer Usability & Navigation (Deferred)
* **Debt**: Keyboard navigation (Arrow keys, Enter to open, Delete/Backspace to delete) is not implemented.
* **Tradeoff**: Users must perform all navigation and operations via mouse actions, limiting efficiency.

### 6. Multi-Select & Batch Operations (Deferred)
* **Debt**: The explorer only allows single-item selection and single-item copy, cut, delete, and rename.
* **Tradeoff**: Standard batch operations (such as selecting multiple files with Ctrl/Shift for batch copy or delete) are not supported.

### 7. Grid / Tiles View Toggle (Deferred)
* **Debt**: The file list is locked to the tabular list row layout.
* **Tradeoff**: Alternate visual layouts (such as grid or tiles view) are not implemented, making browsing visual media (like images) less convenient.

### 8. Column Header Sorting (Deferred)
* **Debt**: Clicking on the column headers ("Name", "Size", "Date Modified") does not sort the files.
* **Tradeoff**: The user cannot change the sort order of files dynamically in-memory.

### 9. Details Info Pane (Deferred)
* **Debt**: The side info pane for displaying file details, large previews, and extended metadata is not rendered.
* **Tradeoff**: Users cannot inspect detailed file properties without viewing or opening the file.

### 10. Hardcoded Base Directory (BASE_DIR)
* **Debt**: The application has the base directory for file management statically hardcoded to `/home/rudra-unix` in backend configuration scripts.
* **Tradeoff**: Distributing the app to other server hosts or operating systems requires manual search-and-replace edits of source code, instead of reading base directories dynamically from a centralized configuration file or `.env` variable.

### 11. Docker Container Lifecycle — No-op State Errors (Deferred)
* **Debt**: The container control routes (`/start`, `/stop`, `/restart`) do not handle the case where the action is a no-op — e.g. starting an already-running container or stopping an already-stopped one. Docker returns a `304 Not Modified` in this case, which dockerode surfaces as a thrown error, causing the route to return a generic `500`.
* **Tradeoff**: The frontend receives a confusing error response for what is effectively a harmless operation. Should be caught separately and returned as a `200` or a descriptive `409 Conflict` with a message like `"Container is already running"`.

### 12. Password Equality Edge Case in Auth Route
* **Debt**: In `agent/routes/auth.js`, `process.env.PASSWORD === req.body.password` performs direct equality comparison without verifying that `process.env.PASSWORD` is truthy and non-empty.
* **Tradeoff**: If `PASSWORD` is omitted in the server `.env`, `undefined === undefined` evaluates to `true`, potentially allowing unauthenticated requests to log in with an empty JSON body `{}`.

### 13. Named Docker Volumes Blocked by Path Jailing
* **Debt**: In `agent/routes/docker.js` (`/containers/create`), volume mounts are validated strictly with `jailPath(v.hostPath)`.
* **Tradeoff**: Standard named Docker volumes (e.g. `pgdata`, `mariadb_data`) without path separators are rejected with `403 Forbidden ("Host path must be inside BASE_DIR")`. The backend lacks differentiation between host directory bind mounts and named Docker volumes.

### 14. Docker Compose Engine Hybridization & V2 Spec Gaps
* **Debt**: In `agent/routes/stacks.js`, stack management mixes the legacy `dockerode-compose` library with raw `docker compose` CLI child process executions.
* **Tradeoff**: `dockerode-compose` does not support modern Compose Specification V2 features (e.g., `develop`, modern port ranges, profiles). Standardizing entirely on streaming `docker compose` CLI child processes will ensure uniform Compose V2 compatibility.

### 15. Ingress YAML Autowiring Race Condition & Concurrency Locking
* **Debt**: In `agent/services/ingress.js`, `config.yaml` is read, modified, and written synchronously on container expose/unexpose operations without concurrency locks or job queues.
* **Tradeoff**: Rapid or concurrent container operations can cause race conditions during Cloudflare ingress configuration updates, risking YAML syntax corruption.

### 16. One-Way Form-to-YAML Synchronization in Deploy Modal
* **Debt**: In `DockerApp.tsx`, visual form fields dynamically serialize into `docker-compose.yml`, but custom YAML edits made inside the YAML Editor are not parsed back into visual form cards when switching back to Form View.
* **Tradeoff**: Switching back to Form View after making edits in the YAML Editor causes Form View to retain its previous visual state rather than reflecting the updated YAML contents.

### 17. File Explorer Breadcrumb Overflow on Deep Paths
* **Debt**: In `dashboard/src/pages/files.tsx`, deep directory hierarchies can push breadcrumb links off-screen.
* **Tradeoff**: The breadcrumbs container does not auto-scroll horizontally to keep the active terminal folder in view on narrow screens or deeply nested directories.

### 18. System Monitor Historical Data Loss on Window Unmount
* **Debt**: In `SystemMonitorApp.tsx`, 60-second rolling CPU and memory metrics history are held in React component state.
* **Tradeoff**: Minimizing or closing the Activity Monitor window unmounts the component and resets the historical trend lines, rather than persisting metric buffers in a background context or hook singleton.