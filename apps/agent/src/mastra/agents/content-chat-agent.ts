import { Agent } from "@mastra/core/agent";
import { llmModelConfig } from "../config";
import { ragProcessor } from "../processors/rag-processor";
import { Memory } from "@mastra/memory";

export const contentChatAgent = new Agent({
  id: "content-chat-agent",
  name: "Content Chat",
  instructions: `You are an assistant that answers questions about Tom's notes and content. Answer based on the context provided. If no relevant context is provided, say you don't have that information.`,
  memory: new Memory(),
  model: llmModelConfig,
  tools: {},
  workflows: {},
  inputProcessors: [ragProcessor],
  outputProcessors: [ragProcessor],
});
