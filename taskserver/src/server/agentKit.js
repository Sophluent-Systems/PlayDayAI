import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_TYPE = "application/json";
const RESPONSES_BETA = "responses=v1";

function buildSystemMessage({ agentBlueprint, connectorRefs, appSurface }) {
  const parts = [];

  if (agentBlueprint) {
    try {
      const serialized = typeof agentBlueprint === "string"
        ? agentBlueprint
        : JSON.stringify(agentBlueprint, null, 2);
      parts.push(`Agent Blueprint:\n${serialized}`);
    } catch (error) {
      parts.push(`Agent blueprint (non-serializable): ${String(agentBlueprint)}`);
    }
  }

  if (Array.isArray(connectorRefs) && connectorRefs.length > 0) {
    const formatted = connectorRefs
      .map((connector) => {
        const scopes = Array.isArray(connector.scopes) ? connector.scopes.join(", ") : "";
        return `- Connector ID: ${connector.connectorId ?? "unknown"} (profile: ${connector.authProfileId ?? "n/a"})${scopes ? ` scopes: ${scopes}` : ""}`;
      })
      .join("\n");
    parts.push(`Connector Registry References:\n${formatted}`);
  }

  if (appSurface) {
    try {
      const serialized = typeof appSurface === "string"
        ? appSurface
        : JSON.stringify(appSurface, null, 2);
      parts.push(`App Surface Hints:\n${serialized}`);
    } catch (error) {
      parts.push(`App surface hint (non-serializable): ${String(appSurface)}`);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    role: "system",
    content: [
      {
        type: "text",
        text: parts.join("\n\n"),
      },
    ],
  };
}

function convertHistoryMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const role = message.role === "user" ? "user" : "assistant";
  const segments = [];

  const textContent = message.content?.text ?? message.content;
  if (!nullUndefinedOrEmpty(textContent, true)) {
    segments.push({
      type: "text",
      text: textContent,
    });
  }

  const dataPayload = message.data ?? message.content?.data;
  if (dataPayload && Object.keys(dataPayload).length > 0) {
    try {
      segments.push({
        type: "text",
        text: `JSON DATA PAYLOAD:\n${JSON.stringify(dataPayload, null, 2)}`,
      });
    } catch (error) {
      segments.push({
        type: "text",
        text: `DATA PAYLOAD (non-serializable): ${String(dataPayload)}`,
      });
    }
  }

  if (segments.length === 0) {
    return null;
  }

  return {
    role,
    content: segments,
  };
}

function buildInputs({ messages, agentBlueprint, connectorRefs, appSurface }) {
  const inputs = [];

  const systemMessage = buildSystemMessage({ agentBlueprint, connectorRefs, appSurface });
  if (systemMessage) {
    inputs.push(systemMessage);
  }

  if (Array.isArray(messages)) {
    messages.forEach((message) => {
      const converted = convertHistoryMessage(message);
      if (converted) {
        inputs.push(converted);
      }
    });
  }

  return inputs;
}

function extractTextFromResponse(responseJSON) {
  if (!responseJSON) {
    return "";
  }

  if (typeof responseJSON.output_text === "string") {
    return responseJSON.output_text;
  }

  if (Array.isArray(responseJSON.output_text)) {
    return responseJSON.output_text.join("\n");
  }

  if (Array.isArray(responseJSON.output)) {
    const collected = [];
    responseJSON.output.forEach((chunk) => {
      if (Array.isArray(chunk.content)) {
        chunk.content.forEach((item) => {
          if (item.type === "output_text" && item.text) {
            collected.push(item.text);
          } else if (item.type === "text" && item.text) {
            collected.push(item.text);
          }
        });
      }
    });
    return collected.join("\n");
  }

  return "";
}

export async function runAgentKit({
  messages,
  agentBlueprint,
  connectorRefs,
  appSurface,
  keySource,
  apiKey,
  serverUrl,
  model,
  metadata,
}) {
  const { Constants } = Config;

  const resolvedApiKey =
    keySource?.source === "account"
      ? getAccountServiceKey(keySource.account, "openAIkey")
      : apiKey;

  if (nullUndefinedOrEmpty(resolvedApiKey)) {
    throw new Error("OpenAI AgentKit: missing API key");
  }

  const endpoint =
    serverUrl ??
    Constants.endpoints?.agent ?? Constants.endpoints?.agentKit?.openai?.defaultUrl ??
    "https://api.openai.com/v1/responses";

  const inputs = buildInputs({ messages, agentBlueprint, connectorRefs, appSurface });

  if (inputs.length === 0) {
    throw new Error("OpenAI AgentKit: no inputs available for the agent");
  }

  let resolvedMetadata = metadata;
  if (typeof resolvedMetadata === "string") {
    try {
      resolvedMetadata = JSON.parse(resolvedMetadata);
    } catch (error) {
      resolvedMetadata = { note: resolvedMetadata };
    }
  }

  const body = {
    model: model ?? Constants.endpoints?.agentKit?.openai?.defaultModel ?? "gpt-4.1-mini",
    input: inputs,
    metadata: resolvedMetadata ?? {},
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      "Content-Type": JSON_TYPE,
      "OpenAI-Beta": RESPONSES_BETA,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`OpenAI AgentKit call failed (${response.status}): ${failureText}`);
  }

  const responseJSON = await response.json();
  const text = extractTextFromResponse(responseJSON);

  return {
    text,
    raw: responseJSON,
  };
}
