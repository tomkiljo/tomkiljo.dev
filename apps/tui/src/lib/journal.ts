import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export type JournalEntry = {
  slug: string;
  title: string;
  date: string;
  body: string;
};

type FrontMatter = {
  title?: string;
  date?: string;
};

const require = createRequire(import.meta.url);
const JOURNAL_DIR = path.join(path.dirname(require.resolve("content/package.json")), "journal");

const parseFrontMatter = (rawContent: string) => {
  if (!rawContent.startsWith("---\n")) {
    return null;
  }

  const endIndex = rawContent.indexOf("\n---\n", 4);

  if (endIndex === -1) {
    return null;
  }

  const frontMatterSection = rawContent.slice(4, endIndex);
  const body = rawContent.slice(endIndex + 5).trim();
  const frontMatter: FrontMatter = {};

  for (const line of frontMatterSection.split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['\"]|['\"]$/g, "");

    if (key === "title") {
      frontMatter.title = value;
    }

    if (key === "date") {
      frontMatter.date = value;
    }
  }

  return {
    frontMatter,
    body,
  };
};

export const getJournalEntries = (): JournalEntry[] => {
  if (!fs.existsSync(JOURNAL_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(JOURNAL_DIR)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort((a, b) => b.localeCompare(a));

  const entries: JournalEntry[] = [];

  for (const fileName of files) {
    const slug = fileName.replace(/\.md$/, "");
    const filePath = path.join(JOURNAL_DIR, fileName);
    const rawContent = fs.readFileSync(filePath, "utf8");
    const parsed = parseFrontMatter(rawContent);

    if (!parsed) {
      continue;
    }

    if (!parsed.frontMatter.title || !parsed.frontMatter.date) {
      continue;
    }

    entries.push({
      slug,
      title: parsed.frontMatter.title,
      date: parsed.frontMatter.date,
      body: parsed.body,
    });
  }

  return entries;
};
