import { LibSQLVector } from "@mastra/libsql";
import { CONTENT_INDEX_NAME, MASTRA_DB_URL } from "../config";

export const contentVectorStore = new LibSQLVector({
  id: "content-vectors",
  url: MASTRA_DB_URL,
});

export { CONTENT_INDEX_NAME };
