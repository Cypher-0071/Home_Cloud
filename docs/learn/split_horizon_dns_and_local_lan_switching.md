# Split-Horizon DNS & Local LAN Transport Switching

This document provides a comprehensive technical reference on **Split-Horizon DNS**, **Local Area Network (LAN) transport switching**, and the architectural strategies used to optimize performance in self-hosted home server platforms.

---

## 📑 Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Fundamentals of Split-Horizon DNS](#2-fundamentals-of-split-horizon-dns)
   - [What is Split-Horizon DNS?](#what-is-split-horizon-dns)
   - [Enterprise Implementation in BIND 9](#enterprise-implementation-in-bind-9)
   - [Consumer Implementation in Pi-hole & Unbound](#consumer-implementation-in-pi-hole--unbound)
   - [The Dynamic vs. Static Local IP Dilemma](#the-dynamic-vs-static-local-ip-dilemma)
3. [Home Cloud's Client-Side Network Detection Strategy](#3-home-clouds-client-side-network-detection-strategy)
   - [Why Client-Side Detection over DNS Zone Hardcoding](#why-client-side-detection-over-dns-zone-hardcoding)
   - [Real-time Agent LAN Discovery](#real-time-agent-lan-discovery)
   - [The 1.5-Second Micro-Ping Protocol](#the-15-second-micro-ping-protocol)
4. [Deep Dive: Two Approaches for Full-App Local Switching](#4-deep-dive-two-approaches-for-full-app-local-switching)
   - [Approach 1: Page Origin Redirection (Recommended)](#approach-1-page-origin-redirection-recommended)
   - [Approach 2: Dynamic In-Memory Transport Provider](#approach-2-dynamic-in-memory-transport-provider)
5. [Subsystem Performance Impact Matrix](#5-subsystem-performance-impact-matrix)
6. [Browser Security & Mixed Content Handling](#6-browser-security--mixed-content-handling)

---

## 1. Executive Summary & Problem Statement

### The Remote Tunnel Bottleneck
In a home server environment (such as Home Cloud), the server runs on a physical PC behind a home Wi-Fi router. Indian ISPs (Jio, Airtel, etc.) use **CGNAT** (Carrier-Grade NAT), meaning your router does not have a public IPv4 address and cannot accept incoming internet connections directly.

To overcome this, Home Cloud uses an **outbound Cloudflare Tunnel (`cloudflared`)**. When you access your server remotely (from 4G/5G or a coffee shop), traffic travels:

```
[ Remote Client ] ──(HTTPS)──► [ Cloudflare Edge ] ──(Tunnel)──► [ Agent on Spare PC ]
```

### The Inefficiency on Home Wi-Fi
When you are sitting on your couch at home, your laptop/phone and your Spare PC are connected to the **same home Wi-Fi router**. 

If you access `https://dash.home-cloud.live` or stream a 4K movie from Jellyfin over the Cloudflare Tunnel while sitting at home:
1. Every packet leaves your house, travels over your ISP connection to Cloudflare's edge servers, and comes back down through the tunnel.
2. Data transfer speeds are capped by your internet plan's upload speed (e.g. 50–100 Mbps).
3. Latency increases by 20ms–100ms.

### The Goal: Instant Local LAN Switching
When connected to home Wi-Fi, we want traffic to travel **directly across the home router**:

```
[ Client Device ] ──────(Direct Gigabit Wi-Fi: < 2ms)──────► [ Spare PC (192.168.x.x:3000) ]
```

This achieves **Gigabit speeds (1000+ Mbps)**, **sub-millisecond latency (< 2ms)**, **zero internet data usage**, and **instant 4K video scrubbing**.

---

## 2. Fundamentals of Split-Horizon DNS

### What is Split-Horizon DNS?
**Split-Horizon DNS** (also known as Dual-Horizon DNS or Split-View DNS) is a networking configuration where a DNS server returns **different IP addresses** for the exact same domain name depending on the source IP address of the requesting client.

```
                              [ Request: "jellyfin.home-cloud.live" ]
                                                 │
                                ┌────────────────┴────────────────┐
                                ▼                                 ▼
                     [ Client on Home Wi-Fi ]           [ Client on Cellular 4G ]
                                │                                 │
                                ▼                                 ▼
                     (Local DNS Server)                (Public DNS Server)
                     Returns: 192.168.1.50             Returns: Cloudflare Tunnel IP
                   (Direct Gigabit Wi-Fi)             (Encrypted Remote Tunnel)
```

---

### Enterprise Implementation in BIND 9
In **BIND 9** (the industry-standard enterprise DNS server), Split-Horizon DNS is implemented natively using **`view` blocks** in `/etc/bind/named.conf`:

```named
// 1. Internal View (For devices on Home Wi-Fi subnet: 192.168.1.0/24)
view "internal-lan" {
    match-clients { 192.168.1.0/24; 127.0.0.1; };

    zone "home-cloud.live" {
        type master;
        file "/etc/bind/db.home-cloud.internal";
        // Record: *.home-cloud.live ➜ 192.168.1.50
    };
};

// 2. External View (For internet queries)
view "external-wan" {
    match-clients { any; };

    zone "home-cloud.live" {
        type master;
        file "/etc/bind/db.home-cloud.external";
        // Record: *.home-cloud.live ➜ CNAME to Cloudflare Tunnel
    };
};
```

---

### Consumer Implementation in Pi-hole & Unbound
In home lab environments, tools like **Pi-hole** or **Unbound** simplify this:
- In Pi-hole's web UI, under **Local DNS ➜ DNS Records**, you add a wildcard record:
  `*.home-cloud.live ➜ 192.168.1.50`
- When your phone is on home Wi-Fi and queries Pi-hole, Pi-hole intercepts `*.home-cloud.live` and returns `192.168.1.50`.

---

### The Dynamic vs. Static Local IP Dilemma

A critical flaw with traditional BIND 9 or Pi-hole split-horizon DNS is **IP instability**:

1. **Home Routers use DHCP:** Most home Wi-Fi routers dynamically assign private IP addresses (e.g. `192.168.1.50`) to connected devices.
2. **If your Spare PC reboots:** Your router might assign it a new IP address, such as `192.168.1.88`.
3. **The Failure Mode:** If BIND 9 or Pi-hole has `192.168.1.50` hardcoded in its zone file, DNS resolution will break because the server is now sitting at `192.168.1.88`.

> [!IMPORTANT]
> **Traditional BIND 9 Requirement:** You MUST log into your home router and configure a **DHCP Reservation (Static Local IP)** for your Spare PC's MAC address to ensure its local IP never changes.

---

## 3. Home Cloud's Client-Side Network Detection Strategy

To eliminate router configuration friction and make local LAN switching work **100% dynamically out-of-the-box**, Home Cloud uses a **Client-Side Smart Switcher** instead of hardcoding DNS zone files.

---

### Why Client-Side Detection over DNS Zone Hardcoding

| Feature / Criteria | Traditional BIND 9 / Pi-hole | Home Cloud Client-Side Switcher |
|---|---|---|
| **Router Setup Required** | 🔴 Must change router DNS settings | 🟢 **Zero router configuration** |
| **Static Local IP Required** | 🔴 Yes (DHCP Reservation mandatory) | 🟢 **No (100% dynamic IP detection)** |
| **Failure Safety** | 🔴 If server powers down, home Wi-Fi DNS breaks | 🟢 Internet access remains 100% unaffected |
| **Cross-Device Portability** | Works network-wide for non-browser apps | Optimized for web browser & dashboard control plane |

---

### Real-time Agent LAN Discovery

The Node.js Agent on your Spare PC checks Linux network interfaces dynamically:

```javascript
// agent/routes/network.js
const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address; // e.g. "192.168.1.50" or "192.168.1.88"
            }
        }
    }
    return null;
}
```

Even if your router reboots and reassigns your server from `192.168.1.50` to `192.168.1.88`, the Agent detects `192.168.1.88` in real-time.

---

### The 1.5-Second Micro-Ping Protocol

```
Step 1: User opens https://dash.home-cloud.live over Internet.
Step 2: Dashboard fetches /api/network/info ➜ Agent returns serverLocalIp: "192.168.1.50".
Step 3: Dashboard fires 1.5-second test ping to http://192.168.1.50:3000/api/health.

         ┌───────────────────────────────────────┐
         │ Is http://192.168.1.50:3000 reachable?│
         └───────────────────┬───────────────────┘
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
    PONG! (< 2ms response)          TIMEOUT / FAILED
             │                               │
             ▼                               ▼
    [ STATE: LOCAL LAN ]            [ STATE: REMOTE ]
   ⚡ Fast Gigabit Wi-Fi           🌐 Cloudflare Tunnel
   http://192.168.1.50:3000        https://dash.home-cloud.live
```

---

## 4. Deep Dive: Two Approaches for Full-App Local Switching

When local LAN presence is confirmed, we want **the entire application** (Terminal, System Monitor, File Explorer, Docker Manager, and Containers) to upgrade to direct local Wi-Fi speeds.

---

### Approach 1: Page Origin Redirection (Recommended ⭐)

When the micro-ping succeeds (`http://192.168.1.50:3000/api/health` responds in `< 2ms`), the dashboard updates the browser location:

```typescript
if (isLocalLAN && window.location.hostname !== serverLocalIp) {
  // Automatically redirect browser tab to local IP
  window.location.href = `http://${serverLocalIp}:3000${window.location.pathname}`;
}
```

#### Why Approach 1 is Superior:
1. **Clean Browser Origin:** The browser's native `window.location.origin` becomes `http://192.168.1.50:3000`.
2. **Automatic Subsystem Upgrade:** Every relative API call (`fetch('/api/files')`), WebSocket connection (`new WebSocket('ws://...')`), and SSE metrics stream (`new EventSource('/api/metrics')`) automatically connects directly to `192.168.1.50:3000` on local Wi-Fi.
3. **Zero Code Duplication:** No need to refactor individual React components to prepend base URLs.
4. **Cookie Authentication:** HTTP cookies automatically send on the local origin.

---

### Approach 2: Dynamic In-Memory Transport Provider

Instead of a page refresh, a global React `TransportContext` supplies `apiBaseUrl` and `wsBaseUrl` dynamically:

```typescript
const TransportContext = createContext({
  apiBaseUrl: '',
  wsBaseUrl: '',
});

export function TransportProvider({ children }) {
  const { isLocalLAN, serverLocalIp } = useNetworkDetector();

  const apiBaseUrl = isLocalLAN ? `http://${serverLocalIp}:3000` : '';
  const wsBaseUrl = isLocalLAN
    ? `ws://${serverLocalIp}:3000/ws`
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

  return (
    <TransportContext.Provider value={{ apiBaseUrl, wsBaseUrl }}>
      {children}
    </TransportContext.Provider>
  );
}
```

#### Trade-offs of Approach 2:
- **Pros:** No 0.5-second browser page refresh.
- **Cons:** Requires updating every `fetch()`, `EventSource`, and `WebSocket` instance across the entire frontend codebase to explicitly prefix URLs.

---

## 5. Subsystem Performance Impact Matrix

| Subsystem | Remote Tunnel (`.home-cloud.live`) | Local LAN Direct (`192.168.1.50:3000`) | Performance Gain |
|---|---|---|---|
| **Terminal (`xterm.js`)** | `wss://` over Cloudflare (20–60ms latency) | `ws://` direct (**< 1ms latency**) | ⚡ Instant native typing speed |
| **File Explorer (Uploads/Downloads)** | 10–50 Mbps (capped by ISP upload speed) | **1000+ Mbps** Gigabit local Wi-Fi | 🚀 **20x–50x faster file transfers** |
| **Activity Monitor Metrics** | SSE stream buffered by Cloudflare proxy | Direct HTTP SSE stream | ⚡ Real-time instant meter updates |
| **Docker Manager** | Remote REST API calls | Direct local REST API calls | ⚡ Instant table & log refreshes |
| **App Containers (Jellyfin)** | `https://jellyfin.home-cloud.live` | `http://192.168.1.50:8096` | 🚀 **Instant 4K video scrubbing** |

---

## 6. Browser Security & Mixed Content Handling

### The Mixed Content Rule
Modern browsers enforce **Mixed Content Security Rules**:
> An HTTPS web page (`https://dash.home-cloud.live`) cannot perform background `http://` API fetches to insecure local endpoints (`http://192.168.1.50`).

### How Home Cloud Handles Security Safely:
1. **Background Micro-Ping Safeguard:** The micro-ping fetch is wrapped in a `try/catch` block with a 1.5s timeout. If a browser blocks background HTTP fetches on HTTPS pages, the catch block gracefully falls back to Remote Tunnel mode.
2. **New Tab Window Opening:** Container links and local dashboard redirects use `window.open('http://192.168.1.50:8096')` or `window.location.href`. Browsers **explicitly allow** opening HTTP links in new tabs even when launched from an HTTPS origin!
