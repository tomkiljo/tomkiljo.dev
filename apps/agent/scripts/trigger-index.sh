#!/usr/bin/env bash
set -euo pipefail

# Reach the published port via the Docker host gateway (avoids DNS dependency)
GATEWAY=$(ip route show default | awk '/default/ {print $3}')
AGENT_URL="http://${GATEWAY}:4111"

echo "[trigger-index] Waiting for agent to be ready..."
until curl -sf "${AGENT_URL}/api/agents" > /dev/null 2>&1; do
  sleep 2
done

echo "[trigger-index] Starting content indexing..."
RUN_ID=$(curl -sf -X POST "${AGENT_URL}/api/workflows/index-markdown-content/create-run" \
  -H "Content-Type: application/json" -d '{}' | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)

curl -sf -X POST "${AGENT_URL}/api/workflows/index-markdown-content/start?runId=${RUN_ID}" \
  -H "Content-Type: application/json" -d '{}' > /dev/null

echo "[trigger-index] Indexing started (runId: ${RUN_ID})"
