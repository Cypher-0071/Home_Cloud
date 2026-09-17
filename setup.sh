#!/usr/bin/env bash
# ==============================================================================
# Home Cloud — Bare-Metal & Standalone Host Setup Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/home-cloud.service.template"
TARGET_SERVICE="/etc/systemd/system/home-cloud.service"

echo "========================================================"
echo "  Home Cloud — Production Host & Systemd Installer      "
echo "========================================================"

# 0. Wait for apt / dpkg locks on fresh boot (e.g. unattended-upgrades)
wait_for_apt_lock() {
    local timeout=300
    local elapsed=0
    while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || \
          sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || \
          sudo fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
        if [ "$elapsed" -eq 0 ]; then
            echo "⏳ System package manager is busy (unattended-upgrades / apt-daily). Waiting for locks to release..."
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        if [ "$elapsed" -ge "$timeout" ]; then
            echo "❌ Timed out waiting for system package manager lock." >&2
            exit 1
        fi
    done
}

# 1. Resolve Execution Context & Actual User (handles sudo ./setup.sh cleanly)
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    CURRENT_USER="$SUDO_USER"
    CURRENT_GROUP="$(id -gn "$SUDO_USER")"
    CURRENT_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
    CURRENT_USER="$(id -un)"
    CURRENT_GROUP="$(id -gn)"
    CURRENT_HOME="${HOME:-/home/$CURRENT_USER}"
fi

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)        CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    armv7l)        CF_ARCH="arm" ;;
    *)             CF_ARCH="amd64" ;;
esac

echo "✔ Resolved User:      $CURRENT_USER ($CURRENT_GROUP)"
echo "✔ User Home:          $CURRENT_HOME"
echo "✔ Detected Arch:      $ARCH (CF: $CF_ARCH)"
echo "✔ Working Directory:  $SCRIPT_DIR"

# 2. Install essential system tools for bare-bones Ubuntu Server
if command -v apt-get >/dev/null 2>&1; then
    echo "📦 Checking and installing essential system packages..."
    wait_for_apt_lock
    sudo apt-get update -qq || true
    wait_for_apt_lock
    sudo apt-get install -y -qq \
        curl ca-certificates gnupg \
        build-essential python3 \
        fd-find fzf git >/dev/null 2>&1 || true
fi

# 3. Node.js Runtime Check & Auto-Installation
install_nodejs() {
    echo "⬇ Installing Node.js 24 LTS & build essentials..."
    if command -v apt-get >/dev/null 2>&1; then
        wait_for_apt_lock
        curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
        wait_for_apt_lock
        sudo apt-get install -y -qq nodejs build-essential python3
    elif command -v dnf >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
        sudo dnf install -y nodejs gcc-c++ make python3
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm nodejs npm base-devel python
    else
        echo "❌ Unsupported package manager. Please install Node.js 20+ manually." >&2
        exit 1
    fi
}

NODE_PATH="$(command -v node || true)"
NEED_NODE_INSTALL=false

if [ -z "$NODE_PATH" ]; then
    echo "⚠ Node.js is not installed on this system."
    NEED_NODE_INSTALL=true
else
    NODE_VERSION="$("$NODE_PATH" -v)"
    NODE_MAJOR="$(echo "$NODE_VERSION" | sed -E 's/^v([0-9]+).*/\1/')"
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "⚠ Detected Node.js $NODE_VERSION, but Home Cloud requires Node.js v20+ LTS."
        NEED_NODE_INSTALL=true
    fi
fi

if [ "$NEED_NODE_INSTALL" = true ]; then
    if [ -t 0 ]; then
        read -rp "Would you like setup.sh to install Node.js 24 LTS automatically via NodeSource? [Y/n] " PROMPT_NODE
        PROMPT_NODE="${PROMPT_NODE:-Y}"
    else
        PROMPT_NODE="Y"
    fi

    if [[ "$PROMPT_NODE" =~ ^[Yy]$ ]]; then
        install_nodejs
        NODE_PATH="$(command -v node)"
    else
        echo "❌ Node.js 20+ is required to run Home Cloud. Aborting setup." >&2
        exit 1
    fi
fi

NODE_DIR="$(dirname "$NODE_PATH")"
NODE_VERSION="$("$NODE_PATH" -v)"
echo "✔ Active Node.js:     $NODE_PATH ($NODE_VERSION)"

# 4. Mandatory pnpm Installation
if ! command -v pnpm >/dev/null 2>&1; then
    echo "📦 Installing pnpm..."
    if command -v corepack >/dev/null 2>&1; then
        sudo corepack enable || true
    fi
    if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        sudo npm install -g pnpm || true
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
        curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=latest SHELL="$(which bash)" bash - || true
        export PATH="$CURRENT_HOME/.local/share/pnpm:$PATH"
    fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "❌ Error: pnpm could not be installed. Please install pnpm (npm install -g pnpm) and re-run setup.sh." >&2
    exit 1
