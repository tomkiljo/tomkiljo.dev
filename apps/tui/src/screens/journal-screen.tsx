import { useKeyboard } from "@opentui/react";
import { type ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJournalEntries } from "../lib/journal";
import Navbar from "../components/navbar";
import { syntaxStyle } from "../lib/markdown";

function formatEntryDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

type JournalScreenProps = {
  initialSlug?: string;
};

function JournalScreen({ initialSlug }: JournalScreenProps) {
  const entries = useMemo(() => getJournalEntries(), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const contentScrollRef = useRef<ScrollBoxRenderable | null>(null);
  const activeEntry = entries[activeIndex];

  useEffect(() => {
    if (!initialSlug) {
      return;
    }

    const requestedIndex = entries.findIndex((entry) => entry.slug === initialSlug);
    if (requestedIndex >= 0) {
      setActiveIndex(requestedIndex);
    }
  }, [entries, initialSlug]);

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
          <text>Add markdown files under packages/content/journal with front matter.</text>
        </box>
        <Navbar />
      </>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} paddingX={2} paddingY={1} gap={1}>
      <box flexDirection="row" flexGrow={1} minHeight={0} gap={1}>
        <box
          flexDirection="column"
          flexShrink={0}
          paddingRight={2}
          border={["right"]}
          borderColor="cyan"
          gap={1}
        >
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
                  <span fg={active ? "white" : "gray"}>{entry.dateUpdated}</span>
                </text>
              </box>
            );
          })}
        </box>
        <box
          flexDirection="column"
          flexGrow={2}
          minHeight={0}
          paddingLeft={1}
          paddingRight={1}
          gap={1}
        >
          <box
            flexDirection="column"
            flexShrink={0}
            border={["bottom"]}
            borderColor="gray"
            paddingBottom={1}
            gap={0}
          >
            <text fg="cyan">{activeEntry.title}</text>
            <text fg="gray">Created: {formatEntryDate(activeEntry.dateCreated)}</text>
            <text fg="gray">Updated: {formatEntryDate(activeEntry.dateUpdated)}</text>
          </box>
          <scrollbox ref={contentScrollRef} flexGrow={1} minHeight={0} scrollY>
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
  );
}

export default JournalScreen;
