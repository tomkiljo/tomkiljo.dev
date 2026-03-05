import { useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { askLlmStream, isLlmOnline } from "../lib/ask-llm";
import Navbar from "../components/navbar";
import { PANEL_BG_COLOR } from "../lib/ui-constants";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

function AskScreen() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [llmOnline, setLlmOnline] = useState(false);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo(scrollRef.current.scrollHeight);
  }, [messages, isLoading]);

  useEffect(() => {
    let disposed = false;

    const refreshStatus = async () => {
      const online = await isLlmOnline();
      if (!disposed) {
        setLlmOnline(online);
      }
    };

    void refreshStatus();
    const interval = setInterval(() => {
      void refreshStatus();
    }, 10_000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: nextId.current++, role: "user", text: trimmed };
    const assistantId = nextId.current++;
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsLoading(true);

    try {
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
      await askLlmStream(trimmed, {
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    text: `${message.text}${delta}`,
                  }
                : message
            )
          );
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== assistantId),
        { id: assistantId, role: "assistant", text: `Error: ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      {/* Message thread */}
      <scrollbox ref={scrollRef} flexGrow={1} scrollY stickyScroll stickyStart="bottom">
        {messages.length === 0 && (
          <box paddingLeft={3}>
            <text fg="gray">No messages yet. Ask local llama.cpp anything below.</text>
          </box>
        )}
        {messages.map((msg, index) =>
          msg.role === "user" ? (
            <box
              key={msg.id}
              border={["left"]}
              borderColor="cyan"
              marginTop={index === 0 ? 0 : 1}
            >
              <box paddingTop={1} paddingBottom={1} paddingLeft={2}>
                <text fg="white">{msg.text}</text>
              </box>
            </box>
          ) : (
            <box
              key={msg.id}
              paddingLeft={3}
              paddingTop={1}
              flexShrink={0}
              flexDirection="column"
            >
              <text fg="white">{msg.text}</text>
              <text marginTop={1}>
                <span fg="cyan">▣ </span>
                <span fg="gray">llama.cpp</span>
              </text>
            </box>
          )
        )}
        {isLoading && (
          <box paddingLeft={3} paddingTop={1}>
            <text fg="gray">Streaming response...</text>
          </box>
        )}
      </scrollbox>

      <box flexShrink={0}>
        <box border={["left"]} borderColor="cyan">
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            flexShrink={0}
            flexGrow={1}
            backgroundColor={PANEL_BG_COLOR}
          >
            <input
              focused
              value={question}
              placeholder="Ask anything..."
              onInput={setQuestion}
              onSubmit={() => {
                void handleAsk();
              }}
            />
            <box flexDirection="row" flexShrink={0} paddingTop={1} gap={1}>
              <text fg="cyan">Ask </text>
              <text fg="gray">llama.cpp</text>
            </box>
            <text paddingTop={1} fg="gray">
              Status:{" "}
              <span fg={llmOnline ? "green" : "gray"}>{llmOnline ? "online" : "offline"}</span>
            </text>
          </box>
        </box>
      </box>
      <Navbar>
        <text fg="white">
          enter <span fg="gray">submit</span>
        </text>
      </Navbar>
    </box>
  );
}

export default AskScreen;
