#!/usr/bin/env bash
set -euo pipefail

# Bootstrap vm-001 (TUI server) with Dokku.
# Usage: ./deploy/bootstrap-tui-server.sh <ssh-host> [ssh-user] [agent-host]
#
# <ssh-host>    Hostname or IP of the TUI server (arn-prod-hypershell-vm-001)
# [ssh-user]    SSH user (default: root)
# [agent-host]  Hostname or IP of the agent server for MASTRA_API_BASE_URL
#               (default: prompts interactively)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOKKU_BOOTSTRAP="$SCRIPT_DIR/vendor/dokku-bootstrap.sh"

SSH_HOST="${1:?Usage: $0 <ssh-host> [ssh-user] [agent-host]}"
SSH_USER="${2:-root}"
AGENT_HOST="${3:-}"

if [[ -z "$AGENT_HOST" ]]; then
  read -rp "Agent server hostname/IP (for MASTRA_API_BASE_URL): " AGENT_HOST
fi

SSH="ssh -o StrictHostKeyChecking=accept-new ${SSH_USER}@${SSH_HOST}"

echo "==> Installing Dokku on ${SSH_HOST} (this may take a few minutes)..."
$SSH "sudo bash -s" < "$DOKKU_BOOTSTRAP"

echo ""
echo "==> Detecting SSH public key for Dokku deploy access..."
SSH_PUBKEY_FILE=""
for candidate in ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub ~/.ssh/id_ecdsa.pub; do
  if [[ -f "$candidate" ]]; then
    SSH_PUBKEY_FILE="$candidate"
    break
  fi
done

if [[ -z "$SSH_PUBKEY_FILE" ]]; then
  read -rp "Path to your SSH public key: " SSH_PUBKEY_FILE
fi
echo "    Using key: $SSH_PUBKEY_FILE"

echo ""
echo "==> Configuring Dokku on ${SSH_HOST}..."
$SSH "sudo bash -s" << SETUP
set -euo pipefail

# ---- Global config ----
dokku domains:set-global ${SSH_HOST}

# Disable vhost-based routing (IP-only, no nginx)
dokku config:set --global DOKKU_DISABLE_PROXY=1 2>/dev/null || true

# ---- Create tui app ----
if ! dokku apps:exists tui 2>/dev/null; then
  dokku apps:create tui
fi

# Use monorepo-root build context with apps/tui/Dockerfile
dokku builder-dockerfile:set tui dockerfile-path apps/tui/Dockerfile

# PTY device and port publishing (proxy:disable alone doesn't bind host ports)
# Clear first to avoid duplicates on re-runs, then re-add.
dokku docker-options:clear tui deploy,run 2>/dev/null || true
dokku docker-options:add tui deploy,run "--device /dev/ptmx:/dev/ptmx --publish 22:22 --publish 39217:39217"

# Persistent storage for SSH host key
dokku storage:ensure-directory tui
dokku storage:mount tui /var/lib/dokku/data/storage/tui:/data 2>/dev/null || true

# Disable nginx proxy (ports published directly via docker-options above)
dokku proxy:disable tui

# Zero-downtime checks can't work with host-published ports (port already allocated)
dokku checks:disable tui

# Environment variables
dokku config:set tui \
  SSH_LISTEN_HOST=0.0.0.0 \
  SSH_LISTEN_PORT=22 \
  SSH_STATUS_HOST=0.0.0.0 \
  SSH_STATUS_PORT=39217 \
  SSH_HOST_KEY_PATH=/data/tui-ssh-host-key.pem \
  MASTRA_API_BASE_URL=http://${AGENT_HOST}:4111 \
  MASTRA_AGENT_ID=content-chat-agent

echo "Dokku tui app configured."
SETUP

echo ""
echo "==> Adding SSH deploy key to Dokku..."
cat "$SSH_PUBKEY_FILE" | $SSH "sudo dokku ssh-keys:add deployer" || \
  echo "    (Key may already be added — continuing)"

echo ""
echo "==> Bootstrap complete for ${SSH_HOST}!"
echo ""
echo "    Next steps:"
echo "    1. Add git remote:  git remote add dokku-tui dokku@${SSH_HOST}:tui"
echo "    2. Deploy:          ./deploy/deploy-tui.sh ${SSH_HOST}"
