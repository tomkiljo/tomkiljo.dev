export type AgentServerInfo = {
  runtime: string;
  cpuCount: string;
  uptime: string;
  memoryUsage: string;
  memoryTotalGb: string;
};

const getAgentConfig = () => {
  const baseUrl = process.env.MASTRA_API_BASE_URL ?? process.env.LLM_API_BASE_URL ?? "http://localhost:4111";
  const agentId = process.env.MASTRA_AGENT_ID ?? "content-chat-agent";

  return {
    baseUrl,
    agentId,
  };
};

const buildMastraApiPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/$/, "");

  if (normalizedBase.endsWith("/api")) {
    return `${normalizedBase}${path}`;
  }

  return `${normalizedBase}/api${path}`;
};

const buildRootPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const rootBase = normalizedBase.endsWith("/api")
    ? normalizedBase.slice(0, -"/api".length)
    : normalizedBase;

  return `${rootBase}${path}`;
};

export const isLlmOnline = async (timeoutMs = 1500) => {
  const { baseUrl, agentId } = getAgentConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(buildMastraApiPath(baseUrl, `/agents/${agentId}`), {
      method: "GET",
      signal: controller.signal,
    });

    if (response.ok) {
      return true;
    }
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }

  return false;
};

export const getAgentSystemInfo = async (timeoutMs = 1500): Promise<AgentServerInfo | null> => {
  const { baseUrl } = getAgentConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(buildRootPath(baseUrl, "/serverinfo"), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Partial<AgentServerInfo>;
    if (
      !payload.runtime ||
      !payload.cpuCount ||
      !payload.uptime ||
      !payload.memoryUsage ||
      !payload.memoryTotalGb
    ) {
      return null;
    }

    return {
      runtime: payload.runtime,
      cpuCount: payload.cpuCount,
      uptime: payload.uptime,
      memoryUsage: payload.memoryUsage,
      memoryTotalGb: payload.memoryTotalGb,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

type AskLlmStreamOptions = {
  onDelta: (delta: string) => void;
};

export const askLlmStream = async (question: string, options: AskLlmStreamOptions) => {
  const { baseUrl, agentId } = getAgentConfig();

  const response = await fetch(buildMastraApiPath(baseUrl, `/agents/${agentId}/generate`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: question,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mastra agent request failed (${response.status}): ${details || "Unknown error"}`);
  }

  const payload = (await response.json()) as {
    text?: string;
    response?: {
      text?: string;
      output?: Array<{ text?: string }>;
    };
  };

  const textFromOutput = payload.response?.output
    ?.map((item) => item?.text)
    .filter((text): text is string => Boolean(text))
    .join("");

  const answer = payload.text ?? payload.response?.text ?? textFromOutput;

  if (!answer) {
    throw new Error("Mastra agent returned no text response.");
  }

  options.onDelta(answer);
};
