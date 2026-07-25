# Home Cloud — UI/UX Design Brief

> Living document. Update before touching code. Last updated: 2026-07-25.
> Shell implementation (Steps 1-4) is DONE. Steps 5+ are pending.

---

## 1. What This Is

A complete UI/UX overhaul of the Home Cloud browser dashboard — a React SPA that acts as the
control plane for a self-hosted Linux server accessed remotely through a Cloudflare tunnel.

**User:** One person (the owner). Developer-adjacent. Uses it from a laptop or desktop, mostly
at night, at home or at a desk. Every session is purposeful: check metrics, kill a container,
grab a file, run a shell command. Not casual browsing.

**Success:** The interface disappears into the task. Fast to reach what you need in under 5s.

---

## 2. Register

**Product** — design serves the task. Restraint is the default.

---

## 3. Design Philosophy

### Scene sentence
*"A developer at a 24-inch monitor, dim room, 11pm, pulling up their home server dashboard
to check why something is slow."*

Forces: dark mode only. High contrast for data. No decorative glows. Functional color only.

### Color strategy: Restrained
One accent. All other color is semantic (status: ok / warn / error).

### Anti-references
- Umbrel and CasaOS: consumer-soft card grids, macOS-imitating aesthetics
- Generic glassmorphism / blur-heavy SaaS dark dashboards
- Purple gradient AI-tool aesthetic (the original codebase had this; removed)
- macOS traffic-light window controls, dock magnification
- Any design you can predict from the category ("dark dashboard = blue")

### Reference anchors
- **Warp terminal** — dense, readable, functional dark UI with clear hierarchy
- **Grafana** — data-first, monospace numbers, clear status colors
- **Windows 11 Task Manager** — precise, compact, professional data layout

---

## 4. Design Tokens (The Foundation)

Everything must derive from these. No hardcoded hex or rgba anywhere in new CSS.

### Colors (OKLCH)

```css
/* Surfaces */
--bg-base:      oklch(9%  0.008 240);
--bg-surface:   oklch(13% 0.010 240);
--bg-raised:    oklch(16% 0.012 240);
--bg-overlay:   oklch(19% 0.013 240);

/* Accent — electric teal */
--accent:         oklch(72% 0.18 195);
--accent-dim:     oklch(72% 0.18 195 / 0.12);
--accent-border:  oklch(72% 0.18 195 / 0.30);
--accent-text:    oklch(72% 0.18 195);
--accent-hover:   oklch(76% 0.20 195);

/* Text */
--text-primary:   oklch(93% 0.006 240);
--text-secondary: oklch(63% 0.010 240);
--text-muted:     oklch(43% 0.009 240);
--text-on-accent: oklch(10% 0.008 240);

/* Borders */
--border-subtle:  oklch(20% 0.011 240);
--border-default: oklch(26% 0.012 240);
--border-strong:  oklch(33% 0.014 240);

/* Semantic status */
--ok:    oklch(68% 0.18 145);
--warn:  oklch(78% 0.16 70);
--error: oklch(62% 0.22 25);
--ok-dim:    oklch(68% 0.18 145 / 0.10);
--warn-dim:  oklch(78% 0.16 70  / 0.10);
--error-dim: oklch(62% 0.22 25  / 0.10);
```

### Typography
```css
--sans: 'Inter', system-ui, -apple-system, sans-serif;
--mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
```

Rule: All data values (bytes, %, timestamps, ports, IDs) use --mono. Chrome uses --sans.

### Spacing (4pt base)
4, 8, 12, 16, 20, 24, 32, 48px

### Elevation
```css
--shadow-sm:     0 1px 4px  oklch(0% 0 0 / 0.35);
--shadow-md:     0 4px 16px oklch(0% 0 0 / 0.50);
--shadow-lg:     0 12px 40px oklch(0% 0 0 / 0.65);
--shadow-window: 0 20px 60px oklch(0% 0 0 / 0.70);
```

### Motion
```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);
--duration-fast: 120ms;  --duration-base: 200ms;  --duration-slow: 300ms;
```

No bounce. No elastic. Ease out only.

---

## 5. Shell Structure [IMPLEMENTED]

### Layout

```
+---------------------------------------------------------+
|                                                         |
|          DESKTOP WORKSPACE  (flex-grow: 1)              |
|                                                         |
|   [Window]   [Window]   ...                             |
|                                                         |
+---------------------------------------------------------+
|  (empty)  [ icon ][ icon ][ icon ][ icon ]  [• Tun 22:30 sign-out] |
|              TASKBAR  (48px, full-width)                |
+---------------------------------------------------------+
```

No top bar. Floating windows retained with Windows-style chrome.
Taskbar grid: `1fr auto 1fr` — left empty, center icons, right system tray.

### Desktop workspace
- Background: wallpaper + --bg-base fallback
- No animated glow spots (removed)

---

## 6. Surface: Taskbar [IMPLEMENTED]

Full-width, 48px, anchored to bottom edge.
- Background: --bg-surface
- Border-top: 1px solid var(--border-subtle)
- No border-radius, no float

**Center (dock items):**
- 40x40px button elements, 8px border-radius
- Icon: 14px Lucide icon, --text-secondary
- Hover: --bg-raised bg, --text-primary, translateY(-6px), 120ms ease-out-quart
- Active (open + focused): --accent-dim bg, --accent-text icon
- Open indicator dot: 4x4px, --text-muted (open), --accent (active), below icon

**Tooltip:** appears above on hover, --bg-overlay, --border-subtle, --text-xs, 400ms delay

