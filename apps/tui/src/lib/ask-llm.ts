type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ChatCompletionStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
};

const getAskConfig = () => {
  const baseUrl = process.env.LLM_API_BASE_URL ?? "http://localhost:8080";
  const model = process.env.LLM_MODEL ?? "local-model";

  return {
    baseUrl,
    model,
  };
};

const buildOpenAiPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/$/, "");

  if (normalizedBase.endsWith("/v1")) {
    return `${normalizedBase}${path}`;
  }

  return `${normalizedBase}/v1${path}`;
};

export const isLlmOnline = async (timeoutMs = 1500) => {
  const { baseUrl } = getAskConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const healthResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    if (healthResponse.ok) {
      return true;
    }
  } catch {
    // ignore and try OpenAI-compatible models endpoint
  } finally {
    clearTimeout(timeout);
  }

  try {
    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => {
      fallbackController.abort();
    }, timeoutMs);

    const modelsResponse = await fetch(buildOpenAiPath(baseUrl, "/models"), {
      method: "GET",
      signal: fallbackController.signal,
    });
    clearTimeout(fallbackTimeout);

    return modelsResponse.ok;
  } catch {
    return false;
  }
};

export const askLlm = async (question: string) => {
  const { baseUrl, model } = getAskConfig();

  const response = await fetch(buildOpenAiPath(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a concise and helpful assistant.",
        },
        {
          role: "user",
          content: question,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${details || "Unknown error"}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("LLM response did not contain any content.");
  }

  return content;
};

type AskLlmStreamOptions = {
  onDelta: (delta: string) => void;
};

export const askLlmStream = async (question: string, options: AskLlmStreamOptions) => {
  const { baseUrl, model } = getAskConfig();

  const response = await fetch(buildOpenAiPath(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content: "You are a concise and helpful assistant. You anwer questions about Tom Kiljo's background, experience and skills based on the information available at https://tomkiljo.dev.",
        },
        {
          role: "user",
          content: question,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${details || "Unknown error"}`);
  }

  if (!response.body) {
    throw new Error("LLM response did not provide a readable stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasContent = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) {
        continue;
      }

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }

      try {
        const chunk = JSON.parse(payload) as ChatCompletionStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          hasContent = true;
          options.onDelta(delta);
        }
      } catch {
        // ignore malformed chunk lines
      }
    }
  }

  const remaining = buffer.trim();
  if (remaining.startsWith("data:")) {
    const payload = remaining.slice(5).trim();
    if (payload && payload !== "[DONE]") {
      try {
        const chunk = JSON.parse(payload) as ChatCompletionStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          hasContent = true;
          options.onDelta(delta);
        }
      } catch {
        // ignore malformed trailing chunk
      }
    }
  }

  if (!hasContent) {
    throw new Error("LLM stream completed without any content.");
  }
};