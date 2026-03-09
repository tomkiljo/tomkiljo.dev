# syntax=docker/dockerfile:1
# Build context: repo root (../../ relative to this file)

FROM oven/bun:latest AS deps

WORKDIR /app

# Copy TUI package files
COPY apps/tui/package.json ./apps/tui/
COPY packages/content/package.json ./packages/content/

# Install deps from the tui app directory
WORKDIR /app/apps/tui
RUN bun install --frozen-lockfile

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:latest AS runtime

WORKDIR /app/apps/tui

# Copy installed node_modules
COPY --from=deps /app/apps/tui/node_modules ./node_modules

# Copy source
COPY apps/tui/src ./src
COPY apps/tui/package.json ./package.json
COPY apps/tui/tsconfig.json ./tsconfig.json

# Copy content package
COPY packages/content /app/packages/content

EXPOSE 22
EXPOSE 39217

ENV SSH_LISTEN_HOST="0.0.0.0"
ENV SSH_LISTEN_PORT="22"
ENV SSH_STATUS_HOST="0.0.0.0"
ENV SSH_STATUS_PORT="39217"
ENV SSH_HOST_KEY_PATH="/data/tui-ssh-host-key.pem"

CMD ["bun", "src/ssh-server.ts"]
