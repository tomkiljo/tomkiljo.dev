import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  CONTENT_ROOT,
  EMBEDDING_DIMENSION,
  embeddingModelConfig,
} from "../config";
import { contentVectorStore, CONTENT_INDEX_NAME } from "../lib/vector-store";
import { LlamaCppEmbeddingModel } from "../lib/llamacpp";

const sourceDocumentSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  sourceFile: z.string(),
  sourceLink: z.string(),
  section: z.string(),
  content: z.string(),
});

const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  metadata: z.record(z.string(), z.any()),
});

const scanMarkdownStep = createStep({
  id: "scan-markdown-content",
  description: "Load markdown files from packages/content and normalize source metadata",
  inputSchema: z
    .object({
      contentRoot: z.string().optional(),
    })
    .optional(),
  outputSchema: z.object({
    contentRoot: z.string(),
    purgeDocumentIds: z.array(z.string()),
    documents: z.array(sourceDocumentSchema),
  }),
  execute: async ({ inputData }) => {
    const contentRoot = path.resolve(inputData?.contentRoot ?? CONTENT_ROOT);
    const files = await collectMarkdownFiles(contentRoot);

    const documents: z.infer<typeof sourceDocumentSchema>[] = [];
    const purgeDocumentIds: string[] = [];

    for (const filePath of files) {
      const fileContents = await readFile(filePath, "utf-8");
      const parsed = parseFrontmatter(fileContents);
      const normalizedSourceFile = normalizeSlashes(path.relative(contentRoot, filePath));
      const section = normalizedSourceFile.split("/")[0] ?? "content";
      const basename = path.basename(filePath, ".md");
      const slug = parsed.frontmatter.slug ?? slugFromBasename(basename);
      const sourceLink = parsed.frontmatter.link ?? `/${section}/${slug}`;
      const title = parsed.frontmatter.title ?? humanizeTitle(basename);
      const documentId = `md-${createHash("sha256").update(normalizedSourceFile).digest("hex").slice(0, 16)}`;

      purgeDocumentIds.push(documentId);
      if (shouldSkipIndexing(parsed.frontmatter)) {
        continue;
      }

      documents.push({
        documentId,
        title,
        sourceFile: normalizedSourceFile,
        sourceLink,
        section,
        content: parsed.content,
      });
    }

    return {
      contentRoot,
      purgeDocumentIds,
      documents,
    };
  },
});

const chunkMarkdownStep = createStep({
  id: "chunk-markdown-content",
  description: "Chunk markdown content into overlapping blocks for retrieval",
  inputSchema: z.object({
    contentRoot: z.string(),
    purgeDocumentIds: z.array(z.string()),
    documents: z.array(sourceDocumentSchema),
  }),
  outputSchema: z.object({
    contentRoot: z.string(),
    purgeDocumentIds: z.array(z.string()),
    documentIds: z.array(z.string()),
    chunks: z.array(chunkSchema),
  }),
  execute: async ({ inputData }) => {
    const chunks = inputData.documents.flatMap(document => {
      const parts = chunkText(document.content);
      return parts.map((text, index) => {
        const chunkId = `${document.documentId}:${String(index + 1).padStart(4, "0")}`;
        return {
          id: chunkId,
          text,
          metadata: {
            ...document,
            chunkIndex: index,
            totalChunks: parts.length,
          },
        };
      });
    });

    return {
      contentRoot: inputData.contentRoot,
      purgeDocumentIds: inputData.purgeDocumentIds,
      documentIds: inputData.documents.map(document => document.documentId),
      chunks,
    };
  },
});

