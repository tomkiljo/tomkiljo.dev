import { OllamaEmbeddingModel } from "./ollama";
import { OllamaRerankerModel, rerank } from "./ollama-reranker";
import { embeddingModelConfig, rerankerModelConfig } from "../config";
import { contentVectorStore, CONTENT_INDEX_NAME } from "./vector-store";

export type ContentMatch = {
  chunk: string;
  score: number;
  title: string;
  sourceFile: string;
  sourceLink: string;
  section: string;
  documentId: string;
  chunkIndex?: number;
  dateCreated: string;
  dateModified: string;
  dateUpdated: string;
};

export async function retrieveContent(
  queryText: string,
  topK = 8,
  section?: string,
): Promise<{ matches: ContentMatch[]; total: number }> {
  const embeddingModel = new OllamaEmbeddingModel(embeddingModelConfig);
  const { embeddings: queryEmbeddings } = await embeddingModel.doEmbed({ values: [queryText] });

  const initialResults = await contentVectorStore.query({
    indexName: CONTENT_INDEX_NAME,
    queryVector: queryEmbeddings[0],
    topK,
    filter: section ? { section } : undefined,
  });

  const rerankerClient = new OllamaRerankerModel(rerankerModelConfig);
  const rankedEntries = await rerank(rerankerClient, queryText, initialResults, initialResults.length);

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

  return { matches, total: matches.length };
}
