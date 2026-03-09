import type {
  ProcessInputArgs,
  ProcessInputResult,
  ProcessOutputStepArgs,
  ProcessorMessageResult,
} from "@mastra/core/processors";
import { retrieveContent } from "../lib/retrieve-content";

const NO_CONTEXT_RESPONSE = "I don't have information about this in my notes.";
const NO_CONTEXT_PHRASE = "i don't have information";

const extractUserText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.content === "string") return c.content;
    if (Array.isArray(c.parts)) {
      for (const part of c.parts) {
        if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
          const text = (part as Record<string, unknown>).text;
          if (typeof text === "string") return text;
        }
      }
    }
  }
  return "";
};

export const ragProcessor = {
  id: "rag-processor",

  async processInput({ messages, systemMessages }: ProcessInputArgs): Promise<ProcessInputResult> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const queryText = extractUserText(lastUserMessage?.content);

    if (!queryText) {
      return { messages, systemMessages };
    }

    // Fetch 10 candidates from the vector store, rerank, then keep the top 3 for context injection.
    // Larger initial fetch improves recall; smaller injected count keeps prefill fast.
    const { matches: allMatches } = await retrieveContent(queryText, 10);
    const matches = allMatches.slice(0, 3);

    if (matches.length === 0) {
      return { messages, systemMessages };
    }

    const contextText = matches.map((m) => `--- ${m.title} ---\n${m.chunk}`).join("\n\n");

    const contextMessage = {
      role: "system" as const,
      content: `Use ONLY the excerpts below to answer the question. If the excerpts do not contain the answer, respond with exactly: ${NO_CONTEXT_RESPONSE}\n\n${contextText}`,
    };

    return { messages, systemMessages: [...systemMessages, contextMessage] };
  },

  processOutputStep({ text, abort, messageList }: ProcessOutputStepArgs): ProcessorMessageResult {
    if (text?.toLowerCase().includes(NO_CONTEXT_PHRASE)) {
      abort(NO_CONTEXT_RESPONSE, { retry: false });
    }
    return messageList;
  },
};
