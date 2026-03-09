import os from "node:os";

export type SystemInfo = {
  runtime: string;
  cpuCount: string;
  uptime: string;
  memoryUsage: string;
  memoryTotalGb: string;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

export const getSystemInfo = (): SystemInfo => {
  const versions = process.versions as Record<string, string | undefined>;
  const runtimeName = versions.bun ? "Bun" : "Node";
  const runtimeVersion = versions.bun ?? process.versions.node;
  const cpus = os.cpus();
  const cpuCount = `${cpus.length}`;
  const uptime = formatUptime(os.uptime());
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryUsage = `${Math.round(((totalMem - freeMem) / totalMem) * 100)}`;
  const memoryTotalGb = `${(totalMem / 1024 ** 3).toFixed(1)} GB`;

  return {
    runtime: `${runtimeName} ${runtimeVersion}`,
    cpuCount,
    uptime,
    memoryUsage,
    memoryTotalGb,
  };
};

export const getSshSessionCount = async (): Promise<number | null> => {
  const statusUrl = process.env.TUI_SSH_STATUS_URL ?? "http://127.0.0.1:39217/status";

  try {
    const response = await fetch(statusUrl);
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { activeSshSessions?: unknown };
    if (typeof body.activeSshSessions !== "number") {
      return null;
    }

    return body.activeSshSessions;
  } catch {
    return null;
  }
};
