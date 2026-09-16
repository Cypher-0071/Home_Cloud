#!/usr/bin/env bash
# ==============================================================================
# Home Cloud — Standalone Host & Systemd Service Setup Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/home-cloud.service.template"
TARGET_SERVICE="/etc/systemd/system/home-cloud.service"

echo "========================================================"
echo "  Home Cloud — Production Daemon & Systemd Installer    "
echo "========================================================"

# 1. Host Context & Architecture Detection
CURRENT_USER="$(id -un)"
CURRENT_GROUP="$(id -gn)"
ARCH="$(uname -m)"

case "$ARCH" in
    x86_64)        CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    armv7l)        CF_ARCH="arm" ;;
    *)             CF_ARCH="amd64" ;;
esac

echo "✔ Detected User:      $CURRENT_USER ($CURRENT_GROUP)"
echo "✔ Detected Arch:      $ARCH (CF: $CF_ARCH)"
echo "✔ Working Directory:  $SCRIPT_DIR"

# 2. Node.js Runtime Check & Auto-Installation
install_nodejs() {
    echo "⬇ Installing Node.js 24 LTS & build essentials..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq || true
        sudo apt-get install -y -qq curl ca-certificates gnupg build-essential python3
        curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
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
    # Check major version >= 20
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

# Ensure build essentials exist for node-pty native bindings if on Debian/Ubuntu
if command -v apt-get >/dev/null 2>&1; then
    if ! command -v make >/dev/null 2>&1 || ! command -v gcc >/dev/null 2>&1; then
        echo "📦 Installing native build tools for node-pty (build-essential, python3)..."
        sudo apt-get install -y -qq build-essential python3 >/dev/null 2>&1 || true
    fi
fi

# 3. Docker Engine Check & Auto-Installation
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
        curl -fsSL https://get.docker.com | sudo sh
        sudo systemctl enable --now docker
        echo "✔ Docker Engine installed and service started."
    else
        echo "❌ Docker is mandatory for Home Cloud container operations. Aborting setup." >&2
        exit 1
    fi
else
    echo "✔ Detected Docker:    $(command -v docker)"
    # Ensure Docker daemon is running
    if ! sudo systemctl is-active --quiet docker; then
        echo "🔄 Starting docker.service..."
        sudo systemctl enable --now docker
    fi
fi

# Ensure user is in the docker group
if ! id -nG "$CURRENT_USER" | grep -qw "docker"; then
    echo "⚠ Adding '$CURRENT_USER' to 'docker' group for socket permissions..."
    sudo usermod -aG docker "$CURRENT_USER"
    echo "✔ Added $CURRENT_USER to docker group."
    echo "  (Note: Systemd service gets access immediately via SupplementaryGroups=docker)"
fi

# 4. Check & Prompt for Cloudflared (Optional Remote Tunnel)
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
            sudo dpkg -i "$TEMP_DEB" || sudo apt-get install -f -y
            rm -f "$TEMP_DEB"
            echo "✔ cloudflared installed successfully: $(command -v cloudflared)"
        else
            echo "⚠ Could not auto-download deb package. Skipping cloudflared (LAN access will still work)."
        fi
    else
        echo "ℹ Skipping cloudflared installation. Direct local LAN access (:3000) will still function."
    fi
else
    echo "✔ Detected Cloudflare: $(command -v cloudflared)"
fi

# 5. Check & Install pnpm
if ! command -v pnpm >/dev/null 2>&1; then
    echo "⚠ pnpm not found in PATH. Installing pnpm..."
    if command -v corepack >/dev/null 2>&1; then
        sudo corepack enable || true
    fi
    if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        sudo npm install -g pnpm || true
    fi
fi

# 6. Environment & Secure Admin Password Configuration
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
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$RANDOM_JWT|" "$SCRIPT_DIR/agent/.env"
    echo "✔ Generated secure random JWT_SECRET."
fi

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
        # Interactive shell prompt with hidden input
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
        # Non-interactive / headless fallback
        if [ -n "${HOME_CLOUD_PASSWORD:-}" ]; then
            ADMIN_PASS="$HOME_CLOUD_PASSWORD"
            echo "✔ Using admin password provided via HOME_CLOUD_PASSWORD environment variable."
        else
            ADMIN_PASS="$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 12 2>/dev/null || openssl rand -hex 6)"
            echo "⚠ Non-interactive setup: generated temporary admin password: $ADMIN_PASS"
        fi
    fi

    # Escape special characters for sed
    ESCAPED_PASS="$(printf '%s\n' "$ADMIN_PASS" | sed -e 's/[\/&]/\\&/g')"
    sed -i "s|^PASSWORD=.*|PASSWORD=$ESCAPED_PASS|" "$SCRIPT_DIR/agent/.env"
    echo "✔ Admin password saved to agent/.env"
else
    echo "✔ Admin password is already configured in agent/.env"
fi

# 7. Install Monorepo Dependencies & Build Production Dashboard Assets
echo ""
echo "📦 Verifying dependencies & building dashboard..."
if command -v pnpm >/dev/null 2>&1; then
    (cd "$SCRIPT_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
    (cd "$SCRIPT_DIR" && pnpm --filter dashboard build)
    echo "✔ Dashboard bundle built successfully in dashboard/dist/"
else
    echo "⚠ Notice: pnpm was not found. If dashboard/dist already exists, the agent will serve it."
fi

# 8. Render & Inject Systemd Service File
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

# 9. Register and Start Service with systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "🚀 Enabling and starting home-cloud.service..."
sudo systemctl enable --now home-cloud.service

echo ""
echo "========================================================"
echo "  🎉 Home Cloud successfully installed & running!     "
echo "========================================================"
echo ""
# Display local IP addresses for immediate access
LOCAL_IPS="$(hostname -I 2>/dev/null || ip addr show | grep -o 'inet [0-9.]*' | cut -d' ' -f2 | grep -v '127.0.0.1' || true)"
FIRST_IP="$(echo "$LOCAL_IPS" | awk '{print $1}')"

if [ -n "$FIRST_IP" ]; then
    echo "  Access locally at:  http://$FIRST_IP:3000"
else
    echo "  Access locally at:  http://localhost:3000"
fi
echo ""
echo "Service management commands:"
echo "  Check status:       sudo systemctl status home-cloud"
echo "  Stream live logs:   sudo journalctl -u home-cloud -f -o cat"
echo "  Restart service:    sudo systemctl restart home-cloud"
echo "  Stop service:       sudo systemctl stop home-cloud"
echo "========================================================"
