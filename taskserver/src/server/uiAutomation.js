import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_MAX_STEPS = 20;
const MAX_ALLOWED_STEPS = 60;
const MIN_STEP_DELAY_MS = 200;

function resolveApiKey(keySource, explicitKey) {
  if (!nullUndefinedOrEmpty(explicitKey, true)) {
    return explicitKey;
  }
  if (keySource?.source === "account" && keySource.account) {
    return getAccountServiceKey(keySource.account, "googleLLMKey");
  }
  return null;
}

function normalizeViewport(viewport) {
  if (!viewport) {
    return null;
  }
  if (typeof viewport === "string") {
    const trimmed = viewport.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return { kind: "base64", data: trimmed };
      }
    }
    return { kind: "base64", data: trimmed };
  }
  return viewport;
}

function normalizeSessionState(sessionState) {
  if (!sessionState) {
    return {};
  }
  if (typeof sessionState === "string") {
    try {
      return JSON.parse(sessionState);
    } catch (error) {
      return {};
    }
  }
  if (typeof sessionState === "object") {
    return sessionState;
  }
  return {};
}

function normalizeSafetySettings(safety) {
  if (!safety) {
    return { level: "strict" };
  }
  if (typeof safety === "string") {
    return { level: safety };
  }
  return safety;
}

function clampSteps(maxSteps) {
  if (!Number.isFinite(maxSteps)) {
    return DEFAULT_MAX_STEPS;
  }
  return Math.max(1, Math.min(MAX_ALLOWED_STEPS, Math.floor(maxSteps)));
}

function clampDelay(stepDelayMs) {
  if (!Number.isFinite(stepDelayMs)) {
    return MIN_STEP_DELAY_MS;
  }
  return Math.max(MIN_STEP_DELAY_MS, Math.floor(stepDelayMs));
}

function buildRequestBody({
  taskDescription,
  viewport,
  sessionState,
  model,
  safetySettings,
  maxSteps,
  stepDelayMs,
  metadata,
}) {
  const body = {
    model,
    task: taskDescription,
    viewport: viewport ?? null,
    session_state: sessionState ?? {},
    safety_settings: safetySettings ?? { level: "strict" },
    options: {
      max_steps: clampSteps(maxSteps),
      step_delay_ms: clampDelay(stepDelayMs),
    },
  };

  if (metadata && typeof metadata === "object") {
    body.metadata = metadata;
  }

  return body;
}

function extractSummary(responseJSON, fallbackActions) {
  if (!responseJSON) {
    return `Generated ${fallbackActions.length} UI actions.`;
  }
  if (typeof responseJSON.summary === "string") {
    return responseJSON.summary;
  }
  if (Array.isArray(responseJSON.messages)) {
    const assistantMessages = responseJSON.messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.content ?? "")
      .filter((text) => !nullUndefinedOrEmpty(text, true));
    if (assistantMessages.length > 0) {
      return assistantMessages.join("\n");
    }
  }
  if (typeof responseJSON.result === "string") {
    return responseJSON.result;
  }
  return `Generated ${fallbackActions.length} UI actions.`;
}

function validateActions(actions, maxSteps) {
  if (!Array.isArray(actions)) {
    return [];
  }
  const allowedTypes = new Set(["click", "type", "scroll", "wait", "drag", "key", "navigate"]);
  const sanitized = [];
  for (const action of actions.slice(0, maxSteps)) {
    if (!action || typeof action !== "object") {
      continue;
    }
    const type = action.type ?? action.action ?? "";
    if (!allowedTypes.has(type)) {
      throw new Error(`uiAutomation: Unsupported action type "${type}" requested by provider`);
    }
    sanitized.push({
      ...action,
      type,
    });
  }
  return sanitized;
}

export async function runComputerUseAutomation({
  taskDescription,
  viewport,
  sessionState,
  keySource,
  apiKey,
  serverUrl,
  model,
  safetySettings,
  maxSteps,
  stepDelayMs,
  metadata,
}) {
  if (nullUndefinedOrEmpty(taskDescription, true)) {
    throw new Error("uiAutomation: taskDescription is required");
  }

  const { Constants } = Config;
  const resolvedApiKey = resolveApiKey(keySource, apiKey);

  if (nullUndefinedOrEmpty(resolvedApiKey, true)) {
    throw new Error("uiAutomation: missing Google Gemini API key");
  }

  const endpoint =
    serverUrl ??
    Constants.endpoints?.computerUse?.google?.defaultUrl ??
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-user:computerUse";

  const resolvedModel =
    model ?? Constants.endpoints?.computerUse?.google?.defaultModel ?? "gemini-2.5-computer-use";

  const resolvedViewport = normalizeViewport(viewport);
  const resolvedSessionState = normalizeSessionState(sessionState);
  const resolvedSafety = normalizeSafetySettings(safetySettings);

  const url = new URL(endpoint);
  if (!url.searchParams.has("key")) {
    url.searchParams.set("key", resolvedApiKey);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
    },
    body: JSON.stringify(
      buildRequestBody({
        taskDescription,
        viewport: resolvedViewport,
        sessionState: resolvedSessionState,
        model: resolvedModel,
        safetySettings: resolvedSafety,
        maxSteps,
        stepDelayMs,
        metadata,
      })
    ),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`uiAutomation: provider call failed (${response.status}): ${failureText}`);
  }

  const responseJSON = await response.json();
  const actionsRaw = responseJSON?.actions ?? responseJSON?.plan ?? [];
  const actions = validateActions(actionsRaw, clampSteps(maxSteps));

  const updatedViewport =
    responseJSON?.updated_viewport ?? responseJSON?.viewport ?? resolvedViewport ?? null;

  const updatedSession =
    responseJSON?.session_state ?? responseJSON?.sessionState ?? resolvedSessionState;

  return {
    actions,
    updatedViewport,
    sessionState: updatedSession,
    text: extractSummary(responseJSON, actions),
    raw: responseJSON,
  };
}

export default {
  runComputerUseAutomation,
};
