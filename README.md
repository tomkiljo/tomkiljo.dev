# tomkiljo.dev

Personal homepage + terminal UI + local content RAG agent.

This is a `pnpm`/Turborepo monorepo with:

- `apps/tui`: terminal UI app (OpenTUI + React) with optional SSH server
- `apps/agent`: Mastra-based RAG/content chat agent
- `apps/web`: static web frontend
- `packages/content`: markdown content corpus used by the agent and UI

## Workspace layout

```text
apps/
   agent/   # Mastra agent + workflows + Docker setup
   tui/     # OpenTUI terminal app + SSH server
   web/     # Static site build/serve
packages/
   content/ # Markdown knowledge/content files
deploy/    # Deployment/bootstrap scripts
scripts/   # Local llama.cpp helper scripts
```

## Requirements

- Node.js `>=24`
- `pnpm` `>=10`
- Bun (required by `apps/tui` scripts)
- Docker + Docker Compose (for local model-serving stacks)

## Install

```bash
pnpm install
```

## Monorepo scripts (root)

```bash
pnpm dev        # turbo run dev
pnpm build      # turbo run build
pnpm lint       # turbo run lint
pnpm clean      # turbo run clean
pnpm format     # prettier write
```

## App scripts

### Agent (`apps/agent`)

```bash
pnpm --filter agent dev
pnpm --filter agent build
pnpm --filter agent start
pnpm --filter agent clean
```

### TUI (`apps/tui`)

```bash
pnpm --filter tui dev
pnpm --filter tui dev:ssh
pnpm --filter tui start:ssh
pnpm --filter tui build
```

### Web (`apps/web`)

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web start
```

## TUI over SSH

Run the SSH server:

```bash
pnpm --filter tui start:ssh
```

Defaults:

- listens on `0.0.0.0:2222`
- host key path: `apps/tui/.data/tui-ssh-host-key.pem` (auto-generated if missing)
- username is currently accepted but not used for auth

Optional env vars:

- `SSH_LISTEN_HOST` (default `0.0.0.0`)
- `SSH_LISTEN_PORT` (default `2222`)
- `SSH_HOST_KEY_PATH` (default `apps/tui/.data/tui-ssh-host-key.pem`)
- `SSH_STATUS_HOST` (default `127.0.0.1`)
- `SSH_STATUS_PORT` (default `39217`)
- `TUI_SSH_COMMAND` (default `bun run src/main.tsx`)

Status endpoints (`SSH_STATUS_HOST:SSH_STATUS_PORT`):

- `GET /status` → active session count
- `GET /health` → status, uptime, active sessions, total sessions served

## Local content agent

### Option A: full local stack (`apps/agent/docker-compose.yml`)

From `apps/agent`:

```bash
docker compose up --build
```

This starts:

- `ollama` on `11435` (mapped to container `11434`)
- `agent` on `${AGENT_PORT:-4111}`

### Option B: external/local model endpoint + agent dev server

1. Start your local model endpoint (Ollama/OpenAI-compatible API).
2. Run:

```bash
pnpm --filter agent dev
```

3. In Mastra Studio, run workflow `index-markdown-content` once.
4. Chat with agent `contentChatAgent`.

Agent env vars (optional):

- `LLM_BASE_URL` (default `http://localhost:11435/v1`)
- `LLM_MODEL` (default `qwen2.5:3b`)
- `EMBEDDING_BASE_URL` (default `http://localhost:11435/v1`)
- `EMBEDDING_MODEL` (default `nomic-embed-text`)
- `EMBEDDING_DIMENSION` (default `768`)
- `RERANKER_BASE_URL` (default `http://localhost:11435/v1`)
- `RERANKER_MODEL` (default `bona/bge-reranker-v2-m3`)
- `OPENAI_COMPAT_API_KEY` (optional)
- `MASTRA_DB_URL` (default `file:./mastra.db`)
- `CONTENT_ROOT` (default `packages/content`)
- `CONTENT_INDEX_NAME` (default `markdown_content`)

## Local llama.cpp model-serving stack

Root `docker-compose.yml` defines three services for llama.cpp server mode:

- `llm` (default host port `8080`)
- `embeddings` (default host port `8081`)
- `reranker` (default host port `8082`)

Model files are mounted from `${MODEL_DIR:-./.models}`.

## Deployment

Scripts in `deploy/` are geared for Dokku-style git push deploys:

- `./deploy/deploy-agent.sh <ssh-host> [branch] [ssh-port]`
   - deploys both `ollama` and `agent`
   - waits for agent readiness
   - triggers indexing via `apps/agent/scripts/trigger-index.sh`
- `./deploy/deploy-tui.sh <ssh-host> [branch] [ssh-port]`
   - deploys `tui`

Bootstrap scripts are also included:

- `deploy/bootstrap-agent-server.sh`
- `deploy/bootstrap-tui-server.sh`

## Content package

Markdown files under `packages/content/journal/` are the source content for indexing and retrieval.
