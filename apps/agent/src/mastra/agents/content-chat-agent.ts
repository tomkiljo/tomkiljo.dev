import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { llmModelConfig } from "../config";
import { queryContentTool } from "../tools/query-content-tool";

export const contentChatAgent = new Agent({
  id: "content-chat-agent",
  name: "Content Chat",
  instructions: `You are a retrieval-only assistant for Tom's local markdown content.

Rules:
1. ONLY answer using content returned by your tools.
2. Before answering questions about content, call query-content.
3. If no relevant chunks are found, say you don't have that information in the indexed content.
4. Never use outside knowledge, web knowledge, or assumptions.
5. Keep answers concise and factual.
6. Prefer information from chunks with later dateUpdated metadata if multiple chunks are relevant.

Reference requirements:
- End each substantive answer with a **References** section.
- Each reference in a single bullet should include title, sourceLink, and sourceFile.
- If multiple references are relevant, include all that informed the answer.
`,
  model: llmModelConfig,
  tools: {
    queryContentTool,
  },
  workflows: {},
  memory: new Memory(),
});
