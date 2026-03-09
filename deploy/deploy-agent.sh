#!/usr/bin/env bash
set -euo pipefail

# Deploy the agent and all inference services to vm-002.
# Usage: ./deploy/deploy-agent.sh <ssh-host> [branch] [ssh-port]
#
# <ssh-host>  Hostname or IP of the agent server (arn-prod-hypershell-vm-002)
# [branch]    Local branch to deploy (default: HEAD)
# [ssh-port]  SSH port of the server (default: 2222)
#
# Services deployed:
#   llm        - llama.cpp LLM inference (deploy/dockerfiles/Dockerfile.llm)
#   embeddings - llama.cpp embeddings   (deploy/dockerfiles/Dockerfile.embeddings)
#   reranker   - llama.cpp reranker     (deploy/dockerfiles/Dockerfile.reranker)
#   agent      - Mastra agent           (apps/agent/Dockerfile)

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
ensure_remote "dokku-llm"        "ssh://dokku@${SSH_HOST}:${SSH_PORT}/llm"
ensure_remote "dokku-embeddings" "ssh://dokku@${SSH_HOST}:${SSH_PORT}/embeddings"
ensure_remote "dokku-reranker"   "ssh://dokku@${SSH_HOST}:${SSH_PORT}/reranker"
ensure_remote "dokku-agent"      "ssh://dokku@${SSH_HOST}:${SSH_PORT}/agent"

# Deploy inference services first — they must be running before the agent starts
echo ""
echo "==> Deploying llm inference service..."
git push dokku-llm "${BRANCH}:main"

echo ""
echo "==> Deploying embeddings inference service..."
git push dokku-embeddings "${BRANCH}:main"

echo ""
echo "==> Deploying reranker inference service..."
git push dokku-reranker "${BRANCH}:main"

echo ""
echo "==> Deploying agent..."
git push dokku-agent "${BRANCH}:main"

echo ""
echo "==> Deploy complete."
echo "    Agent API: http://${SSH_HOST}:4111"
echo "    Health check: curl http://${SSH_HOST}:4111/api/agents"
