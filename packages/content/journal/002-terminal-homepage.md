---
title: "Terminal "Homepage""
dateCreated: 2026-03-09
dateModified: 2026-03-09
---

# Building a Terminal "Homepage"

Everyone has a homepage. Not everyone has a home-terminal.

That idea had been sitting in my head for a long time — probably tracing back to growing up in the early days of home internet, BBS boards, and IRC. The terminal has always had a particular appeal that the web never quite replaced. The final nudge came from watching one of my favorite YouTubers build an SSH terminal shop for buying coffee. That was it. I wanted one.

The result is this site. The classic web part is deliberately bare-bones — a near-empty page whose only real purpose is to point you toward the terminal. If you ssh into `terminal.tomkiljo.dev`, you get the real thing.

## What it actually is

It's a place for my CV and occasional journal entries on tech stuff I do in my spare time. Mostly it's just a fun thing to build and a way to learn. Not a portfolio in the professional sense, not a statement — just a project I genuinely enjoy tinkering with.

The stack is a OpenTUI React-based terminal UI running over SSH, backed by a Mastra AI agent with RAG for answering questions about my journal entries.

## Running on Oracle Cloud free tier

The whole terminal experience runs on Oracle Cloud's always-free VMs — two instances:

- **VM-001** (TUI): `VM.Standard.E2.1.Micro` — 1 OCPU, 1 GB RAM. Handles the SSH server and terminal UI.
- **VM-002** (Agent): `VM.Standard.A1.Flex` — 4 OCPU, 24 GB RAM. Runs the Mastra agent and Ollama with local models.

No cloud AI APIs. Everything local.

## Local-first AI was a deliberate choice

From the start I wanted to explore what's possible with local models on low-end and home-grade hardware. The Ampere ARM VM is surprisingly capable — it runs `qwen2.5:3b` for chat and `nomic-embed-text` for embeddings adequately enough for a personal project like this.

The harder part isn't visible in the code: finding the right models and tuning their performance parameters so the agent actually feels usable took significant iteration. I also migrated from llama.cpp to Ollama midway through — necessary for better Docker image support on ARM — but it cost me the reranker logic I had built, since Ollama doesn't expose a reranker endpoint yet. The reranker is still in the codebase, wired up for when support lands.

## The interesting technical bits

Yes, the entire thing is written in TypeScript. Running on Node and Bun, I have made peace with this.

The SSH server avoids `node-pty` entirely, using Bun's FFI to interface directly with libc for PTY management. Each SSH connection spawns a fresh TUI process. There's no auth — anyone can connect.

Content is markdown files with YAML frontmatter. On each deployment, a Mastra workflow scans the content directory, chunks the documents respecting heading structure, generates embeddings, and stores them in a LibSQL vector index. The agent retrieves the top chunks at query time and injects them as context.

Deployment is handled by Dokku — a self-hosted Heroku-like platform that turns a `git push` into a running container. Each app (TUI, agent, Ollama) is a separate Dokku app on its respective VM, wired together over an internal Docker network. It's a surprisingly pleasant way to manage a small self-hosted setup: runs on low-end hardware, proper app isolation, environment config, and persistent storage mounts without the overhead of Kubernetes.

The web app is a single minified HTML file. Intentionally.

## Links to the technical enablers

- [OpenTUI](https://github.com/sst/opentui) — native terminal UI core written in Zig with TypeScript bindings
- [ssh2](https://github.com/mscdex/ssh2) — SSH server for Node.js
- [Mastra](https://mastra.ai) — AI agent and workflow framework
- [Dokku](https://dokku.com) — Heroku-like self-hosted PaaS
