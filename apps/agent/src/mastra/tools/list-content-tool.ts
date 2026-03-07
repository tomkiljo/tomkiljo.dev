import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { embeddingModelConfig } from "../config";
import { contentVectorStore, CONTENT_INDEX_NAME } from "../lib/vector-store";
import { LlamaCppEmbeddingModel } from "../lib/llamacpp";

export const listIndexedContentTool = createTool({
  id: "list-indexed-content",
  description: "List indexed markdown documents available for chat retrieval.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    documents: z.array(
      z.object({
        documentId: z.string(),
        title: z.string(),
        sourceFile: z.string(),
        sourceLink: z.string(),
        section: z.string(),
        dateCreated: z.string(),
        dateModified: z.string(),
        dateUpdated: z.string(),
      }),
    ),
    count: z.number(),
    message: z.string().optional(),
  }),
  execute: async () => {
    try {
      const embeddingModel = new LlamaCppEmbeddingModel(embeddingModelConfig);
      const { embeddings } = await embeddingModel.doEmbed({ values: ["content"] });

      const results = await contentVectorStore.query({
        indexName: CONTENT_INDEX_NAME,
        queryVector: embeddings[0],
        topK: 1000,
      });

      const documentsById = new Map<
        string,
        {
          documentId: string;
          title: string;
          sourceFile: string;
          sourceLink: string;
          section: string;
          dateCreated: string;
          dateModified: string;
          dateUpdated: string;
        }
      >();

      for (const result of results) {
        const documentId = String(result.metadata?.documentId ?? "");
        if (!documentId || documentsById.has(documentId)) {
          continue;
        }

        documentsById.set(documentId, {
          documentId,
          title: String(result.metadata?.title ?? "Untitled"),
          sourceFile: String(result.metadata?.sourceFile ?? ""),
          sourceLink: String(result.metadata?.sourceLink ?? ""),
          section: String(result.metadata?.section ?? "content"),
          dateCreated: String(result.metadata?.dateCreated ?? ""),
          dateModified: String(result.metadata?.dateModified ?? ""),
          dateUpdated: String(result.metadata?.dateUpdated ?? ""),
        });
      }

      const documents = Array.from(documentsById.values()).sort(
        (a, b) => compareDatesDesc(a.dateUpdated, b.dateUpdated) || a.sourceFile.localeCompare(b.sourceFile),
      );

      if (documents.length === 0) {
        return {
          documents: [],
          count: 0,
          message: "No content indexed yet. Run the index-markdown-content workflow first.",
        };
      }

      return {
        documents,
        count: documents.length,
      };
    } catch {
      return {
        documents: [],
        count: 0,
        message: "Could not read indexed content. Ensure the index exists and embedding server is running.",
      };
    }
  },
});

const compareDatesDesc = (a: string, b: string) => {
  const aTime = Date.parse(`${a}T00:00:00Z`);
  const bTime = Date.parse(`${b}T00:00:00Z`);

  const normalizedATime = Number.isNaN(aTime) ? 0 : aTime;
  const normalizedBTime = Number.isNaN(bTime) ? 0 : bTime;

  return normalizedBTime - normalizedATime;
};
