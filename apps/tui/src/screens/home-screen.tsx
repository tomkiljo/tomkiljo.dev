import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import Link from "../components/link";
import Navbar from "../components/navbar";
import type { AgentServerInfo } from "../lib/agent";
import type { SystemInfo } from "../lib/system-info";
import { PANEL_BG_COLOR } from "../lib/ui-constants";

type HomeScreenProps = {
  systemInfo: SystemInfo;
  llmOnline: boolean;
  agentSystemInfo: AgentServerInfo | null;
  onOpenAsk: () => void;
  onOpenJournal: () => void;
  onOpenCv: () => void;
};

function HomeScreen({
  systemInfo,
  llmOnline,
  agentSystemInfo,
  onOpenAsk,
  onOpenJournal,
  onOpenCv,
}: HomeScreenProps) {
  const menuItems = useMemo(
    () => [
      { label: "Ask", shortcut: "ctrl+a", action: onOpenAsk },
      { label: "Journal", shortcut: "ctrl+d", action: onOpenJournal },
      { label: "CV", shortcut: "<open entry>", action: onOpenCv },
    ],
    [onOpenAsk, onOpenCv, onOpenJournal]
  );

  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  const activateItem = (index: number) => {
    menuItems[index]?.action();
  };

  useKeyboard((key) => {
    const consume = () => {
      key.preventDefault();
      key.stopPropagation();
    };
    if (key.name === "up") {
      consume();
      setSelectedMenuIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (key.name === "down") {
      consume();
      setSelectedMenuIndex((current) => Math.min(current + 1, menuItems.length - 1));
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      consume();
      activateItem(selectedMenuIndex);
    }
  });

  return (
    <box flexDirection="column" flexGrow={1} flexShrink={0} paddingX={2} paddingY={1} gap={1}>
      <box flexDirection="row" flexGrow={1} gap={2}>
        <box flexDirection="column" flexGrow={2} gap={1}>
          <ascii-font font="tiny" text="TOM KILJO" color="magenta" paddingTop={1} />
          <text fg="gray">Welcome to my personal terminal</text>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>
              <b>Profile</b>
            </text>
            <text>
              <span fg="magenta">◈</span> Full-spectrum developer and devx enthusiast
            </text>
            <text>
              <span fg="magenta">◈</span> Focusing on platform building, backends, devops tooling
            </text>
            <text>
              <span fg="magenta">◈</span> Principal Software Architect at{" "}
              <Link href="https://nitor.com" />
            </text>
          </box>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>
              <b>Get in touch</b>
            </text>
            <text>
              <span fg="cyan">→</span> Github: <Link href="https://github.com/tomkiljo" />
            </text>
            <text>
              <span fg="cyan">→</span> LinkedIn: <Link href="https://linkedin.com/in/tomkiljo" />
            </text>
            <text>
              <span fg="cyan">→</span> Email:{" "}
              <Link href="mailto:hi@tomkiljo.dev">hi@tomkiljo.dev</Link>
            </text>
          </box>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>
              <b>Explore</b>
            </text>
            <box flexDirection="column">
              {menuItems.map((item, index) => {
                const active = index === selectedMenuIndex;
                return (
                  <box
                    key={item.label}
                    flexDirection="row"
                    justifyContent="space-between"
                    onMouseOver={() => {
                      setSelectedMenuIndex(index);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedMenuIndex(index);
                      activateItem(index);
                    }}
                    backgroundColor={active ? "magenta" : undefined}
                    paddingX={2}
                  >
                    <text fg={active ? "black" : "white"}>{item.label}</text>
                    <text fg={active ? "black" : "gray"}>{item.shortcut}</text>
                  </box>
                );
              })}
            </box>
          </box>
        </box>
        <box
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          gap={1}
          backgroundColor={PANEL_BG_COLOR}
        >
          <text fg="cyan">
            <b>System information</b>
          </text>
          <box flexDirection="column">
            <text>
              <span fg="green">●</span> Runtime: {systemInfo.runtime}
            </text>
            <text>
              <span fg="green">●</span> Uptime: {systemInfo.uptime}
            </text>
            <text>
              <span fg="green">●</span> CPU count: {systemInfo.cpuCount}
            </text>
            <text>
              <span fg="green">●</span> Memory usage: {systemInfo.memoryUsage}% of{" "}
              {systemInfo.memoryTotalGb}
            </text>
          </box>
          <text fg="cyan">
            <b>Agent information</b>
          </text>
          <box flexDirection="column">
            {agentSystemInfo ? (
              <>
                <text>
                  <span fg="green">●</span> Runtime: {agentSystemInfo.runtime}
                </text>
                <text>
                  <span fg="green">●</span> Uptime: {agentSystemInfo.uptime}
                </text>
                <text>
                  <span fg="green">●</span> CPU count: {agentSystemInfo.cpuCount}
                </text>
                <text>
                  <span fg="green">●</span> Memory usage: {agentSystemInfo.memoryUsage}% of{" "}
                  {agentSystemInfo.memoryTotalGb}
                </text>
              </>
            ) : (
              <text>
                <span fg="gray">●</span> Agent status: <span fg="gray">unreachable</span>
              </text>
            )}
          </box>
        </box>
      </box>
      <Navbar>
        <text fg="white">
          ↑/↓: <span fg="gray">select</span>
        </text>
        <text fg="white">
          enter: <span fg="gray">open</span>
        </text>
      </Navbar>
    </box>
  );
}

export default HomeScreen;
