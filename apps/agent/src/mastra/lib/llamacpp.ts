import { ModelRouterEmbeddingModel, OpenAICompatibleConfig } from "@mastra/core/llm";

export * from "./llamacpp-reranker";

export type LlamaCppModelConfig = OpenAICompatibleConfig & {
  providerId: "openai";
  id: `${string}/${string}`;
  url: string;
};

export class LlamaCppEmbeddingModel<
  VALUE extends string = string,
> extends ModelRouterEmbeddingModel<VALUE> {
  constructor(config: LlamaCppModelConfig) {
    super(config);
  }
}

export class LlamaCppLanguageModel<
  VALUE extends string = string,
> extends ModelRouterEmbeddingModel<VALUE> {
  constructor(config: LlamaCppModelConfig) {
    super(config);
  }
}
