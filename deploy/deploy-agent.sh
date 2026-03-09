#!/usr/bin/env bash
set -euo pipefail

# Deploy the agent and Ollama inference service to vm-002.
# Usage: ./deploy/deploy-agent.sh <ssh-host> [branch] [ssh-port]
#
# <ssh-host>  Hostname or IP of the agent server (arn-prod-hypershell-vm-002)
# [branch]    Local branch to deploy (default: HEAD)
# [ssh-port]  SSH port of the server (default: 2222)
#
# Services deployed:
#   ollama  - Ollama inference service (deploy/dockerfiles/Dockerfile.ollama)
#   agent   - Mastra agent            (apps/agent/Dockerfile)

SSH_HOST="${1:?Usage: $0 <ssh-host> [branch] [ssh-port]}"
BRANCH="${2:-HEAD}"
SSH_PORT="${3:-2222}"

ensure_remote() {
  local name="$1"
  local url="$2"
  if ! git remote get-url "$name" &>/dev/null; then
    echo "    Adding git remote '${name}' -> ${url}"
    git remote add "$name" "$url"
  else
    local current
    current="$(git remote get-url "$name")"
    if [[ "$current" != "$url" ]]; then
      echo "    Updating git remote '${name}': ${current} -> ${url}"
      git remote set-url "$name" "$url"
    fi
  fi
}

echo "==> Ensuring git remotes for ${SSH_HOST}..."
ensure_remote "dokku-ollama" "ssh://dokku@${SSH_HOST}:${SSH_PORT}/ollama"
ensure_remote "dokku-agent"  "ssh://dokku@${SSH_HOST}:${SSH_PORT}/agent"

# Deploy Ollama first — agent depends on it being available
echo ""
echo "==> Deploying Ollama inference service..."
echo "    (First deploy will pull models — this may take a while)"
git push dokku-ollama "${BRANCH}:main"

echo ""
echo "==> Deploying agent..."
git push dokku-agent "${BRANCH}:main"

echo ""
echo "==> Deploy complete."
echo "    Agent API: http://${SSH_HOST}:4111"
echo "    Content indexing runs automatically via Dokku postdeploy (app.json)"
