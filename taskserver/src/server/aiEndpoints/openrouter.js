import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { measureExecutionTimeAsync } from "@src/common/perf";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_CONTENT_TYPE = "application/json";
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMessageArrayFromPrompt(prompt) {
  try {
    const parsedPrompt = JSON.parse(prompt);
    if (Array.isArray(parsedPrompt)) {
      return parsedPrompt;
    }
  } catch (error) {
    // ignore parse failures – we'll wrap below
  }

  return [{ role: "system", content: prompt }];
}

async function handleStreamingResponse(response, callback) {
  if (!response.ok || !response.body) {
    const bodyText = await response.text();
    throw new Error(
      `OpenRouter streaming request failed (${response.status}): ${bodyText}`
    );
  }

  const decoder = new TextDecoder("utf-8");
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      await callback("done", null);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");

    // keep the last chunk (possibly incomplete) in the buffer
    buffer = events.pop() ?? "";

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        await callback("done", null);
        return { success: true, data: null, error: null };
      }

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          const continueProcessing = await callback("data", delta);
          if (!continueProcessing) {
            await callback("cancelled", null);
            return { success: true, data: null, error: null };
          }
        }
      } catch (error) {
        console.error("OpenRouter streaming parse error:", error, payload);
      }
    }
  }

  return { success: true, data: null, error: null };
}

function buildOpenRouterHeaders({ apiKey, referer, title }) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": JSON_CONTENT_TYPE,
  };

  if (!nullUndefinedOrEmpty(referer, true)) {
    headers["HTTP-Referer"] = referer;
  }

  if (!nullUndefinedOrEmpty(title, true)) {
    headers["X-Title"] = title;
  }

  return headers;
}

function buildRequestBody({ prompt, llmParameters, stream }) {
  const baseMessages = createMessageArrayFromPrompt(prompt);
  const body = {
    model: llmParameters.model,
    messages: baseMessages,
    stream,
  };

  if (typeof llmParameters.temperature === "number") {
    body.temperature = llmParameters.temperature;
  }

  if (typeof llmParameters.top_p === "number") {
    body.top_p = llmParameters.top_p;
  }

  if (typeof llmParameters.top_k === "number") {
    body.top_k = llmParameters.top_k;
  }

  if (typeof llmParameters.newTokenTarget === "number") {
    body.max_tokens = llmParameters.newTokenTarget;
  }

  if (llmParameters.responseFormat === "json" || llmParameters.outputFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (typeof llmParameters.seed === "number" && llmParameters.seed >= 0) {
    body.seed = llmParameters.seed;
  }

  if (Array.isArray(llmParameters.stopSequences) && llmParameters.stopSequences.length > 0) {
    body.stop = llmParameters.stopSequences;
  }

  return body;
}

function computeRetryDelay(response, attempt) {
  const retryAfter = response.headers?.get?.("retry-after");
  if (!nullUndefinedOrEmpty(retryAfter, true)) {
    const numericDelay = Number(retryAfter);
    if (Number.isFinite(numericDelay) && numericDelay >= 0) {
      return Math.max(500, numericDelay * 1000);
    }
    const retryDate = Date.parse(retryAfter);
    if (!Number.isNaN(retryDate)) {
      const delta = retryDate - Date.now();
      if (delta > 0) {
        return Math.max(500, delta);
      }
    }
  }

  const rateLimitReset = response.headers?.get?.("x-ratelimit-reset");
  if (!nullUndefinedOrEmpty(rateLimitReset, true)) {
    const parsedReset = Number(rateLimitReset);
    if (Number.isFinite(parsedReset)) {
      if (parsedReset > Date.now() / 1000) {
        return Math.max(500, parsedReset * 1000 - Date.now());
      }
      if (parsedReset >= 0 && parsedReset < 600) {
        return Math.max(500, parsedReset * 1000);
      }
    }
    const resetDate = Date.parse(rateLimitReset);
    if (!Number.isNaN(resetDate)) {
      const delta = resetDate - Date.now();
      if (delta > 0) {
        return Math.max(500, delta);
      }
    }
  }

  const baseDelay = 500;
  return Math.min(5000, baseDelay * 2 ** attempt);
}

async function doFetchOpenRouter(params, stream) {
  const { prompt, llmParameters } = params;
  const { keySource } = llmParameters;
  const { Constants } = Config;

  const apiKey =
    keySource.source === "account"
      ? getAccountServiceKey(keySource.account, "openRouterApiKey")
      : llmParameters.apiKey;

  if (nullUndefinedOrEmpty(apiKey) || apiKey === "sk-or-v1-xxxxxxxxxxxxxxxx") {
    throw new Error(`OpenRouter: Invalid API key "${apiKey}"`);
  }

  if (prompt.length < 1) {
    throw new Error("OpenRouter: Prompt is empty");
  }

  const endpointUrl =
    llmParameters.serverUrl ||
    Constants.endpoints?.llm?.openrouter?.defaultUrl ||
    "https://openrouter.ai/api/v1/chat/completions";

  const referer =
    Constants.config?.openRouter?.referer || process.env.OPENROUTER_REFERER;
  const clientTitle =
    Constants.config?.openRouter?.clientTitle || "PlayDayAI Taskserver";

  const headers = buildOpenRouterHeaders({
    apiKey,
    referer,
    title: clientTitle,
  });

  const body = buildRequestBody({ prompt, llmParameters, stream });

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      if (stream) {
        return response;
      }
      return response.json();
    }

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_RETRIES) {
      const text = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${text}`);
    }

    const delayMs = computeRetryDelay(response, attempt);
    console.warn(`OpenRouter request retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms (status ${response.status})`);
    await delay(delayMs);
    attempt += 1;
  }

  throw new Error("OpenRouter request retries exhausted");
}

async function blockingAPI(params) {
  try {
    const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
      const response = await doFetchOpenRouter(params, false);
      const content = response?.choices?.[0]?.message?.content ?? "";
      if (!content) {
        throw new Error(
          `OpenRouter: Invalid response payload ${JSON.stringify(response)}`
        );
      }
      return content;
    });

    return {
      success: true,
      data: result,
      error: null,
      executionTime: elapsedTime,
    };
  } catch (error) {
    console.error("OpenRouter blockingAPI error:", error);
    return { success: false, data: null, error, executionTime: 0 };
  }
}

async function streamingAPI(params) {
  const { callback } = params;

  try {
    const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
      const response = await doFetchOpenRouter(params, true);
      return handleStreamingResponse(response, callback);
    });

    return { ...result, executionTime: elapsedTime };
  } catch (error) {
    console.error("OpenRouter streamingAPI error:", error);
    return { success: false, data: null, error, executionTime: 0 };
  }
}

export default {
  blockingAPI,
  streamingAPI,
};
