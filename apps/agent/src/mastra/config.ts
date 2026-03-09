import path from "node:path";
import { fileURLToPath } from "node:url";
import { OllamaModelConfig } from "./lib/ollama";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../../../");

export const MASTRA_DB_URL = process.env.MASTRA_DB_URL ?? "file:./mastra.db";

export const CONTENT_ROOT = process.env.CONTENT_ROOT
  ? path.resolve(process.env.CONTENT_ROOT)
  : path.join(repoRoot, "packages/content");

export const CONTENT_INDEX_NAME = process.env.CONTENT_INDEX_NAME ?? "markdown_content";

export const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "http://localhost:11435/v1";
export const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:3b";

export const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL ?? "http://localhost:11435/v1";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";
export const EMBEDDING_DIMENSION = Number.parseInt(process.env.EMBEDDING_DIMENSION ?? "768", 10);

export const RERANKER_BASE_URL = process.env.RERANKER_BASE_URL ?? "http://localhost:11435/v1";
export const RERANKER_MODEL = process.env.RERANKER_MODEL ?? "bona/bge-reranker-v2-m3";

export const OPENAI_COMPAT_API_KEY = process.env.OPENAI_COMPAT_API_KEY;

export const llmModelConfig: OllamaModelConfig = {
  providerId: "openai",
  id: `ollama/${LLM_MODEL}`,
  url: LLM_BASE_URL,
};

export const embeddingModelConfig: OllamaModelConfig = {
  providerId: "openai",
  id: `ollama/${EMBEDDING_MODEL}`,
  url: EMBEDDING_BASE_URL,
};

export const rerankerModelConfig: OllamaModelConfig = {
  providerId: "openai",
  id: `ollama/${RERANKER_MODEL}`,
  url: RERANKER_BASE_URL,
};
