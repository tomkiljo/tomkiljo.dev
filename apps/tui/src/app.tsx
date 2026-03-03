import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { getSystemInfo } from "./lib/system-info";
import Link from "./components/link";
import { formatDateTime } from "./lib/format";

type AppProps = {
  onQuit: () => void;
};

const banner = [
  " ████████╗ ██████╗ ███╗   ███╗    ██╗  ██╗██╗██╗      ██╗ ██████╗ ",
  "    ██╔══╝██╔═══██╗████╗ ████║    ██║ ██╔╝██║██║      ██║██╔═══██╗",
  "    ██║   ██║   ██║██╔████╔██║    █████╔╝ ██║██║      ██║██║   ██║",
  "    ██║   ██║   ██║██║╚██╔╝██║    ██╔═██╗ ██║██║   ██ ██║██║   ██║",
  "    ██║   ╚██████╔╝██║ ╚═╝ ██║    ██║  ██╗██║█████╗╚███╔╝╚██████╔╝",
  "    ╚═╝    ╚═════╝ ╚═╝     ╚═╝    ╚═╝  ╚═╝╚═╝╚════╝ ╚══╝  ╚═════╝ ",
];

function App({ onQuit }: AppProps) {
  useKeyboard((key) => {
    if (key.name === "q") {
      onQuit();
    }
  });

  const [systemInfo, setSystemInfo] = useState(() => getSystemInfo());

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemInfo(getSystemInfo());
    }, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <box height="100%" flexDirection="column" justifyContent="space-between">
      <box flexDirection="column">
        <text>{`Last login: ${formatDateTime(new Date())} from 10.0.0.42`}</text>
        <text> </text>
        {banner.map((line, index) => (
          <text key={`banner-${index}`}>
            <span fg="magenta">{line}</span>
          </text>
        ))}
        <text> </text>
        <text>Welcome to tom's personal terminal</text>
        <text> </text>
        <text><span fg="violet">✔</span> Full-spectrum developer and developer experience enthusiast</text>
        <text><span fg="violet">✔</span> Mainly focusing on platforms, backends, devops tooling</text>
        <text><span fg="violet">✔</span> Principal Software Architect at <Link href="https://nitor.com"/></text>
        <text> </text>
        <text>Getting in touch</text>
        <text> </text>
        <text><span fg="cyan">➔ Github:</span> <Link href="https://github.com/tomkiljo"/></text>
        <text><span fg="cyan">➔ LinkedIn:</span> <Link href="https://linkedin.com/in/tomkiljo"/></text>
        <text><span fg="cyan">➔ Email:</span> <Link href="mailto:hi@tomkiljo.dev">hi@tomkiljo.dev</Link></text>
        <text> </text>
        <text>System information as of {formatDateTime(systemInfo.timestamp)}</text>
        <text> </text>
        <text><span fg="green">●</span> Runtime: {systemInfo.runtime} | Uptime: {systemInfo.uptime}</text>
        <text><span fg="green">●</span> CPU count: {systemInfo.cpuCount} | Memory usage: {systemInfo.memoryUsage}% of {systemInfo.memoryTotalGb}</text>
        <text><span fg="yellow">●</span> LLM agent: <span fg="yellow">offline</span></text>
      </box>
      <text>q: quit</text>
    </box>
  );
}

export default App;