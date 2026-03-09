import { ModelRouterEmbeddingModel, OpenAICompatibleConfig } from "@mastra/core/llm";

export * from "./ollama-reranker";

export type OllamaModelConfig = OpenAICompatibleConfig & {
  providerId: "openai";
  id: `${string}/${string}`;
  url: string;
};

export class OllamaEmbeddingModel<
  VALUE extends string = string,
> extends ModelRouterEmbeddingModel<VALUE> {
  constructor(config: OllamaModelConfig) {
    super(config);
  }
}

export class OllamaLanguageModel<
  VALUE extends string = string,
> extends ModelRouterEmbeddingModel<VALUE> {
  constructor(config: OllamaModelConfig) {
    super(config);
  }
}
