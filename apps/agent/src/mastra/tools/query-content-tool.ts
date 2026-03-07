import { ModelRouterEmbeddingModel, ModelRouterLanguageModel } from "@mastra/core/llm";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  embeddingModelConfig,
  rerankerModelConfig,
  RERANKER_BASE_URL,
  RERANKER_MODEL,
} from "../config";
import { contentVectorStore, CONTENT_INDEX_NAME } from "../lib/vector-store";
import { LlamaCppRerankerModel, rerank } from "../lib/llamacpp-reranker";
import { LlamaCppEmbeddingModel } from "../lib/llamacpp";

export const queryContentTool = createTool({
  id: "query-content",
  description:
    "Retrieve relevant markdown chunks from indexed local content. Returns chunk text and source metadata including sourceLink and sourceFile.",
  inputSchema: z.object({
    queryText: z.string().min(1).describe("Natural language query to search for"),
    topK: z.number().int().min(1).max(20).default(8),
    section: z.string().optional().describe("Optional section filter, e.g. journal"),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        chunk: z.string(),
        score: z.number(),
        title: z.string(),
        sourceFile: z.string(),
        sourceLink: z.string(),
        section: z.string(),
        documentId: z.string(),
        chunkIndex: z.number().optional(),
        dateCreated: z.string(),
        dateModified: z.string(),
        dateUpdated: z.string(),
      })
    ),
    total: z.number(),
  }),
  execute: async ({ queryText, topK, section }) => {
    // Create an embedding model instance and embed the query text to get the query vector
    const embeddingModel = new LlamaCppEmbeddingModel(embeddingModelConfig);
    const { embeddings: queryEmbeddings } = await embeddingModel.doEmbed({ values: [queryText] });

    // Get initial results from the vector store based on the query text embedding
    const initialResults = await contentVectorStore.query({
      indexName: CONTENT_INDEX_NAME,
      queryVector: queryEmbeddings[0],
      topK,
      filter: section ? { section } : undefined,
    });

    // Create a reranker model instance and rerank the initial results based on relevance to the query text
    const rerankerClient = new LlamaCppRerankerModel(rerankerModelConfig);
    const rankedEntries = await rerank(rerankerClient, queryText, initialResults, 3);

    // Map the ranked entries to the expected output format, including chunk text and source metadata
    const matches = rankedEntries.map(({ result, score }) => ({
      chunk: String(result.metadata?.text ?? ""),
      score,
      title: String(result.metadata?.title ?? "Untitled"),
      sourceFile: String(result.metadata?.sourceFile ?? ""),
      sourceLink: String(result.metadata?.sourceLink ?? ""),
      section: String(result.metadata?.section ?? "content"),
      documentId: String(result.metadata?.documentId ?? ""),
      chunkIndex: Number.isFinite(result.metadata?.chunkIndex)
        ? Number(result.metadata?.chunkIndex)
        : undefined,
      dateCreated: String(result.metadata?.dateCreated ?? ""),
      dateModified: String(result.metadata?.dateModified ?? ""),
      dateUpdated: String(result.metadata?.dateUpdated ?? ""),
    }));

    return {
      matches,
      total: matches.length,
    };
  },
});
