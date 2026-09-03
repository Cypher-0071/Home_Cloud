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

### 6. Grid / Tiles View Toggle (Deferred)
* **Debt**: The file list is locked to the tabular list row layout.
* **Tradeoff**: Alternate visual layouts (such as grid or tiles view) are not implemented, making browsing visual media (like images) less convenient.

### 7. Details Info Pane (Deferred)
* **Debt**: The side info pane for displaying file details, large previews, and extended metadata is not rendered.
* **Tradeoff**: Users cannot inspect detailed file properties without viewing or opening the file.

### 8. Hardcoded Base Directory (BASE_DIR)
* **Debt**: The application has the base directory for file management statically hardcoded to `/home/rudra-unix` in backend configuration scripts.
* **Tradeoff**: Distributing the app to other server hosts or operating systems requires manual search-and-replace edits of source code, instead of reading base directories dynamically from a centralized configuration file or `.env` variable.

### 9. System Monitor Historical Data Loss on Window Unmount
* **Debt**: In `SystemMonitorApp.tsx`, 60-second rolling CPU and memory metrics history are held in React component state.
* **Tradeoff**: Minimizing or closing the Activity Monitor window unmounts the component and resets the historical trend lines, rather than persisting metric buffers in a background context or hook singleton.