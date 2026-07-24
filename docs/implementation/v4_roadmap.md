# Home Cloud — V4 Production Distribution & SaaS Architecture Roadmap

This document outlines the architectural milestones for transforming Home Cloud into an open-source, consumer-ready operating system with zero-configuration global remote access served via a centralized domain infrastructure (`*.homecloud.app`).

---

## 🎯 V4 Milestones & Checkpoints

### Phase 1: Centralized Wildcard Subdomain Proxy Infrastructure (`*.homecloud.app`) 🌐

This feature allows every open-source user to get instant, free HTTPS remote access to their self-hosted containers without buying a domain or configuring DNS.

* [ ] **Wildcard Cloudflare Zone Provisioning:** Configure central zone management for `homecloud.app` with a wildcard CNAME record (`*.homecloud.app`) pointing to the central tunnel routing pool.
* [ ] **Subdomain Namespace Schema:** Enforce isolation naming conventions for user endpoints (`https://<username>-<appname>.homecloud.app`, e.g., `https://rudra-jellyfin.homecloud.app`).
* [ ] **Zero-Config Remote Access for Users:** Non-technical users get encrypted, public HTTPS URLs out of the box with zero manual DNS setup or credit card requirements.

---

### Phase 2: Central Auth & Tunnel Token Provisioning Service (`api.homecloud.app`) 🔐

This backend service manages user identity, provisions unique tunnel credentials, and binds user home servers to their allocated subdomains.

* [ ] **Account Registration & Token Issuer:** Build a lightweight central API (`api.homecloud.app`) where users register their Home Cloud account and receive a unique, cryptographically signed **Home Server License & Tunnel Token**.
* [ ] **Dynamic Subdomain Allocator:** When a user launches a container on their Spare PC, the agent calls `api.homecloud.app/v1/subdomains/register` to verify availability and dynamically route `<username>-<appname>.homecloud.app` to their active tunnel.
* [ ] **Automated Credential Sync:** The local agent securely receives and stores `tunnel-credentials.json` on disk to keep the tunnel daemon authenticated automatically.

---

### Phase 3: Open-Source One-Line Installer & Distribution System 🚀

This phase provides an effortless, one-command installation flow for Linux servers and single-board computers (Raspberry Pi, x86_64 Spare PCs).

* [ ] **One-Line Shell Installer (`curl -fsSL https://get.homecloud.app | sh`):** Build an idempotent bash installation script that detects OS architecture (Ubuntu/Debian/Arch/Alpine, x86_64/ARM64), installs Docker, Node.js runtime, and `cloudflared`.
* [ ] **Systemd Service Daemon Setup:** Automatically configure `home-cloud-agent.service` to start on system boot with auto-restart resilience (`Restart=always`).
* [ ] **First-Time Setup Web Wizard:** On initial boot, present a sleek onboarding wizard at `http://<local-ip>:3000` to guide the user through account creation, passphrase setting, and initial app selection.

---

### Phase 4: Production Security, Origin Isolation & Abuse Guards 🛡️

This phase protects the central domain infrastructure and ensures user data isolation.

* [ ] **Subdomain Cookie & Origin Isolation:** Ensure each app runs on a distinct subdomain (`user-app1.homecloud.app` vs `user-app2.homecloud.app`) to guarantee browser-level localStorage and cookie security boundaries.
* [ ] **Subdomain Reservation Guard:** Protect system-reserved subdomains (`api`, `get`, `auth`, `admin`, `dash`, `www`) from being registered by end users.
* [ ] **Abuse & Rate-Limiting Engine:** Implement rate-limiting and automated abuse reporting on `api.homecloud.app` to detect and block malicious traffic or illegal hosting attempts.

---

## 📊 Product Vision & Architecture Summary

```
                                  [ Central Cloud Infrastructure ]
                                      Domain: homecloud.app
                                 Wildcard DNS: *.homecloud.app
                                              │
                                              ▼
                                 [ Central Auth & Routing API ]
                                     (api.homecloud.app)
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        [ User A's Home Server ]                          [ User B's Home Server ]
         (Spare PC / Raspberry Pi)                        (Spare PC / Raspberry Pi)
          Username: "rudra"                                Username: "alex"
        ┌─────────────────────────┐                      ┌─────────────────────────┐
        │  jellyfin container     │                      │  nextcloud container    │
        │  ➜ rudra-jellyfin.      │                      │  ➜ alex-nextcloud.      │
        │     homecloud.app       │                      │     homecloud.app       │
        └─────────────────────────┘                      └─────────────────────────┘
```
