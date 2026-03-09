import type { OllamaModelConfig } from "./ollama";

export type OpenAICompatibleRerankRequest = {
  model: string;
  query: string;
  documents: string[];
  top_n: number;
};

export type OllamaRerankItem = {
  index: number;
  relevanceScore: number;
};

export type RankedResult<T> = {
  result: T;
  score: number;
};

// Note: Ollama's is currently not supporting rerank endpoint, so this is a placeholder implementation.
// https://github.com/ollama/ollama/issues/3368
export class OllamaRerankerModel {
  private readonly model: string;
  private readonly rerankUrl: string;

  constructor(config: OllamaModelConfig) {
    // strip "ollama/" prefix if present to allow for more flexible model naming (e.g. "bona/bge-reranker-v2-m3" instead of "ollama/bona/bge-reranker-v2-m3")
    if (config.id.startsWith("ollama/")) {
      this.model = config.id.slice(7);
    } else {
      this.model = config.id;
    }
    const sanitizedBase = config.url.trim().replace(/\/+$/, "");
    // strip /v1 suffix if present — Ollama rerank endpoint is /api/rerank, not /v1/rerank
    const base = sanitizedBase.endsWith("/v1") ? sanitizedBase.slice(0, -3) : sanitizedBase;
    this.rerankUrl = `${base}/api/rerank`;
  }

  async doRerank(query: string, documents: string[], topN: number): Promise<OllamaRerankItem[]> {
    console.log(`[reranker] POST ${this.rerankUrl} model=${this.model}`);
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
    return this.parseRerankResponse(payload);
  }

  parseRerankResponse(payload: unknown): OllamaRerankItem[] {
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
      .filter((item): item is OllamaRerankItem => Boolean(item));
  }
}

// BM25 and MMR parameters for fallback scoring when the reranker fails.
// These can be tuned based on your specific use case and document characteristics.
const BM25_K1 = 1.5;
const BM25_B = 0.75;
const BM25_VECTOR_WEIGHT = 0.3;
const MMR_LAMBDA = 0.6;

// Basic tokenization function: lowercase and split on non-word characters.
// This is very naive and can be improved with a proper tokenizer if needed.
const tokenize = (text: string): string[] => text.toLowerCase().split(/\W+/).filter(Boolean);

// Simple BM25 implementation for fallback scoring when the reranker fails.
// This is not optimized for large document sets, but should be fine for small reranking tasks (e.g. top 100).
export const bm25Scores = (query: string, documents: string[]): number[] => {
  if (documents.length === 0) return [];

  const queryTerms = tokenize(query);
  const tokenizedDocs = documents.map(tokenize);
  const avgDocLen = tokenizedDocs.reduce((sum, d) => sum + d.length, 0) / tokenizedDocs.length;
  const N = documents.length;

  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    const df = tokenizedDocs.filter((doc) => doc.includes(term)).length;
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  return tokenizedDocs.map((docTerms) => {
    const tf = new Map<string, number>();
    for (const term of docTerms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
    let score = 0;
    for (const term of queryTerms) {
      const termTf = tf.get(term) ?? 0;
      const termIdf = idf.get(term) ?? 0;
      score +=
        termIdf *
        ((termTf * (BM25_K1 + 1)) /
          (termTf + BM25_K1 * (1 - BM25_B + (BM25_B * docTerms.length) / avgDocLen)));
    }
    return score;
  });
};

// Simple MMR implementation to diversify results based on document similarity.
// This is used as a fallback when the reranker fails, to avoid returning very similar top results.
export const applyMMR = <T>(scored: RankedResult<T>[], documents: string[]): RankedResult<T>[] => {
  if (scored.length <= 1) return scored;

  const tokenizedDocs = documents.map(tokenize);
  const remaining = scored.map((_, i) => i);
  const selected: number[] = [];
  const result: RankedResult<T>[] = [];

  const jaccardSimilarity = (a: string[], b: string[]): number => {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  };

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const i of remaining) {
      const relevance = scored[i].score;
      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((j) => jaccardSimilarity(tokenizedDocs[i], tokenizedDocs[j])));
      const mmrScore = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(bestIdx);
    remaining.splice(remaining.indexOf(bestIdx), 1);
    result.push(scored[bestIdx]);
  }

  return result;
};

// Main function to rerank results using the OllamaRerankerModel, with a fallback to BM25+MMR if the reranker fails.
export const rerank = async <T extends { metadata?: { text?: unknown }; score?: unknown }>(
  client: OllamaRerankerModel,
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

  //// Disable reranker for now since Ollama doesn't support it yet, and fallback is decent on its own.
  //// Re-enable once Ollama has proper reranking support.
  // try {
  //   const rerankResults = await client.doRerank(
  //     query,
  //     documents,
  //     Math.min(topN, initialResults.length)
  //   );
  //   if (rerankResults.length === 0) {
  //     return rankedEntries;
  //   }

  //   return rerankResults
  //     .map(({ index, relevanceScore }) => ({
  //       result: initialResults[index],
  //       score: relevanceScore,
  //     }))
  //     .filter((item): item is RankedResult<T> => Boolean(item.result))
  //     .sort((a, b) => b.score - a.score);
  // } catch (error) {
  //   console.warn("Reranker failed, falling back to BM25 hybrid rank:", error);

  const rawBm25 = bm25Scores(query, documents);
  const maxBm25 = Math.max(...rawBm25, 1e-9);
  const maxVector = Math.max(...rankedEntries.map((e) => e.score), 1e-9);

  const hybridScored = rankedEntries.map((entry, i) => ({
    ...entry,
    score:
      BM25_VECTOR_WEIGHT * (entry.score / maxVector) +
      (1 - BM25_VECTOR_WEIGHT) * (rawBm25[i] / maxBm25),
  }));

  const sorted = hybridScored.sort((a, b) => b.score - a.score);
  const diversified = applyMMR(sorted, documents);
  return diversified.slice(0, Math.min(topN, initialResults.length));
  // }
};
