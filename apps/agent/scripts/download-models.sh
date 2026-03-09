#!/bin/sh
set -e

mkdir -p /models

download_if_missing() {
  local name="$1"
  local url="$2"

  if [ -f "/models/$name" ]; then
    echo "Model already exists: $name"
    return
  fi

  echo "Downloading $name ..."
  curl -fL --progress-bar "$url" -o "/models/$name"
  echo "Downloaded: $name"
}

download_if_missing \
  "${LLM_MODEL_NAME:-Qwen2.5-3B-Instruct-Q4_K_M.gguf}" \
  "${LLM_MODEL_URL:-https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf?download=true}"

download_if_missing \
  "${EMBEDDING_MODEL_NAME:-nomic-embed-text-v1.5.Q8_0.gguf}" \
  "${EMBEDDING_MODEL_URL:-https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q8_0.gguf?download=true}"

download_if_missing \
  "${RERANKER_MODEL_NAME:-bge-reranker-v2-m3-Q4_K_M.gguf}" \
  "${RERANKER_MODEL_URL:-https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/main/bge-reranker-v2-m3-Q4_K_M.gguf?download=true}"

echo "All models ready."
