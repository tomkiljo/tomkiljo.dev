export type MarkdownInlineToken =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type MarkdownBlock =
  | { type: "heading"; level: number; inlines: MarkdownInlineToken[] }
  | { type: "paragraph"; inlines: MarkdownInlineToken[] }
  | { type: "list-item"; ordered: boolean; index?: number; inlines: MarkdownInlineToken[] }
  | { type: "blockquote"; inlines: MarkdownInlineToken[] }
  | { type: "code"; code: string }
  | { type: "hr" }
  | { type: "blank" };

const INLINE_PATTERNS = [
  {
    type: "link" as const,
    regex: /\[([^\]]+)\]\(([^)\s]+)\)/,
  },
  {
    type: "code" as const,
    regex: /`([^`]+)`/,
  },
  {
    type: "strong" as const,
    regex: /\*\*([^*]+)\*\*/,
  },
  {
    type: "em" as const,
    regex: /\*([^*]+)\*/,
  },
];

export function formatMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", code: codeLines.join("\n") });
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }

      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      blocks.push({ type: "blank" });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        inlines: formatMarkdownInline(headingMatch[2]),
      });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);

    if (quoteMatch) {
      blocks.push({
        type: "blockquote",
        inlines: formatMarkdownInline(quoteMatch[1]),
      });
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (orderedMatch) {
      blocks.push({
        type: "list-item",
        ordered: true,
        index: Number(orderedMatch[1]),
        inlines: formatMarkdownInline(orderedMatch[2]),
      });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (unorderedMatch) {
      blocks.push({
        type: "list-item",
        ordered: false,
        inlines: formatMarkdownInline(unorderedMatch[1]),
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      inlines: formatMarkdownInline(line),
    });
  }

  if (inCodeBlock) {
    blocks.push({ type: "code", code: codeLines.join("\n") });
  }

  return blocks;
}

function formatMarkdownInline(text: string): MarkdownInlineToken[] {
  if (text.length === 0) {
    return [{ type: "text", text: "" }];
  }

  const tokens: MarkdownInlineToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestMatch: {
      index: number;
      match: RegExpMatchArray;
      type: (typeof INLINE_PATTERNS)[number]["type"];
    } | null = null;

    for (const pattern of INLINE_PATTERNS) {
      const match = remaining.match(pattern.regex);

      if (!match || match.index === undefined) {
        continue;
      }

      if (!earliestMatch || match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          match,
          type: pattern.type,
        };
      }
    }

    if (!earliestMatch) {
      tokens.push({ type: "text", text: remaining });
      break;
    }

    if (earliestMatch.index > 0) {
      tokens.push({
        type: "text",
        text: remaining.slice(0, earliestMatch.index),
      });
    }

    const [fullMatch, firstGroup, secondGroup] = earliestMatch.match;

    if (earliestMatch.type === "link") {
      tokens.push({
        type: "link",
        text: firstGroup,
        href: secondGroup,
      });
    } else {
      tokens.push({
        type: earliestMatch.type,
        text: firstGroup,
      });
    }

    remaining = remaining.slice(earliestMatch.index + fullMatch.length);
  }

  return tokens;
}