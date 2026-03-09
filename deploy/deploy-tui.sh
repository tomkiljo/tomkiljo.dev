#!/usr/bin/env bash
set -euo pipefail

# Deploy the tui app to vm-001.
# Usage: ./deploy/deploy-tui.sh <ssh-host> [branch]
#
# <ssh-host>  Hostname or IP of the TUI server (arn-prod-hypershell-vm-001)
# [branch]    Local branch to deploy (default: HEAD)

SSH_HOST="${1:?Usage: $0 <ssh-host> [branch]}"
BRANCH="${2:-HEAD}"
REMOTE="dokku-tui"
REMOTE_URL="dokku@${SSH_HOST}:tui"

# Ensure git remote exists
if ! git remote get-url "$REMOTE" &>/dev/null; then
  echo "==> Adding git remote '${REMOTE}' -> ${REMOTE_URL}"
  git remote add "$REMOTE" "$REMOTE_URL"
else
  CURRENT_URL="$(git remote get-url "$REMOTE")"
  if [[ "$CURRENT_URL" != "$REMOTE_URL" ]]; then
    echo "==> Updating git remote '${REMOTE}': ${CURRENT_URL} -> ${REMOTE_URL}"
    git remote set-url "$REMOTE" "$REMOTE_URL"
  fi
fi

echo "==> Deploying tui to ${SSH_HOST}..."
git push "$REMOTE" "${BRANCH}:main"

echo ""
echo "==> Deploy complete."
echo "    TUI SSH server: ssh <user>@${SSH_HOST}"
echo "    Status endpoint: http://${SSH_HOST}:39217"