const storeEmbeddingsStep = createStep({
  id: "store-markdown-embeddings",
  description: "Generate embeddings with local model and store in LibSQL vector index",
  inputSchema: z.object({
    contentRoot: z.string(),
    purgeDocumentIds: z.array(z.string()),
    documentIds: z.array(z.string()),
    chunks: z.array(chunkSchema),
  }),
  outputSchema: z.object({
    contentRoot: z.string(),
    indexedDocuments: z.number(),
    indexedChunks: z.number(),
    indexName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const existingIndexes = await contentVectorStore.listIndexes();
    if (!existingIndexes.includes(CONTENT_INDEX_NAME)) {
      await contentVectorStore.createIndex({
        indexName: CONTENT_INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
        metric: "cosine",
      });
    }

    for (const documentId of inputData.purgeDocumentIds) {
      try {
        await contentVectorStore.deleteVectors({
          indexName: CONTENT_INDEX_NAME,
          filter: { documentId },
        });
      } catch {
        // Document may not have existing vectors yet.
      }
    }

    if (inputData.chunks.length === 0) {
      return {
        contentRoot: inputData.contentRoot,
        indexedDocuments: inputData.documentIds.length,
        indexedChunks: 0,
        indexName: CONTENT_INDEX_NAME,
      };
    }

    const embeddingModel = new LlamaCppEmbeddingModel(embeddingModelConfig);

    const vectors: number[][] = [];
    const texts = inputData.chunks.map(chunk => chunk.text);
    const batchSize = 128;

    for (let startIndex = 0; startIndex < texts.length; startIndex += batchSize) {
      const batch = texts.slice(startIndex, startIndex + batchSize);
      const { embeddings } = await embeddingModel.doEmbed({ values: batch });
      vectors.push(...embeddings);
    }

    await contentVectorStore.upsert({
      indexName: CONTENT_INDEX_NAME,
      ids: inputData.chunks.map(chunk => chunk.id),
      vectors,
      metadata: inputData.chunks.map(chunk => ({ text: chunk.text, ...chunk.metadata })),
    });

    return {
      contentRoot: inputData.contentRoot,
      indexedDocuments: inputData.documentIds.length,
      indexedChunks: inputData.chunks.length,
      indexName: CONTENT_INDEX_NAME,
    };
  },
});

export const indexMarkdownContentWorkflow = createWorkflow({
  id: "index-markdown-content",
  description: "Index markdown files from packages/content for semantic retrieval",
  inputSchema: z
    .object({
      contentRoot: z.string().optional(),
    })
    .optional(),
  outputSchema: z.object({
    contentRoot: z.string(),
    indexedDocuments: z.number(),
    indexedChunks: z.number(),
    indexName: z.string(),
  }),
})
  .then(scanMarkdownStep)
  .then(chunkMarkdownStep)
  .then(storeEmbeddingsStep);

indexMarkdownContentWorkflow.commit();

const normalizeSlashes = (value: string) => value.split(path.sep).join("/");

const FRONTMATTER_BLOCK_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

const parseFrontmatter = (raw: string) => {
  const frontmatter: Record<string, string> = {};
  const match = raw.match(FRONTMATTER_BLOCK_PATTERN);

  if (!match) {
    return { frontmatter, content: raw.trim() };
  }

  const block = match[1] ?? "";
  for (const line of block.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "");

    if (key) {
      frontmatter[key] = value;
    }
  }

  const content = raw.slice(match[0].length).trim();
  return { frontmatter, content };
};

const shouldSkipIndexing = (frontmatter: Record<string, string>) => {
  const skipValue = frontmatter.skipIndexing ?? frontmatter.skip_indexing;
  if (!skipValue) {
    return false;
  }

  return ["true", "1", "yes", "on"].includes(skipValue.trim().toLowerCase());
};

const chunkText = (text: string, maxChars = 1200) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return [];
  }

  const sections = splitMarkdownSections(normalizedText);

  const chunks: string[] = [];
  for (const section of sections) {
    const sectionChunks = chunkMarkdownSection(section, maxChars);
    chunks.push(...sectionChunks);
  }

  return chunks;
};

const splitMarkdownSections = (text: string) => {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const pushCurrent = () => {
    const value = current.join("\n").trim();
    if (value) {
      sections.push(value);
    }
    current = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
    }

    const isHeading = !inFence && /^#{1,6}\s+/.test(line);
    if (isHeading && current.length > 0) {
      pushCurrent();
    }

    current.push(line);
  }

  pushCurrent();

  return sections;
};

const chunkMarkdownSection = (section: string, maxChars: number) => {
  if (section.length <= maxChars) {
    return [section];
  }

  const blocks = splitMarkdownBlocks(section);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const value = current.trim();
    if (value) {
      chunks.push(value);
    }
    current = "";
  };

  for (const block of blocks) {
    if (!current) {
      if (block.length > maxChars) {
        chunks.push(block);
      } else {
        current = block;
      }
      continue;
    }

    const candidate = `${current}\n\n${block}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    pushCurrent();
    if (block.length > maxChars) {
      chunks.push(block);
    } else {
      current = block;
    }
  }

  pushCurrent();

  return chunks;
};

const splitMarkdownBlocks = (text: string) => {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const pushCurrent = () => {
    const value = current.join("\n").trim();
    if (value) {
      blocks.push(value);
    }
    current = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      current.push(line);
      continue;
    }

    if (!inFence && line.trim() === "") {
      pushCurrent();
      continue;
    }

    current.push(line);
  }

  pushCurrent();

  return blocks;
};

const slugFromBasename = (basename: string) =>
  basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const humanizeTitle = (basename: string) => {
  const parts = basename.replace(/\.[^.]+$/, "").split(/[-_]+/g).filter(Boolean);
  if (parts.length === 0) {
    return "Untitled";
  }

  return parts
    .map(part => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
};

const collectMarkdownFiles = async (rootDir: string): Promise<string[]> => {
  const dirEntries = await readdir(rootDir, { withFileTypes: true });

  const nested = await Promise.all(
    dirEntries.map(async entry => {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectMarkdownFiles(fullPath);
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [fullPath];
      }

      return [];
    }),
  );

  return nested.flat();
};
