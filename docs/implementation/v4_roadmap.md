# Home Cloud — V4 Distribution Roadmap

This document outlines the distribution and installation tooling planned for **V4** of Home Cloud to make setup effortless on any spare PC or Linux machine.

---

## 🎯 One-Line Shell Installer & Distribution System 🚀

The goal of V4 is a single, bulletproof terminal command that installs, configures, and daemonizes the entire Home Cloud stack with zero manual friction:

```bash
curl -fsSL https://get.homecloud.live | sh
```

### Key Milestones:

* [ ] **System & Architecture Detection:**
  * Detect target Linux distribution (Ubuntu, Debian, Fedora, Arch, Alpine).
  * Detect CPU architecture (`x86_64`, `arm64`, `aarch64` for Raspberry Pi / single-board computers).
* [ ] **Automated Dependency Provisioning:**
  * Check and install **Docker Engine** and `docker-compose-plugin` if missing.
  * Check and install **Node.js** runtime (LTS) if missing.
  * Check and install **cloudflared** (Cloudflare Tunnel client) binary.
* [ ] **Systemd Service Daemon Setup:**
  * Generate and register `/etc/systemd/system/home-cloud.service`.
  * Enable auto-start on system boot (`systemctl enable home-cloud`).
  * Ensure process supervisor auto-recovery (`Restart=always`, `RestartSec=5`).
* [ ] **First-Boot Onboarding Wizard:**
  * On initial startup, guide the user via a clean setup terminal prompt or local web page at `http://<server-ip>:3000`.
  * Configure server admin passcode, storage directories, and optional Cloudflare Tunnel credentials.
