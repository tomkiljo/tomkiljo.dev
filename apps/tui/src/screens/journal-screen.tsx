import { useKeyboard } from "@opentui/react";
import { SyntaxStyle, RGBA, type ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJournalEntries } from "../lib/journal";
import Navbar from "../components/navbar";

const syntaxStyle = SyntaxStyle.fromStyles({
  // Base text
  default: { fg: RGBA.fromHex("#ffffff") },

  // Headings
  "markup.heading.1": { fg: RGBA.fromHex("#ff6ac1"), bold: true },
  "markup.heading.2": { fg: RGBA.fromHex("#57c7ff"), bold: true },
  "markup.heading.3": { fg: RGBA.fromHex("#b48ead"), bold: true },
  "markup.heading.4": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading.5": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading.6": { fg: RGBA.fromHex("#9b8fca"), bold: true },
  "markup.heading": { fg: RGBA.fromHex("#9b8fca"), bold: true },

  // Inline formatting
  "markup.strong": { bold: true },
  "markup.italic": { italic: true },
  "markup.strikethrough": { dim: true },

  // Code
  "markup.raw": { fg: RGBA.fromHex("#ff5c57"), bg: RGBA.fromHex("#2a1a1a") },
  "markup.raw.block": { fg: RGBA.fromHex("#ff5c57") },

  // Blockquote
  "markup.quote": { fg: RGBA.fromHex("#4ec9b0"), italic: true },
  "punctuation.special": { fg: RGBA.fromHex("#6272a4"), dim: true },

  // Links
  "markup.link": { fg: RGBA.fromHex("#58a6ff") },
  "markup.link.label": { fg: RGBA.fromHex("#58a6ff"), underline: true },
  "markup.link.url": { fg: RGBA.fromHex("#6272a4"), dim: true },

  // Lists
  "markup.list": { fg: RGBA.fromHex("#f1fa8c") },
  "markup.list.checked": { fg: RGBA.fromHex("#5af78e") },
  "markup.list.unchecked": { fg: RGBA.fromHex("#6272a4") },

  // Code syntax — keywords, strings, etc.
  keyword: { fg: RGBA.fromHex("#ff79c6"), bold: true },
  string: { fg: RGBA.fromHex("#50fa7b") },
  "string.escape": { fg: RGBA.fromHex("#ffb86c") },
  comment: { fg: RGBA.fromHex("#6272a4"), italic: true },
  number: { fg: RGBA.fromHex("#bd93f9") },
  boolean: { fg: RGBA.fromHex("#bd93f9") },
  type: { fg: RGBA.fromHex("#8be9fd") },
  "type.builtin": { fg: RGBA.fromHex("#8be9fd"), bold: true },
  function: { fg: RGBA.fromHex("#f1fa8c") },
  "function.call": { fg: RGBA.fromHex("#f1fa8c") },
  variable: { fg: RGBA.fromHex("#f8f8f2") },
  "variable.builtin": { fg: RGBA.fromHex("#ff79c6") },
  "variable.member": { fg: RGBA.fromHex("#8be9fd") },
  operator: { fg: RGBA.fromHex("#ff79c6") },
  "punctuation.bracket": { fg: RGBA.fromHex("#cfd2d6") },
  "punctuation.delimiter": { fg: RGBA.fromHex("#cfd2d6") },
  constant: { fg: RGBA.fromHex("#bd93f9") },
  "constant.builtin": { fg: RGBA.fromHex("#bd93f9"), bold: true },
  label: { fg: RGBA.fromHex("#6272a4"), italic: true },
});

function formatEntryDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function JournalScreen() {
  const entries = useMemo(() => getJournalEntries(), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const contentScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const activeEntry = entries[activeIndex];

  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.verticalScrollBar.visible = true;
    }
  }, []);

  useEffect(() => {
    contentScrollRef.current?.scrollTo(0);
  }, [activeIndex]);

  useKeyboard((key) => {
    if (key.name === "pageup") {
      contentScrollRef.current?.scrollBy(-1, "viewport");
      return;
    }
    if (key.name === "pagedown") {
      contentScrollRef.current?.scrollBy(1, "viewport");
      return;
    }
    if (key.name === "up") {
      contentScrollRef.current?.scrollBy(-1, "step");
      return;
    }
    if (key.name === "down") {
      contentScrollRef.current?.scrollBy(1, "step");
      return;
    }
    if (key.name === "left") {
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (key.name === "right") {
      setActiveIndex((current) => Math.min(current + 1, Math.max(entries.length - 1, 0)));
    }
  });

  if (!activeEntry) {
    return (
      <>
        <box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1} gap={1}>
          <text>
            <span fg="cyan">Journal</span>
          </text>
          <text>No journal entries found.</text>
          <text>Add markdown files under src/content/journal with front matter.</text>
        </box>
        <Navbar />
      </>
    );
  }

  return (
    <>
      <box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1} gap={1}>
        <box flexDirection="row" flexGrow={1} gap={1}>
          <box flexDirection="column" flexShrink={0} paddingRight={2} border={["right"]} borderColor="cyan" gap={1}>
            {entries.map((entry, index) => {
              const active = index === activeIndex;
              return (
                <box key={entry.slug} flexDirection="column">
                  <text>
                    <span fg={active ? "cyan" : "gray"}>{active ? "▶ " : "  "}</span>
                    <span fg={active ? "cyan" : "gray"}>{entry.title}</span>
                  </text>
                  <text>
                    <span fg="gray">{"  "}</span>
                    <span fg={active ? "white" : "gray"}>{entry.date}</span>
                  </text>
                </box>
              );
            })}
          </box>
          <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} gap={1}>
            <box
              flexDirection="column"
              flexShrink={0}
              border={["bottom"]}
              borderColor="gray"
              paddingBottom={1}
              gap={0}
            >
              <text fg="cyan">{activeEntry.title}</text>
              <text fg="gray">{formatEntryDate(activeEntry.date)}</text>
            </box>
            <scrollbox ref={contentScrollRef} flexGrow={1} scrollY>
              <markdown
                key={activeEntry.slug}
                content={activeEntry.body}
                syntaxStyle={syntaxStyle}
                conceal
              />
            </scrollbox>
          </box>
        </box>
        <Navbar>
          <text fg="white">
            ←/→: <span fg="gray">prev/next</span>
          </text>
          <text fg="white">
            ↑/↓: <span fg="gray">scroll</span>
          </text>
        </Navbar>
      </box>
    </>
  );
}

export default JournalScreen;
