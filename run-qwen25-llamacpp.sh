#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${MODEL_DIR:-$PWD/.models}"
MODEL_NAME="${MODEL_NAME:-Qwen2.5-3B-Instruct-Q4_K_M.gguf}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf?download=true}"

CONTAINER_IMAGE="${CONTAINER_IMAGE:-ghcr.io/ggml-org/llama.cpp:server}"
CONTAINER_NAME="${CONTAINER_NAME:-llama-cpp-qwen25-3b}"
PORT="${PORT:-8080}"

mkdir -p "$MODEL_DIR"
MODEL_PATH="$MODEL_DIR/$MODEL_NAME"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH" >&2
  exit 1
fi

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Downloading model to $MODEL_PATH"
  if command -v curl >/dev/null 2>&1; then
    curl -L --fail --progress-bar "$MODEL_URL" -o "$MODEL_PATH"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$MODEL_PATH" "$MODEL_URL"
  else
    echo "Error: neither curl nor wget is available for downloading the model" >&2
    exit 1
  fi
else
  echo "Model already exists at $MODEL_PATH"
fi

echo "Pulling $CONTAINER_IMAGE"
docker pull "$CONTAINER_IMAGE"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Removing existing container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

echo "Starting llama.cpp server on port $PORT"
docker run --name "$CONTAINER_NAME" --rm \
  -p "$PORT":8080 \
  -v "$MODEL_DIR":/models \
  "$CONTAINER_IMAGE" \
  -m "/models/$MODEL_NAME" \
  --host 0.0.0.0 \
  --port 8080