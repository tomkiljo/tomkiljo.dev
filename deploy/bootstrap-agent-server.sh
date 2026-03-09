#!/usr/bin/env bash
set -euo pipefail

# Bootstrap vm-002 (Agent server) with Dokku.
# Usage: ./deploy/bootstrap-agent-server.sh <ssh-host> [ssh-user]
#
# <ssh-host>  Hostname or IP of the agent server (arn-prod-hypershell-vm-002)
# [ssh-user]  SSH user (default: root)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOKKU_BOOTSTRAP="$SCRIPT_DIR/vendor/dokku-bootstrap.sh"

SSH_HOST="${1:?Usage: $0 <ssh-host> [ssh-user]}"
SSH_USER="${2:-root}"

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
dokku config:set --global DOKKU_DISABLE_PROXY=1 2>/dev/null || true

# ---- Create apps ----
for app in ollama agent; do
  if ! dokku apps:exists \$app 2>/dev/null; then
    dokku apps:create \$app
  fi
done

# ---- Shared internal network ----
if ! dokku network:exists agent-net 2>/dev/null; then
  dokku network:create agent-net
fi

for app in ollama agent; do
  dokku network:set \$app attach-post-create agent-net
done

# Set explicit hostnames so Docker's embedded DNS resolves them by name within agent-net.
# Clear first to avoid duplicates on re-runs, then re-add.
dokku docker-options:clear ollama deploy,run 2>/dev/null || true
dokku docker-options:add ollama deploy,run "--hostname ollama"

# ---- Ollama app config ----
# Persistent storage for downloaded models (~/.ollama in container = /root/.ollama)
dokku storage:ensure-directory ollama
dokku storage:mount ollama /var/lib/dokku/data/storage/ollama:/root/.ollama 2>/dev/null || true

# No public port for ollama (internal only via agent-net)
dokku proxy:disable ollama

# Dockerfile path
dokku builder-dockerfile:set ollama dockerfile-path deploy/dockerfiles/Dockerfile.ollama

# Models to pull on startup
dokku config:set ollama \
  PULL_MODELS="qwen2.5:3b nomic-embed-text bona/bge-reranker-v2-m3"

# Zero-downtime checks can't work with host-published ports
dokku checks:disable ollama

# ---- Agent app config ----
# Persistent storage for mastra DB
dokku storage:ensure-directory agent
dokku storage:mount agent /var/lib/dokku/data/storage/agent:/data 2>/dev/null || true

# Disable nginx proxy, publish port directly via docker-options
dokku proxy:disable agent
dokku docker-options:clear agent deploy,run 2>/dev/null || true
dokku docker-options:add agent deploy,run "--publish 4111:4111"
# Set hostname on deploy containers so postdeploy tasks can reach them via agent-net DNS
dokku docker-options:add agent deploy "--hostname agent"

# app.json lives inside apps/agent/ in the monorepo
dokku app-json:set agent appjson-path apps/agent/app.json 2>/dev/null || true

# Zero-downtime checks can't work with host-published ports
dokku checks:disable agent

# Dockerfile path (monorepo root is build context)
dokku builder-dockerfile:set agent dockerfile-path apps/agent/Dockerfile

# Agent environment variables
# Ollama is reachable by hostname within agent-net (--hostname ollama set above)
# Reranker points to Ollama too — it will 404 and fall back to vector rank gracefully
dokku config:set agent \
  LLM_BASE_URL=http://ollama:11434/v1 \
  LLM_MODEL=qwen2.5:3b \
  EMBEDDING_BASE_URL=http://ollama:11434/v1 \
  EMBEDDING_MODEL=nomic-embed-text \
  EMBEDDING_DIMENSION=768 \
  RERANKER_BASE_URL=http://ollama:11434/v1 \
  RERANKER_MODEL=bona/bge-reranker-v2-m3 \
  MASTRA_DB_URL=file:/data/mastra.db \
  CONTENT_ROOT=/app/packages/content

echo "Dokku agent apps configured."
SETUP

echo ""
echo "==> Adding SSH deploy key to Dokku..."
cat "$SSH_PUBKEY_FILE" | $SSH "sudo dokku ssh-keys:add deployer" || \
  echo "    (Key may already be added — continuing)"

echo ""
echo "==> Bootstrap complete for ${SSH_HOST}!"
echo ""
echo "    Next steps:"
echo "    1. Add git remotes:"
echo "       git remote add dokku-ollama ssh://dokku@${SSH_HOST}:2222/ollama"
echo "       git remote add dokku-agent  ssh://dokku@${SSH_HOST}:2222/agent"
echo "    2. Deploy: ./deploy/deploy-agent.sh ${SSH_HOST}"
