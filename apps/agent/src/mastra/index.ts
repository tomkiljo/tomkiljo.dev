import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { MASTRA_DB_URL } from "./config";
import { contentChatAgent } from "./agents/content-chat-agent";
import { contentVectorStore } from "./lib/vector-store";
import { indexMarkdownContentWorkflow } from "./workflows/index-markdown-content";
import { DefaultExporter, Observability } from "@mastra/observability";
import serverinfo from "./routes/serverinfo";

export const mastra = new Mastra({
  agents: {
    contentChatAgent,
  },
  workflows: {
    indexMarkdownContentWorkflow,
  },
  vectors: {
    contentVectorStore,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: MASTRA_DB_URL,
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra-agent",
        exporters: [new DefaultExporter()],
      }
    }
  }),
  server: {
    apiRoutes: [serverinfo],
  },
});