**Right (system tray):**
- Tunnel pill: dot (--ok / --error) + "Tunnel" label, --mono, --text-xs, --bg-raised
- Clock: HH:MM  Weekday Mon DD format, --mono, --text-muted
- Sign-out: 30x30px icon button, --text-muted idle, --error-dim + --error on hover

---

## 7. Surface: Window Chrome [IMPLEMENTED]

```
+--------------------------------------------------------+
| [icon] Window Title              [ - ]  [ [] ]  [ x ] |
+--------------------------------------------------------+
|  window content                                        |
+--------------------------------------------------------+
```

**Title bar:** 36px, --bg-raised, 1px --border-subtle bottom
**Controls (right side):**
- Minimize: 46x36px, transparent -> --bg-overlay hover, thin-stroke SVG
- Maximize/Restore: 46x36px, same
- Close: 46x36px, --error fill on hover, icon turns near-white

**Window body:** --bg-surface
**Border:** --border-subtle idle, --border-default when active
**Shadow:** --shadow-md idle, --shadow-window when active
**Minimized:** scale(0.85) translateY(20px) + opacity 0, 200ms ease-out-expo
**Resize handle:** 12x12px bottom-right, invisible hit area

---

## 8. Surface: Login Page [PENDING]

Split-screen (brand panel left, form right). Mobile: brand hidden, form fills screen.

**Brand panel:**
- --bg-surface, right 1px --border-subtle
- Subtle CSS grid texture background
- "Home Cloud" heading: 24px, weight 700, -1px letter-spacing
- Static system status rows below tagline

**Form panel:** --bg-base, max-width 360px centered
**Input:** --bg-raised, 1px --border-default, focus: --accent border only
**Submit button:** --accent bg, --text-on-accent, full-width, loading spinner state
**Error:** inline below input, --error color + AlertCircle icon, slide-in animation

---

## 9. Surface: System Monitor [PENDING]

Replace circular gauges with horizontal meter bars.

**Meter bar:** 6px height, pill radius, fill: --accent (default), --warn (>75%), --error (>90%)
**Sparkline:** SVG, last 60 data points, --accent stroke 1.5px, no fill, no axes
**Section headers:** --text-xs, --text-muted, uppercase, letter-spacing 0.06em
**Disk table:** --mono for all data values, row separator 1px --border-subtle

---

## 10. Surface: Docker Manager [PENDING]

Tab bar: Containers / Images
Stats row: 3 chips (running / stopped / images)
Table: Name / Image / Status / Ports / CPU% / RAM / Created / Actions
Status dot: 6x6px static — running(--ok), exited(--text-muted), paused(--warn), dead(--error)
Running row: --ok-dim background tint (not a border stripe)
Action buttons: always visible, icon-only, 28x28px

---

## 11. Surface: File Explorer [PENDING]

Two-panel: sidebar (160px, --bg-surface) + main (file list)
Toolbar: 40px, --bg-raised, breadcrumb (--mono) left, actions right
File rows: 34px, hover --bg-raised, selected --accent-dim + 2px --accent-border left
Icons by type: folders(--accent), images(amber), code(--text-secondary), video(purple), other(--text-muted)

---

## 12. Component Vocabulary

### Buttons
| Variant | Background | Text | Use |
|---|---|---|---|
| Primary | --accent | --text-on-accent | Main CTA |
| Ghost | transparent, --border-default | --text-secondary | Secondary |
| Ghost-danger | transparent -> --error-dim hover | -> --error hover | Destructive |
| Icon | --bg-raised, --border-subtle | --text-secondary | Icon-only |

All: 6px border-radius. No gradient fills. No glow shadows.

### Status dots
6x6px circle. Static (no pulse animation during normal operation).
Running/OK -> --ok | Warning -> --warn | Stopped (non-error) -> --text-muted | Error -> --error

### Tooltips
--bg-overlay, 1px --border-subtle, --shadow-sm, --text-xs, 4px radius, 400ms delay

---

## 13. Absolute Bans

- Side-stripe borders >1px as decorative accents
- Gradient text (background-clip: text with gradient)
- Glassmorphism (backdrop-filter: blur) on window bodies or shell
- Animated floating glow spots
- Status dot pulse during normal operation
- Hover identical to active state
- Hardcoded hex or rgba in new CSS (tokens only)

---

## 14. Implementation Sequence

```
Step 1 — index.css              [DONE] OKLCH tokens, backward-compat aliases
Step 2 — App.css                [DONE] Taskbar, window chrome, dock items CSS
Step 3 — OSWindow.tsx           [DONE] Right-side controls, icon prop, maximized fix
Step 4 — desktop.tsx            [DONE] Remove top bar + glows, wire taskbar JSX

Step 5 — login.tsx + login.module.css     [PENDING]
Step 6 — SystemMonitorApp.tsx             [PENDING] MeterBar + SparklineChart components
Step 7 — docker.module.css                [PENDING] Token cleanup, row tint, status dots
Step 8 — files.module.css                 [PENDING] Token cleanup, breadcrumb, icon colors
Step 9 — Polish pass                      [PENDING] Transitions, hover states, scrollbars
```

---

## 15. Open Decisions

| # | Question | Default |
|---|---|---|
| 1 | Sparkline range: rolling 60s or user-selectable? | Rolling 60 points (60s) |
| 2 | File explorer: list view only or grid toggle? | List view only |
| 3 | Docker actions: always visible or hover-revealed? | Always visible |
| 4 | Login status rows: static or live-polled? | Static |
