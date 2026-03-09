#!/usr/bin/env bash
set -euo pipefail

# Reach the agent via its hostname on agent-net (--hostname agent set in deploy docker-options)
AGENT_URL="http://agent:4111"
TIMEOUT=120
START=$(date +%s)

echo "[trigger-index] Waiting for agent at ${AGENT_URL}..."
until curl -sf "${AGENT_URL}/api/agents" > /dev/null 2>&1; do
  if [ $(( $(date +%s) - START )) -ge $TIMEOUT ]; then
    echo "[trigger-index] ERROR: timed out after ${TIMEOUT}s"
    exit 1
  fi
  sleep 2
done

echo "[trigger-index] Starting content indexing..."
RUN_ID=$(curl -sf -X POST "${AGENT_URL}/api/workflows/index-markdown-content/create-run" \
  -H "Content-Type: application/json" -d '{}' | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)

curl -sf -X POST "${AGENT_URL}/api/workflows/index-markdown-content/start?runId=${RUN_ID}" \
  -H "Content-Type: application/json" -d '{}' > /dev/null

echo "[trigger-index] Indexing started (runId: ${RUN_ID})"
