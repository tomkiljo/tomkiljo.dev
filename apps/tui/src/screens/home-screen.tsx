import Link from "../components/link";
import Navbar from "../components/navbar";
import type { SystemInfo } from "../lib/system-info";

type HomeScreenProps = {
  systemInfo: SystemInfo;
  llmOnline: boolean;
};

function HomeScreen({ systemInfo, llmOnline }: HomeScreenProps) {
  return (
    <box flexDirection="column" flexGrow={1} flexShrink={0} paddingX={2} paddingY={1} gap={1}>
      <box flexDirection="row" flexGrow={1} gap={2}>
        <box flexDirection="column" flexGrow={2} gap={1}>
          <ascii-font font="tiny" text="TOM KILJO" color="magenta" paddingTop={1} />
          <text fg="gray">Welcome to my personal terminal</text>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>Profile</text>
            <text><span fg="magenta">◈</span> Full-spectrum developer and developer experience enthusiast</text>
            <text><span fg="magenta">◈</span> Focusing on platform building, backends, devops tooling</text>
            <text><span fg="magenta">◈</span> Principal Software Architect at <Link href="https://nitor.com">https://nitor.com</Link></text>
          </box>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>Microsoft Certified</text>
            <text><span fg="blue">▣</span> Azure Developer Associate</text>
            <text><span fg="blue">▣</span> Azure Administrator Associate</text>
            <text><span fg="yellow">★</span> Azure Solutions Architect Expert</text>
            <text><span fg="blue">▣</span> Azure AI Engineer Associate</text>
            <text><span fg="magenta">✲</span> Azure Cosmos DB Developer Specialty</text>
          </box>
          <box flexDirection="column">
            <text fg="cyan" paddingBottom={1}>Get in touch</text>
            <text><span fg="cyan">→ Github:</span> <Link href="https://github.com/tomkiljo" /></text>
            <text><span fg="cyan">→ LinkedIn:</span> <Link href="https://linkedin.com/in/tomkiljo" /></text>
            <text><span fg="cyan">→ Email:</span> <Link href="mailto:hi@tomkiljo.dev">hi@tomkiljo.dev</Link></text>
          </box>
        </box>
        <box flexDirection="column" paddingX={2} paddingY={1} backgroundColor="#222222">
          <text fg="cyan">System information</text>
          <text> </text>
          <text><span fg="green">●</span> Runtime: {systemInfo.runtime}</text>
          <text><span fg="green">●</span> Uptime: {systemInfo.uptime}</text>
          <text><span fg="green">●</span> CPU count: {systemInfo.cpuCount}</text>
          <text><span fg="green">●</span> Memory usage: {systemInfo.memoryUsage}% of {systemInfo.memoryTotalGb}</text>
          <text>
            <span fg={llmOnline ? "green" : "gray"}>●</span> LLM status:{" "}
            <span fg={llmOnline ? "green" : "gray"}>{llmOnline ? "online" : "offline"}</span>
          </text>
        </box>
      </box>
      <Navbar />
    </box>
  );
}

export default HomeScreen;