fi
echo "✔ Active pnpm:        $(command -v pnpm)"

# 5. Docker Engine & Compose Plugin Check / Auto-Installation
if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "⚠ Docker Engine is required to run containers, but was not found on this system."
    if [ -t 0 ]; then
        read -rp "Would you like setup.sh to install Docker Engine automatically via get.docker.com? [Y/n] " INSTALL_DOCKER
        INSTALL_DOCKER="${INSTALL_DOCKER:-Y}"
    else
        INSTALL_DOCKER="Y"
    fi

    if [[ "$INSTALL_DOCKER" =~ ^[Yy]$ ]]; then
        echo "⬇ Installing Docker Engine via official installer..."
        wait_for_apt_lock
        curl -fsSL https://get.docker.com | sudo sh
        sudo systemctl enable --now docker
        echo "✔ Docker Engine installed and service started."
    else
        echo "❌ Docker is mandatory for Home Cloud container operations. Aborting setup." >&2
        exit 1
    fi
else
    echo "✔ Detected Docker:    $(command -v docker)"
    if ! sudo systemctl is-active --quiet docker; then
        echo "🔄 Starting docker.service..."
        sudo systemctl enable --now docker
    fi
fi

# Ensure docker-compose-plugin is present
if ! docker compose version >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        echo "📦 Installing docker-compose-plugin..."
        wait_for_apt_lock
        sudo apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || true
    fi
fi

# Ensure user is in the docker group
if ! id -nG "$CURRENT_USER" | grep -qw "docker"; then
    echo "⚠ Adding '$CURRENT_USER' to 'docker' group for socket permissions..."
    sudo usermod -aG docker "$CURRENT_USER"
    echo "✔ Added $CURRENT_USER to docker group."
fi

# 6. Check & Prompt for Cloudflared (Optional Remote Tunnel)
if ! command -v cloudflared >/dev/null 2>&1; then
    echo ""
    echo "ℹ cloudflared is not installed. (Required for free remote HTTPS access via *.home-cloud.live)"
    if [ -t 0 ]; then
        read -rp "Would you like setup.sh to download and install cloudflared now? [Y/n] " INSTALL_CF
        INSTALL_CF="${INSTALL_CF:-Y}"
    else
        INSTALL_CF="N"
    fi

    if [[ "$INSTALL_CF" =~ ^[Yy]$ ]]; then
        echo "⬇ Downloading cloudflared for $CF_ARCH..."
        TEMP_DEB="/tmp/cloudflared-${CF_ARCH}.deb"
        if curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb" -o "$TEMP_DEB"; then
            wait_for_apt_lock
            sudo dpkg -i "$TEMP_DEB" || sudo apt-get install -f -y
            rm -f "$TEMP_DEB"
            echo "✔ cloudflared installed successfully: $(command -v cloudflared)"
        else
            echo "⚠ Could not auto-download deb package. Skipping cloudflared (LAN access will still function)."
        fi
    else
        echo "ℹ Skipping cloudflared installation. Direct local LAN access (:3000) will still function."
    fi
else
    echo "✔ Detected Cloudflare: $(command -v cloudflared)"
fi

# Create skeleton ~/.cloudflared directory if cloudflared is installed
if command -v cloudflared >/dev/null 2>&1; then
    CF_DIR="$CURRENT_HOME/.cloudflared"
    if [ ! -d "$CF_DIR" ]; then
        mkdir -p "$CF_DIR"
        chown -R "$CURRENT_USER:$CURRENT_GROUP" "$CF_DIR"
    fi
fi

# 7. Environment & Secure Admin Password Configuration (Using Node.js to prevent delimiter bugs)
echo ""
echo "⚙ Configuring environment & security credentials..."

if [ ! -f "$SCRIPT_DIR/agent/.env" ]; then
    if [ -f "$SCRIPT_DIR/agent/.env.example" ]; then
        cp "$SCRIPT_DIR/agent/.env.example" "$SCRIPT_DIR/agent/.env"
    else
        cat << 'EOF' > "$SCRIPT_DIR/agent/.env"
PASSWORD=change-me
JWT_SECRET=generate-a-long-random-string
PORT=3000
EOF
    fi
    # Generate cryptographically secure JWT secret
    RANDOM_JWT="$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32 2>/dev/null || openssl rand -hex 16)"
    "$NODE_PATH" -e '
        const fs = require("fs");
        const envPath = process.argv[1];
        const secret = process.argv[2];
        let content = fs.readFileSync(envPath, "utf8");
        content = content.replace(/^JWT_SECRET=.*/m, "JWT_SECRET=" + secret);
        fs.writeFileSync(envPath, content);
    ' "$SCRIPT_DIR/agent/.env" "$RANDOM_JWT"
    echo "✔ Generated secure random JWT_SECRET."
fi

# Secure file permissions on agent/.env
chmod 600 "$SCRIPT_DIR/agent/.env"

