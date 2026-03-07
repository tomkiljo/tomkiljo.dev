## Personal site

This is my personal developer site created with Next.js.

## Requirements

- Node.js 24 LTS
- pnpm 10+
- Bun (for `apps/tui`)

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm --filter tui dev`
- `pnpm --filter tui dev:ssh`
- `pnpm lint`
- `pnpm build`

## TUI over SSH

Run SSH server for the terminal UI:

- `pnpm --filter tui start:ssh`

Defaults:

- SSH listens on `0.0.0.0:2222`
- Username is accepted but ignored (no auth in current version)
- Host key is auto-generated at `apps/tui/.data/tui-ssh-host-key.pem` if missing

Optional environment variables:

- `SSH_LISTEN_HOST` (default `0.0.0.0`)
- `SSH_LISTEN_PORT` (default `2222`)
- `SSH_HOST_KEY_PATH` (default `apps/tui/.data/tui-ssh-host-key.pem`)
- `SSH_STATUS_HOST` (default `127.0.0.1`)
- `SSH_STATUS_PORT` (default `39217`)
- `TUI_SSH_COMMAND` (default `bun run src/main.tsx`)

The Home screen `Logged in users` value shows active SSH sessions (not unique usernames).

Status endpoints (bound to `SSH_STATUS_HOST:SSH_STATUS_PORT`):

- `GET /status` → active session count
- `GET /health` → status, uptime, active sessions, total sessions served

## Local Mastra content agent

1. Start local llama.cpp servers (chat + embeddings):
   - `./run-smollm2-1.7b-llamacpp.sh`
2. In another shell, run Mastra dev server:
   - `pnpm --filter agent dev`
3. Open Mastra Studio and run workflow `index-markdown-content` once.
4. Chat with agent `contentChatAgent`.

Optional environment variables used by `apps/agent`:

- `LLM_BASE_URL` (default `http://localhost:8080`, `/v1` is added automatically if missing)
- `LLM_MODEL` (default `smollm2-1.7b`)
- `EMBEDDING_BASE_URL` (default `http://localhost:8081`, `/v1` is added automatically if missing)
- `EMBEDDING_MODEL` (default `nomic-embed-text`)
- `EMBEDDING_DIMENSION` (default `768`)
- `CONTENT_ROOT` (default `packages/content`)
