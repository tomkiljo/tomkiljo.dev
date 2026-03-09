#!/usr/bin/env bash
set -euo pipefail

# Bootstrap vm-002 (Agent server) with Dokku.
# Usage: ./deploy/bootstrap-agent-server.sh <ssh-host> [ssh-user]
#
# <ssh-host>  Hostname or IP of the agent server (arn-prod-hypershell-vm-002)
# [ssh-user]  SSH user (default: root)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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
for app in llm embeddings reranker agent; do
  if ! dokku apps:exists \$app 2>/dev/null; then
    dokku apps:create \$app
  fi
done

# ---- Shared internal network ----
if ! dokku network:exists agent-net 2>/dev/null; then
  dokku network:create agent-net
fi

for app in llm embeddings reranker agent; do
  dokku network:set \$app attach-post-create agent-net
done

# ---- Model storage ----
mkdir -p /opt/models
chmod 755 /opt/models

# Mount model directory into inference services
for app in llm embeddings reranker; do
  dokku storage:mount \$app /opt/models:/models
  # No public ports for inference services (internal only via agent-net)
  dokku proxy:disable \$app
done

# ---- Agent app config ----
# Persistent storage for mastra DB
dokku storage:ensure-directory agent
dokku storage:mount agent /var/lib/dokku/data/storage/agent:/data

# Disable nginx proxy, publish port directly via docker-options
dokku proxy:disable agent
dokku docker-options:add agent deploy,run "--publish 4111:4111"

# Dockerfile paths (monorepo root is build context)
dokku builder-dockerfile:set agent dockerfile-path apps/agent/Dockerfile
dokku builder-dockerfile:set llm dockerfile-path deploy/dockerfiles/Dockerfile.llm
dokku builder-dockerfile:set embeddings dockerfile-path deploy/dockerfiles/Dockerfile.embeddings
dokku builder-dockerfile:set reranker dockerfile-path deploy/dockerfiles/Dockerfile.reranker

# Agent environment variables
# Hostnames use Dokku's <app>.<network> naming within agent-net
dokku config:set agent \
  LLM_BASE_URL=http://llm.agent-net:8080/v1 \
  LLM_MODEL=qwen25-3b \
  EMBEDDING_BASE_URL=http://embeddings.agent-net:8080 \
  EMBEDDING_MODEL=nomic-embed-text \
  EMBEDDING_DIMENSION=768 \
  RERANKER_BASE_URL=http://reranker.agent-net:8080 \
  RERANKER_MODEL=bge-reranker-v2-m3 \
  MASTRA_DB_URL=file:/data/mastra.db \
  CONTENT_ROOT=/app/packages/content

echo "Dokku agent apps configured."
SETUP

echo ""
echo "==> Downloading models to /opt/models on ${SSH_HOST}..."
echo "    (This may take a long time — models are several GB)"
$SSH "sudo docker run --rm \
  -v /opt/models:/models \
  -e LLM_MODEL_NAME=Qwen2.5-3B-Instruct-Q4_K_M.gguf \
  -e LLM_MODEL_URL='https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf?download=true' \
  -e EMBEDDING_MODEL_NAME=nomic-embed-text-v1.5.Q8_0.gguf \
  -e EMBEDDING_MODEL_URL='https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf?download=true' \
  -e RERANKER_MODEL_NAME=bge-reranker-v2-m3-Q4_K_M.gguf \
  -e RERANKER_MODEL_URL='https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/main/bge-reranker-v2-m3-Q4_K_M.gguf?download=true' \
  alpine:latest sh -s" < "$REPO_ROOT/apps/agent/scripts/download-models.sh"

echo ""
echo "==> Adding SSH deploy key to Dokku..."
cat "$SSH_PUBKEY_FILE" | $SSH "sudo dokku ssh-keys:add deployer" || \
  echo "    (Key may already be added — continuing)"

echo ""
echo "==> Bootstrap complete for ${SSH_HOST}!"
echo ""
echo "    Next steps:"
echo "    1. Add git remotes:"
echo "       git remote add dokku-agent      dokku@${SSH_HOST}:agent"
echo "       git remote add dokku-llm        dokku@${SSH_HOST}:llm"
echo "       git remote add dokku-embeddings dokku@${SSH_HOST}:embeddings"
echo "       git remote add dokku-reranker   dokku@${SSH_HOST}:reranker"
echo "    2. Deploy: ./deploy/deploy-agent.sh ${SSH_HOST}"
