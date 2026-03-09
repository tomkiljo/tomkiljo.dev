#!/bin/bash
set -e

# Models to pull on first startup (space-separated).
# Override via PULL_MODELS env var.
PULL_MODELS="${PULL_MODELS:-qwen2.5:3b nomic-embed-text}"

# Start the Ollama server in the background
ollama serve &
OLLAMA_PID=$!

# Wait for the server to accept connections
echo "[ollama] Waiting for server to start..."
until ollama list > /dev/null 2>&1; do
  sleep 1
done
echo "[ollama] Server ready."

# Pull each model if not already present (persisted via volume mount)
for model in $PULL_MODELS; do
  if ollama list 2>/dev/null | grep -q "^${model}"; then
    echo "[ollama] Model already present: $model"
  else
    echo "[ollama] Pulling model: $model"
    ollama pull "$model"
  fi
done

echo "[ollama] All models ready."

# Hand off to the server process
wait $OLLAMA_PID
