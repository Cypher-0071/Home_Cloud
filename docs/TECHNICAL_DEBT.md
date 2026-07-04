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

### 5. Search in file explorer

--- try karo ek baar kuch gadbad hai shyd se ("go" likhne par 2 duplicate folder aare and ranking bhi kuch khas badia ni hai baki search results ki)