# Check if PASSWORD needs to be configured
CURRENT_PASS="$(grep -E "^PASSWORD=" "$SCRIPT_DIR/agent/.env" | cut -d'=' -f2- || true)"
if [ -z "$CURRENT_PASS" ] || [ "$CURRENT_PASS" = "change-me" ]; then
    echo ""
    echo "┌──────────────────────────────────────────────────────────┐"
    echo "│ 🔐 SET ADMIN DASHBOARD PASSWORD                          │"
    echo "│ Set the security password used to log into Home Cloud.   │"
    echo "└──────────────────────────────────────────────────────────┘"

    ADMIN_PASS=""
    if [ -t 0 ]; then
        while true; do
            read -rsp "Enter dashboard admin password: " ADMIN_PASS
            echo ""
            if [ -z "$ADMIN_PASS" ]; then
                echo "❌ Password cannot be empty. Please try again."
                continue
            fi
            read -rsp "Confirm dashboard admin password: " ADMIN_PASS_CONFIRM
            echo ""
            if [ "$ADMIN_PASS" != "$ADMIN_PASS_CONFIRM" ]; then
                echo "❌ Passwords do not match. Please try again."
            else
                break
            fi
        done
    else
        if [ -n "${HOME_CLOUD_PASSWORD:-}" ]; then
            ADMIN_PASS="$HOME_CLOUD_PASSWORD"
            echo "✔ Using admin password provided via HOME_CLOUD_PASSWORD environment variable."
        else
            ADMIN_PASS="$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 12 2>/dev/null || openssl rand -hex 6)"
            echo "⚠ Non-interactive setup: generated temporary admin password: $ADMIN_PASS"
        fi
    fi

    # Write password safely using Node.js (completely immune to sed delimiter or escape character bugs)
    "$NODE_PATH" -e '
        const fs = require("fs");
        const envPath = process.argv[1];
        const pass = process.argv[2];
        let content = fs.readFileSync(envPath, "utf8");
        if (/^PASSWORD=/m.test(content)) {
            content = content.replace(/^PASSWORD=.*/m, "PASSWORD=" + pass);
        } else {
            content += "\nPASSWORD=" + pass + "\n";
        }
        fs.writeFileSync(envPath, content, { mode: 0o600 });
    ' "$SCRIPT_DIR/agent/.env" "$ADMIN_PASS"

    echo "✔ Admin password saved securely to agent/.env"
else
    echo "✔ Admin password is already configured in agent/.env"
fi

# 8. Monorepo Dependencies & Production Dashboard Build
echo ""
echo "📦 Installing dependencies & building dashboard..."
(cd "$SCRIPT_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
(cd "$SCRIPT_DIR" && pnpm --filter dashboard build)
echo "✔ Dashboard bundle built successfully in dashboard/dist/"

# 9. Configure UFW Firewall for LAN port 3000 if UFW is active
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status | grep -qw "active"; then
        echo "🛡 UFW is active. Allowing incoming traffic on port 3000/tcp..."
        sudo ufw allow 3000/tcp comment "Home Cloud Dashboard" >/dev/null 2>&1 || true
    fi
fi

# 10. Render & Inject Systemd Service File
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Error: Template file $TEMPLATE_FILE not found!" >&2
    exit 1
fi

echo ""
echo "⚙ Compiling $TEMPLATE_FILE -> $TARGET_SERVICE..."
sed \
    -e "s|{{USER}}|$CURRENT_USER|g" \
    -e "s|{{GROUP}}|$CURRENT_GROUP|g" \
    -e "s|{{WORKING_DIR}}|$SCRIPT_DIR|g" \
    -e "s|{{NODE_PATH}}|$NODE_PATH|g" \
    -e "s|{{NODE_DIR}}|$NODE_DIR|g" \
    "$TEMPLATE_FILE" | sudo tee "$TARGET_SERVICE" > /dev/null

echo "✔ Successfully generated $TARGET_SERVICE"

# 11. Fix file permissions on the repository directory so non-root user owns build artifacts
sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$SCRIPT_DIR"

# 12. Register and Start Service with systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "🚀 Enabling and starting home-cloud.service..."
sudo systemctl enable --now home-cloud.service

echo ""
echo "========================================================"
echo "  🎉 Home Cloud successfully installed & running!     "
echo "========================================================"
echo ""

# Extract active outbound gateway interface IP (prevents picking docker0 172.17.0.1)
ACTIVE_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' || true)"
if [ -z "$ACTIVE_IP" ]; then
    ACTIVE_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")"
fi

echo "  Access locally at:  http://$ACTIVE_IP:3000"
echo ""
echo "Service management commands:"
echo "  Check status:       sudo systemctl status home-cloud"
echo "  Stream live logs:   sudo journalctl -u home-cloud -f -o cat"
echo "  Restart service:    sudo systemctl restart home-cloud"
echo "  Stop service:       sudo systemctl stop home-cloud"
echo "========================================================"
