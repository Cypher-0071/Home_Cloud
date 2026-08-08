#!/usr/bin/env python3
"""
Home Cloud — System Architecture Diagram generator.
Renders docs/system_design.excalidraw.png from live codebase structure.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Canvas ──────────────────────────────────────────────────────────────────
W, H = 3600, 3000
OUT = Path(__file__).resolve().parent.parent / "system_design.excalidraw.png"

# ── Palette (dark, teal-accent, product-aligned) ────────────────────────────
BG = "#0f1117"
ZONE_BORDER = "#2a3142"
TEXT = "#e8eaed"
TEXT_DIM = "#9aa3b2"
TEXT_MUTED = "#6b7385"
TITLE = "#f0f3f8"
TEAL = "#2dd4bf"
TEAL_DIM = "#0d3d38"
TEAL_BORDER = "#14b8a6"
BLUE = "#60a5fa"
BLUE_FILL = "#152238"
BLUE_BORDER = "#3b82f6"
PURPLE = "#c4b5fd"
PURPLE_FILL = "#1e1635"
PURPLE_BORDER = "#8b5cf6"
GREEN = "#4ade80"
GREEN_FILL = "#12261a"
GREEN_BORDER = "#22c55e"
AMBER = "#fbbf24"
AMBER_FILL = "#2a2110"
AMBER_BORDER = "#f59e0b"
ORANGE = "#fb923c"
ORANGE_FILL = "#2a1a10"
ORANGE_BORDER = "#f97316"
RED = "#f87171"
PINK = "#f472b6"
CYAN = "#22d3ee"
WHITE = "#ffffff"
ZONE_FILL = "#141820"
ZONE_FILL_2 = "#181c26"
CARD = "#1a1f2b"
CARD_ALT = "#1e2433"
LINE = "#4b5568"
LINE_SOFT = "#374151"


def load_fonts():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
    ]
    regular = bold = None
    for p in candidates:
        if "Bold" in p or "Ubuntu-B" in p:
            if Path(p).exists() and bold is None:
                bold = p
        else:
            if Path(p).exists() and regular is None:
                regular = p
    if regular is None:
        regular = bold
    if bold is None:
        bold = regular

    def f(size, weight="reg"):
        path = bold if weight == "bold" else regular
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            return ImageFont.load_default()

    return {
        "title": f(42, "bold"),
        "h1": f(26, "bold"),
        "h2": f(20, "bold"),
        "h3": f(16, "bold"),
        "body": f(15, "reg"),
        "small": f(13, "reg"),
        "tiny": f(12, "reg"),
        "mono": f(13, "reg"),
        "mono_sm": f(11, "reg"),
        "label": f(14, "bold"),
    }


F = load_fonts()


def rounded_rect(draw, xy, r, fill=None, outline=None, width=2):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, s, font, fill=TEXT, anchor=None):
    draw.text(xy, s, font=font, fill=fill, anchor=anchor)


def multiline(draw, x, y, lines, font, fill=TEXT, line_h=None, max_w=None):
    lh = line_h or (font.size + 6)
    for i, line in enumerate(lines):
        text(draw, (x, y + i * lh), line, font, fill=fill)
    return y + len(lines) * lh


def arrow(draw, x1, y1, x2, y2, color=TEAL, width=3, label=None, label_fill=TEXT_DIM):
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    # arrowhead
    import math

    ang = math.atan2(y2 - y1, x2 - x1)
    size = 12
    a1 = (x2 - size * math.cos(ang - 0.4), y2 - size * math.sin(ang - 0.4))
    a2 = (x2 - size * math.cos(ang + 0.4), y2 - size * math.sin(ang + 0.4))
    draw.polygon([(x2, y2), a1, a2], fill=color)
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        # slight offset perpendicular
        ox = -10 * math.sin(ang)
        oy = 10 * math.cos(ang)
        text(draw, (mx + ox, my + oy), label, F["tiny"], fill=label_fill, anchor="mm")


def double_arrow(draw, x1, y1, x2, y2, color=TEAL, width=3, label=None):
    import math

    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 11
    for (px, py), sign in [((x2, y2), 1), ((x1, y1), -1)]:
        a = ang if sign == 1 else ang + math.pi
        a1 = (px - size * math.cos(a - 0.4), py - size * math.sin(a - 0.4))
        a2 = (px - size * math.cos(a + 0.4), py - size * math.sin(a + 0.4))
        draw.polygon([(px, py), a1, a2], fill=color)
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        text(draw, (mx, my - 14), label, F["tiny"], fill=TEXT_DIM, anchor="mm")


def card(draw, x, y, w, h, title, lines, *, fill=CARD, border=TEAL_BORDER, title_color=TEAL, body_color=TEXT_DIM, title_font=None, body_font=None, r=10):
    rounded_rect(draw, (x, y, x + w, y + h), r, fill=fill, outline=border, width=2)
    tf = title_font or F["h3"]
    bf = body_font or F["small"]
    text(draw, (x + 14, y + 12), title, tf, fill=title_color)
    cy = y + 38
    for line in lines:
        text(draw, (x + 14, cy), line, bf, fill=body_color)
        cy += bf.size + 5
    return (x, y, x + w, y + h)


def zone(draw, x, y, w, h, title, *, fill=ZONE_FILL, border=ZONE_BORDER, title_color=TEXT, badge=None, badge_color=TEAL):
    rounded_rect(draw, (x, y, x + w, y + h), 16, fill=fill, outline=border, width=2)
    text(draw, (x + 20, y + 14), title, F["h1"], fill=title_color)
    if badge:
        bw = len(badge) * 9 + 24
        bx = x + w - bw - 16
        by = y + 14
        rounded_rect(draw, (bx, by, bx + bw, by + 28), 8, fill=TEAL_DIM, outline=badge_color, width=1)
        text(draw, (bx + bw / 2, by + 14), badge, F["small"], fill=badge_color, anchor="mm")


def section_label(draw, x, y, s, color=TEXT_MUTED):
    text(draw, (x, y), s, F["label"], fill=color)


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # ════════════════════════════════════════════════════════════════════════
    # TITLE
    # ════════════════════════════════════════════════════════════════════════
    text(d, (W // 2, 36), "HOME CLOUD  —  System Architecture", F["title"], fill=TITLE, anchor="mt")
    text(
        d,
        (W // 2, 88),
        "Self-hosted control plane for a spare Linux PC  |  Cloudflare Tunnel + Node.js Agent + Docker + React Web-OS Dashboard",
        F["body"],
        fill=TEXT_DIM,
        anchor="mt",
    )
    text(
        d,
        (W // 2, 112),
        "Monorepo: pnpm workspaces  ·  agent/ (CommonJS Express)  ·  dashboard/ (React + Vite + TS)  ·  Domain: home-cloud.live / dash.home-cloud.live",
        F["small"],
        fill=TEXT_MUTED,
        anchor="mt",
    )

    # ════════════════════════════════════════════════════════════════════════
    # LAYER 1 — CLIENT (Browser)
    # ════════════════════════════════════════════════════════════════════════
    zone(d, 40, 150, 1700, 520, "1. CLIENT  —  Browser (any device, anywhere)", fill="#12161f", border=BLUE_BORDER, badge="Control Plane UI")

    # Login
    card(
        d, 60, 210, 300, 160, "Login Page  /login",
        [
            "POST /api/auth/login { password }",
            "JWT set as httpOnly cookie",
            "secure:true  ·  expires 7d",
            "ProtectedRoute guards shell",
        ],
        fill=BLUE_FILL, border=BLUE_BORDER, title_color=BLUE,
    )

    # Desktop shell
    card(
        d, 380, 210, 420, 160, "Desktop Shell  (Web OS)",
        [
            "OSWindow: drag / resize / min / max",
            "Taskbar: app icons + clock + tray",
            "Tunnel status indicator  ·  Sign out",
            "Deep-links: /terminal /files /docker",
            "ErrorBoundary per app window",
        ],
        fill=BLUE_FILL, border=BLUE_BORDER, title_color=BLUE,
    )

    # Four apps row
    apps = [
        (60, 390, "Activity Monitor", [
            "SSE → GET /api/metrics",
            "CPU / RAM / Disk every 2s",
            "MeterBar + SparklineChart",
            "EventSource auto-reconnect",
        ], GREEN, GREEN_FILL, GREEN_BORDER),
        (470, 390, "File Explorer", [
            "REST → /api/files/*",
            "Browse · upload · download",
            "rename · copy · move · mkdir",
            "search · drives · view",
            "BASE_DIR path sandbox",
        ], AMBER, AMBER_FILL, AMBER_BORDER),
        (880, 390, "Terminal", [
            "WebSocket → /ws (host)",
            "xterm.js + FitAddon",
            "Bidirectional raw bytes",
            "node-pty host bash session",
        ], PURPLE, PURPLE_FILL, PURPLE_BORDER),
        (1290, 390, "Docker Manager", [
            "REST + SSE + WS exec",
            "Containers · Images tabs",
            "Logs / Stats / Inspect / Console",
            "Create · Expose / Unexpose",
            "Pull layer progress (SSE)",
        ], TEAL, TEAL_DIM, TEAL_BORDER),
    ]
    for x, y, title, lines, tc, fill, border in apps:
        card(d, x, y, 390, 170, title, lines, fill=fill, border=border, title_color=tc)

    # Data plane note
    card(
        d, 1290, 210, 420, 160, "Data Plane (separate tabs)",
        [
            "Installed apps open via window.open()",
            "https://<sub>.home-cloud.live",
            "NOT iframe (X-Frame-Options)",
            "Control plane vs data plane split",
        ],
        fill=ORANGE_FILL, border=ORANGE_BORDER, title_color=ORANGE,
    )

    # ════════════════════════════════════════════════════════════════════════
    # LAYER 2 — CLOUDFLARE EDGE
    # ════════════════════════════════════════════════════════════════════════
    zone(d, 1800, 150, 1760, 520, "2. CLOUDFLARE EDGE NETWORK", fill="#12161f", border=ORANGE_BORDER, badge="Public HTTPS")

    card(
        d, 1820, 210, 520, 200, "DNS + Tunnel Routing",
        [
            "Zone: home-cloud.live",
            "dash.home-cloud.live → tunnel",
            "*.home-cloud.live hostnames",
            "CNAME → <tunnel-id>.cfargotunnel.com",
            "TLS terminated at edge (HTTPS)",
            "No inbound ports on home router",
        ],
        fill=ORANGE_FILL, border=ORANGE_BORDER, title_color=ORANGE,
    )

    card(
        d, 2370, 210, 560, 200, "Why Cloudflare Tunnel?",
        [
            "Indian ISPs use CGNAT (no public IP)",
            "Outbound-only from spare PC",
            "Flips connection direction",
            "Free stable HTTPS hostnames",
            "Works behind home NAT / CGNAT",
            "One process, many hostnames",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )

    card(
        d, 2960, 210, 570, 200, "Traffic Types Through Tunnel",
        [
            "HTTPS REST  →  Agent Express",
            "HTTP Upgrade →  WebSocket (ws)",
            "SSE streams  →  metrics / logs / pull",
            "Static assets →  dashboard/dist",
            "App UIs     →  container host ports",
            "Idle keepalive via SSE heartbeats",
        ],
        fill=ORANGE_FILL, border=ORANGE_BORDER, title_color=ORANGE,
    )

    # Ingress mapping visual
    card(
        d, 1820, 430, 1710, 210, "Ingress Mapping (logical — enforced in ~/.cloudflared/config.yml on host)",
        [
            "dash.home-cloud.live          →  http://localhost:3000     (Agent + React SPA + WS upgrade)",
            "jellyfin.home-cloud.live      →  http://localhost:8096     (example container host port)",
            "sonarr.home-cloud.live        →  http://localhost:8989",
            "pihole.home-cloud.live        →  http://localhost:8080",
            "<subdomain>.home-cloud.live   →  http://localhost:<hostPort>   via POST /api/docker/containers/:id/expose",
            "catch-all                     →  http_status:404   (MUST be last rule in config.yml)",
        ],
        fill=CARD, border=ORANGE_BORDER, title_color=ORANGE, body_font=F["mono"],
    )

    # ════════════════════════════════════════════════════════════════════════
    # ARROWS: Browser ↔ Cloudflare ↔ Tunnel
    # ════════════════════════════════════════════════════════════════════════
    # Browser to CF horizontal connection indicator under both zones
    double_arrow(d, 860, 690, 1820, 690, color=ORANGE, width=3, label="HTTPS  (browser  <->  Cloudflare Edge)")

    # ════════════════════════════════════════════════════════════════════════
    # LAYER 3 — SPARE PC
    # ════════════════════════════════════════════════════════════════════════
    zone(
        d, 40, 740, 3520, 1880,
        "3. SPARE PC  (Linux, always-on, lid closed)  —  HandleLidSwitch=ignore",
        fill="#10141c", border=TEAL_BORDER, badge="Home Server Host",
    )

    # ── 3a cloudflared ─────────────────────────────────────────────────────
    zone(d, 60, 810, 3480, 200, "3a. cloudflared  (child process spawned by Agent)", fill=ZONE_FILL_2, border=AMBER_BORDER, title_color=AMBER)

    card(
        d, 80, 870, 560, 120, "tunnel.js",
        [
            "spawn('cloudflared', ['tunnel','--config',",
            "  '~/.cloudflared/config.yml','run','home-cloud'])",
            "startTunnel() · restartTunnel() on reload",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER, body_font=F["mono_sm"],
    )
    card(
        d, 660, 870, 700, 120, "Config & Credentials",
        [
            "~/.cloudflared/config.yml  (ingress rules)",
            "credentials-file → tunnel UUID json",
            "Named tunnel: home-cloud",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )
    card(
        d, 1380, 870, 720, 120, "Reload Strategy",
        [
            "ingress.js → reloadCloudflared()",
            "Currently: restartTunnel() respawns process",
            "Docs also describe SIGHUP zero-downtime path",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )
    card(
        d, 2120, 870, 680, 120, "Outbound Tunnel",
        [
            "cloudflared → Cloudflare edge (outbound)",
            "All hostnames share ONE tunnel process",
            "Resolves when 'Registered tunnel connection'",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )
    card(
        d, 2820, 870, 700, 120, "Who writes ingress?",
        [
            "services/ingress.js (js-yaml)",
            "addIngressRule / removeIngressRule",
            "removeIngressByPort (on container stop)",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )

    # Arrow CF edge down to cloudflared
    arrow(d, 2680, 690, 2680, 810, color=AMBER, width=3, label="outbound tunnel")

    # ── 3b Node Agent ──────────────────────────────────────────────────────
    zone(
        d, 60, 1030, 2300, 1100,
        "3b. Node.js Agent  —  Express v5 + ws  ·  port 3000  ·  CommonJS",
        fill=ZONE_FILL_2, border=PURPLE_BORDER, title_color=PURPLE, badge="Control Plane Core",
    )

    # Request pipeline
    card(
        d, 80, 1095, 720, 200, "HTTP Request Pipeline (order critical)",
        [
            "1. express.json() + cookie-parser",
            "2. /api/auth     PUBLIC  (login/logout)",
            "3. /api/*        authMiddleware (JWT cookie)",
            "4. /api/metrics  /api/files  /api/docker",
            "5. express.static(../dashboard/dist)",
            "6. GET /{*path} → index.html  (SPA fallback)",
            "Note: /api/health currently behind auth middleware",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE, body_font=F["mono_sm"],
    )

    # Auth
    card(
        d, 820, 1095, 480, 200, "Auth  routes/auth.js + middleware",
        [
            "POST /api/auth/login",
            "  password === process.env.PASSWORD",
            "  jwt.sign({authorized:true}, JWT_SECRET, 7d)",
            "  Set-Cookie: token (httpOnly, secure)",
            "POST /api/auth/logout → clearCookie",
            "middleware: jwt.verify cookie on /api/*",
        ],
        fill="#2a1520", border=RED, title_color=RED,
    )

    # WebSocket router
    card(
        d, 1320, 1095, 1020, 200, "WebSocket Router  (ws attached to same HTTP server via upgrade)",
        [
            "wss.on('connection')  path-based demux on request.url",
            "  /ws/docker/exec?*  →  sockets/containerExec.js   (docker exec PTY into container)",
            "  default / other    →  sockets/terminal.js        (host bash via node-pty)",
            "Both handlers re-check JWT from Cookie header (cookie + jsonwebtoken)",
            "Single port 3000 for HTTP + WS  —  no second port, no reverse proxy inside Express",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE,
    )

    # Metrics routes
    card(
        d, 80, 1315, 540, 230, "Metrics  routes/metrics.js",
        [
            "GET /api/metrics  (SSE)",
            "systeminformation:",
            "  currentLoad · mem · fsSize",
            "Emit every 2s: data: {...}\\n\\n",
            "retry: 5000",
            "Heartbeat every 15s: : heartbeat",
            "(keeps CF tunnel idle-alive)",
        ],
        fill=GREEN_FILL, border=GREEN_BORDER, title_color=GREEN,
    )

    # Files routes
    card(
        d, 640, 1315, 620, 230, "Files  routes/file.js",
        [
            "BASE_DIR = /home/rudra-unix  (sandbox)",
            "path.resolve + startsWith guard",
            "GET  /  list · /download · /view · /drives",
            "GET  /search  (fd/fzf-style spawn)",
            "POST /upload (multer) · /copy · /folder · /file",
            "PATCH /rename · /move  (EXDEV → cp+rm)",
            "DELETE /delete",
            "mime-types for content-type",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )

    # Docker routes
    card(
        d, 1280, 1315, 1060, 230, "Docker  routes/docker.js  (dockerode → Docker Engine API)",
        [
            "Containers: GET /containers  |  POST start/stop/restart  |  DELETE delete  |  POST create",
            "Telemetry:  GET /:id/stats (SSE stream)  ·  GET /:id/inspect  ·  GET /:id/logs (SSE)  ·  /logs/download",
            "Images:     GET /images  ·  GET /images/pull?image= (SSE layers)  ·  DELETE /images/:id  ·  POST /images/prune",
            "Expose:     POST /:id/expose {subdomain}  ·  POST /:id/unexpose {subdomain}",
            "  → inspect host port → addIngressRule → reloadCloudflared → return https://sub.home-cloud.live",
            "Stop path:  removeIngressByPort(hostPort) then reload  ·  304 no-ops → 409 Conflict",
            "List enriches each container with exposedRule from config.yml",
        ],
        fill=TEAL_DIM, border=TEAL_BORDER, title_color=TEAL,
    )

    # Terminal socket detail
    card(
        d, 80, 1565, 720, 200, "Host Terminal  sockets/terminal.js",
        [
            "node-pty.spawn(bash, [], {",
            "  name: xterm-256color, cols:100,",
            "  cwd: HOME, env: process.env })",
            "ws message → pty.write  ·  pty data → ws.send",
            "ws close → pty.kill()",
            "Real PTY so vim/htop/fzf isatty() works",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE, body_font=F["mono_sm"],
    )

    # Container exec
    card(
        d, 820, 1565, 760, 200, "Container Console  sockets/containerExec.js",
        [
            "Docker({ socketPath: /var/run/docker.sock })",
            "container.exec({ Tty:true, AttachStdin/out/err,",
            "  Env:[TERM=xterm-256color],",
            "  Cmd: bash-if-exists else /bin/sh })",
            "exec.start({ hijack:true, stdin:true, Tty:true })",
            "Bidirectional stream  <->  WebSocket",
        ],
        fill=TEAL_DIM, border=TEAL_BORDER, title_color=TEAL, body_font=F["mono_sm"],
    )

    # Ingress service
    card(
        d, 1600, 1565, 740, 200, "Ingress Service  services/ingress.js",
        [
            "js-yaml load/dump ~/.cloudflared/config.yml",
            "addIngressRule(sub, port) before catch-all",
            "removeIngressRule(sub) / removeIngressByPort",
            "getIngressRules() → hostname, port, url",
            "CF_DOMAIN | CLOUDFLARE_BASE_DOMAIN",
            "  default: home-cloud.live",
            "reloadCloudflared() → restartTunnel()",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER, body_font=F["mono_sm"],
    )

    # Static + env
    card(
        d, 80, 1785, 720, 180, "Static SPA Serving",
        [
            "express.static('../dashboard/dist')",
            "SPA catch-all returns index.html",
            "React Router handles client routes",
            "Production: agent serves built dashboard",
            "Dev: concurrently agent + vite",
        ],
        fill=BLUE_FILL, border=BLUE_BORDER, title_color=BLUE,
    )
    card(
        d, 820, 1785, 760, 180, "Environment  agent/.env",
        [
            "PASSWORD          — shared login passcode",
            "JWT_SECRET        — signs/verifies tokens",
            "CF_DOMAIN / CLOUDFLARE_BASE_DOMAIN",
            "HOME              — cloudflared config path",
            "Port hardcoded: 3000",
        ],
        fill="#2a1520", border=RED, title_color=RED,
    )
    card(
        d, 1600, 1785, 740, 180, "Native deps (why CommonJS)",
        [
            "node-pty  — C++ .node binding (PTY)",
            "dockerode — Docker Remote API client",
            "systeminformation — host metrics",
            "multer · mime-types · cookie-parser",
            "jsonwebtoken · dotenv · js-yaml · ws",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE,
    )

    # ── 3c Host OS interfaces ──────────────────────────────────────────────
    zone(
        d, 2420, 1030, 1120, 540,
        "3c. Host OS Interfaces",
        fill=ZONE_FILL_2, border=GREEN_BORDER, title_color=GREEN,
    )
    card(
        d, 2440, 1095, 1080, 100, "/var/run/docker.sock",
        [
            "Unix domain socket → Docker Engine REST API",
            "Agent must be in docker group  ·  dockerode default socket",
        ],
        fill=GREEN_FILL, border=GREEN_BORDER, title_color=GREEN,
    )
    card(
        d, 2440, 1215, 520, 140, "Filesystem",
        [
            "BASE_DIR = /home/rudra-unix",
            "multer disk uploads",
            "fs rename / cp / rm",
            "EXDEV cross-mount fallback",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )
    card(
        d, 2980, 1215, 540, 140, "PTY / Shell",
        [
            "node-pty → real pseudo-TTY",
            "host bash (not win32)",
            "isatty() true for CLI tools",
            "cwd = $HOME",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE,
    )
    card(
        d, 2440, 1375, 520, 140, "systeminformation",
        [
            "CPU load · memory · disk",
            "Read every 2s for SSE",
            "No WebSocket needed",
            "(server → client only)",
        ],
        fill=GREEN_FILL, border=GREEN_BORDER, title_color=GREEN,
    )
    card(
        d, 2980, 1375, 540, 140, "cloudflared config FS",
        [
            "~/.cloudflared/config.yml",
            "credentials JSON",
            "Agent read/write YAML",
            "Process restart on change",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )

    # ── 3d Docker Engine ───────────────────────────────────────────────────
    zone(
        d, 2420, 1590, 1120, 540,
        "3d. Docker Engine",
        fill=ZONE_FILL_2, border=TEAL_BORDER, title_color=TEAL, badge="App Runtime",
    )
    card(
        d, 2440, 1655, 1080, 90, "Uniform lifecycle API (why Docker, not apt)",
        [
            "start/stop/restart/rm · stats · logs · exec · pull/prune · PortBindings · isolation · rollback via tags",
        ],
        fill=TEAL_DIM, border=TEAL_BORDER, title_color=TEAL,
    )
    # example containers
    for i, (name, port) in enumerate([
        ("jellyfin", ":8096"),
        ("sonarr", ":8989"),
        ("pihole", ":8080"),
        ("any app...", ":hostPort"),
    ]):
        x = 2440 + i * 270
        card(
            d, x, 1765, 250, 110, name,
            [f"host {port}", "→ container port", "isolated FS"],
            fill=CARD, border=TEAL_BORDER, title_color=TEAL, body_font=F["small"],
        )
    card(
        d, 2440, 1900, 1080, 100, "Images / Volumes / Networks",
        [
            "Images managed via Docker Manager Images tab (pull SSE, prune, delete, run modal)",
            "Volumes & compose stacks: planned V2 (docker compose CLI spawn — not dockerode)",
        ],
        fill=CARD, border=TEAL_BORDER, title_color=TEAL,
    )

    # Connect agent → host interfaces / docker
    arrow(d, 2360, 1300, 2420, 1300, color=GREEN, width=2, label="syscalls")
    arrow(d, 2360, 1450, 2420, 1700, color=TEAL, width=2, label="dockerode")
    arrow(d, 1970, 1680, 2420, 1750, color=TEAL, width=2)
    arrow(d, 1100, 810, 1100, 1030, color=AMBER, width=2)  # cloudflared under agent management
    # Agent to cloudflared
    arrow(d, 1900, 1030, 1900, 1010, color=AMBER, width=2)

    # ════════════════════════════════════════════════════════════════════════
    # LAYER 4 — DATA FLOWS (bottom strip)
    # ════════════════════════════════════════════════════════════════════════
    zone(d, 40, 2650, 3520, 320, "4. CRITICAL DATA FLOWS", fill="#12161f", border=CYAN, title_color=CYAN)

    # Flow 1 Terminal
    card(
        d, 60, 2715, 680, 230, "A. Host Terminal (WebSocket)",
        [
            "key → xterm.js → WS binary/text",
            "→ agent pty.write → bash",
            "→ PTY data → WS → xterm render",
            "Protocol: bidirectional WS on :3000",
        ],
        fill=PURPLE_FILL, border=PURPLE_BORDER, title_color=PURPLE,
    )
    # Flow 2 Metrics
    card(
        d, 760, 2715, 680, 230, "B. Metrics (SSE)",
        [
            "si.currentLoad/mem/fsSize every 2s",
            "→ data: JSON\\n\\n  EventSource",
            "→ React state → MeterBar/Sparkline",
            ": heartbeat every 15s (CF idle)",
        ],
        fill=GREEN_FILL, border=GREEN_BORDER, title_color=GREEN,
    )
    # Flow 3 Docker logs/stats
    card(
        d, 1460, 2715, 720, 230, "C. Container Logs / Stats / Pull (SSE)",
        [
            "container.logs({follow,tail,timestamps})",
            "container.stats({stream:true})",
            "docker.pull() layer progress events",
            "Demux TTY headers when Tty=false",
        ],
        fill=TEAL_DIM, border=TEAL_BORDER, title_color=TEAL,
    )
    # Flow 4 Expose
    card(
        d, 2200, 2715, 720, 230, "D. Expose Container (public URL)",
        [
            "1. POST /containers/:id/expose {sub}",
            "2. inspect → first mapped HostPort",
            "3. addIngressRule(sub, port) YAML",
            "4. reloadCloudflared / restart tunnel",
            "5. return https://sub.home-cloud.live",
        ],
        fill=ORANGE_FILL, border=ORANGE_BORDER, title_color=ORANGE,
    )
    # Flow 5 Files
    card(
        d, 2940, 2715, 600, 230, "E. File Ops (REST)",
        [
            "resolvePath + BASE_DIR guard",
            "multer upload · stream download",
            "rename / move (EXDEV fallback)",
            "search via child_process spawn",
        ],
        fill=AMBER_FILL, border=AMBER_BORDER, title_color=AMBER,
    )

    # Footer legend
    text(
        d,
        (W // 2, 2975),
        "Built artifacts: agent serves dashboard/dist  ·  pnpm dev = concurrently agent+dashboard  ·  Stacks / App Store / noVNC / LAN split-horizon / multi-user = roadmap (not in diagram as running code)",
        F["tiny"],
        fill=TEXT_MUTED,
        anchor="mm",
    )

    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT}  ({OUT.stat().st_size} bytes)  {W}x{H}")


if __name__ == "__main__":
    main()
