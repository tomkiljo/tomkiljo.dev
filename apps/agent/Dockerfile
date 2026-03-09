# syntax=docker/dockerfile:1

# ── deps stage ────────────────────────────────────────────────────────────────
FROM node:24-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/content/package.json ./packages/content/

RUN pnpm install --frozen-lockfile

# ── build stage ───────────────────────────────────────────────────────────────
FROM deps AS build

# Copy source for packages needed at build time
COPY apps/agent ./apps/agent
COPY packages/content ./packages/content

WORKDIR /app/apps/agent
RUN pnpm run build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app/apps/agent

# Copy installed node_modules (includes native bindings like @libsql/client)
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/agent/node_modules ./node_modules

# Copy build output
COPY --from=build /app/apps/agent/.mastra ./.mastra

# Copy package.json for pnpm run start
COPY --from=build /app/apps/agent/package.json ./package.json

# Copy content for RAG (CONTENT_ROOT defaults to /app/packages/content)
COPY --from=build /app/packages/content /app/packages/content

# Copy deployment scripts (used by Dokku postdeploy via app.json)
COPY --from=build /app/apps/agent/scripts ./scripts

EXPOSE 4111

ENV LLM_BASE_URL="http://llm:8080/v1"
ENV LLM_MODEL="qwen2.5:3b"
ENV EMBEDDING_BASE_URL="http://embeddings:8080"
ENV EMBEDDING_MODEL="nomic-embed-text"
ENV EMBEDDING_DIMENSION="768"
ENV RERANKER_BASE_URL="http://reranker:8080"
ENV RERANKER_MODEL="bona/bge-reranker-v2-m3"
ENV MASTRA_DB_URL="file:/data/mastra.db"
ENV CONTENT_ROOT="/app/packages/content"

CMD ["pnpm", "run", "start"]
