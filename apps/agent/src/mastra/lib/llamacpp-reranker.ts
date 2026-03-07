import type { LlamaCppModelConfig } from "./llamacpp";

export type OpenAICompatibleRerankRequest = {
  model: string;
  query: string;
  documents: string[];
  top_n: number;
};

export type LlamaCppRerankItem = {
  index: number;
  relevanceScore: number;
};

export type RankedResult<T> = {
  result: T;
  score: number;
};

const parseRerankResponse = (payload: unknown): LlamaCppRerankItem[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidateData = (payload as { data?: unknown[] }).data;
  const candidateResults = (payload as { results?: unknown[] }).results;
  const rows = Array.isArray(candidateData)
    ? candidateData
    : Array.isArray(candidateResults)
      ? candidateResults
      : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return undefined;
      }

      const index = (row as { index?: unknown }).index;
      const relevanceScore =
        (row as { relevance_score?: unknown }).relevance_score ??
        (row as { relevanceScore?: unknown }).relevanceScore;

      if (
        !Number.isInteger(index) ||
        typeof relevanceScore !== "number" ||
        Number.isNaN(relevanceScore)
      ) {
        return undefined;
      }

      return {
        index,
        relevanceScore,
      };
    })
    .filter((item): item is LlamaCppRerankItem => Boolean(item));
};

export class LlamaCppRerankerModel {
  private readonly model: string;
  private readonly rerankUrl: string;

  constructor(config: LlamaCppModelConfig) {
    this.model = config.id;
    const sanitizedBase = config.url.trim().replace(/\/+$/, "");
    this.rerankUrl = sanitizedBase.endsWith("/v1")
      ? `${sanitizedBase}/rerank`
      : `${sanitizedBase}/v1/rerank`;
  }

  async doRerank(query: string, documents: string[], topN: number): Promise<LlamaCppRerankItem[]> {
    const response = await fetch(this.rerankUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents,
        top_n: topN,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Reranker request failed (${response.status}): ${bodyText}`);
    }

    const payload = (await response.json()) as unknown;
    return parseRerankResponse(payload);
  }
}

export const rerank = async <T extends { metadata?: { text?: unknown }; score?: unknown }>(
  client: LlamaCppRerankerModel,
  query: string,
  initialResults: T[],
  topN: number
): Promise<RankedResult<T>[]> => {
  const rankedEntries = initialResults.map((result) => ({
    result,
    score: typeof result.score === "number" && Number.isFinite(result.score) ? result.score : 0,
  }));

  if (initialResults.length === 0) {
    return rankedEntries;
  }

  const documents = initialResults.map((result) => String(result.metadata?.text ?? ""));

  try {
    const rerankResults = await client.doRerank(
      query,
      documents,
      Math.min(topN, initialResults.length)
    );
    if (rerankResults.length === 0) {
      return rankedEntries;
    }

    return rerankResults
      .map(({ index, relevanceScore }) => ({
        result: initialResults[index],
        score: relevanceScore,
      }))
      .filter((item): item is RankedResult<T> => Boolean(item.result))
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    console.warn("Reranker failed, falling back to vector rank:", error);
    return rankedEntries;
  }
};
