import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_CONTENT_TYPE = "application/json";
const FORM_URLENCODED = "application/x-www-form-urlencoded";
const DEFAULT_SCOPE = "https://graph.microsoft.com/.default";

function resolveAccountPreference(keySource, keyName) {
  if (!keySource || keySource.source !== "account" || !keySource.account) {
    return null;
  }
  return getAccountServiceKey(keySource.account, keyName);
}

function resolveConfigPreference(preferences, key) {
  if (!preferences || typeof preferences !== "object") {
    return null;
  }
  const value = preferences[key];
  if (nullUndefinedOrEmpty(value, true)) {
    return null;
  }
  return value;
}

function resolveValue({ explicit, keySource, keyName, preferenceKey, envKey, fallback }) {
  if (!nullUndefinedOrEmpty(explicit, true)) {
    return explicit;
  }

  const accountValue = resolveAccountPreference(keySource, keyName);
  if (!nullUndefinedOrEmpty(accountValue, true)) {
    return accountValue;
  }

  const { Constants } = Config;
  const preferenceValue = resolveConfigPreference(Constants?.preferences, preferenceKey);
  if (!nullUndefinedOrEmpty(preferenceValue, true)) {
    return preferenceValue;
  }

  const envValue = envKey ? process.env[envKey] : null;
  if (!nullUndefinedOrEmpty(envValue, true)) {
    return envValue;
  }

  return fallback ?? null;
}

function parseJSON(value, options = {}) {
  const { fallback = null, property = "value" } = options;
  if (value == null) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    if (options.throwOnError) {
      throw new Error(`Failed to parse JSON for ${property}: ${error.message}`);
    }
    return fallback;
  }
}

function normalizeAzureProfile(profileInput, keySource) {
  const profile = parseJSON(profileInput, { fallback: {} });
  const tenantId = resolveValue({
    explicit: profile.tenantId,
    keySource,
    keyName: "azureEntraTenantId",
    preferenceKey: "azureEntraTenantId",
    envKey: "AZURE_ENTRA_TENANT_ID",
  });
  const subscriptionId = profile.subscriptionId ?? null;
  const aiFoundryEndpoint = resolveValue({
    explicit: profile.aiFoundryEndpoint ?? profile.endpoint,
    keySource,
    keyName: "azureAiFoundryEndpoint",
    preferenceKey: "azureAiFoundryEndpoint",
    envKey: "AZURE_AI_FOUNDRY_ENDPOINT",
  });
  const loggingWorkspaceId = profile.loggingWorkspaceId ?? null;
  const telemetrySampleRate =
    typeof profile.telemetrySampleRate === "number"
      ? profile.telemetrySampleRate
      : Number.parseFloat(profile.telemetrySampleRate ?? "1") || 1;

  return {
    tenantId,
    subscriptionId,
    aiFoundryEndpoint,
    loggingWorkspaceId,
    telemetrySampleRate,
  };
}

function formatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message, index) => {
      if (!message) {
        return null;
      }

      const role = message.role === "user" ? "user" : "assistant";
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content?.text ?? "";

      const dataPayload = message.data ?? message.content?.data ?? null;
      const formatted = {
        role,
        content: content ?? "",
        turn: index,
      };

      if (dataPayload && Object.keys(dataPayload).length > 0) {
        formatted.data = dataPayload;
      }

      return formatted;
    })
    .filter(Boolean);
}

async function fetchClientCredentialToken({ tenantId, clientId, clientSecret, scope }) {
  if (nullUndefinedOrEmpty(tenantId, true)) {
    throw new Error("Microsoft Agent Framework: Tenant ID is required to request a token");
  }
  if (nullUndefinedOrEmpty(clientId, true) || nullUndefinedOrEmpty(clientSecret, true)) {
    throw new Error("Microsoft Agent Framework: Client ID and secret are required to request a token");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: scope ?? DEFAULT_SCOPE,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": FORM_URLENCODED,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(
      `Microsoft Agent Framework: token request failed (${response.status}): ${failureText}`
    );
  }

  const tokenJSON = await response.json();
  const accessToken = tokenJSON?.access_token;
  if (nullUndefinedOrEmpty(accessToken, true)) {
    throw new Error("Microsoft Agent Framework: token response missing access_token");
  }
  return accessToken;
}

function buildRequestBody({
  messages,
  agentConfig,
  workflowVariables,
  azureResourceProfile,
  metadata,
}) {
  return {
    configuration: agentConfig ?? {},
    conversation: {
      messages: formatMessages(messages),
    },
    variables: workflowVariables ?? {},
    azureResourceProfile: azureResourceProfile ?? {},
    metadata: metadata ?? {},
  };
}

function extractTextFromResponse(responseJSON) {
  if (!responseJSON) {
    return "";
  }

  if (typeof responseJSON.summary === "string") {
    return responseJSON.summary;
  }

  if (typeof responseJSON.outputText === "string") {
    return responseJSON.outputText;
  }

  if (Array.isArray(responseJSON.messages)) {
    const assistantTurns = responseJSON.messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.content ?? "");
    if (assistantTurns.length > 0) {
      return assistantTurns.join("\n");
    }
  }

  if (Array.isArray(responseJSON.events)) {
    const completionEvent = responseJSON.events.find(
      (event) => event.type === "completion" || event.type === "final"
    );
    if (completionEvent?.message) {
      return completionEvent.message;
    }
  }

  return "";
}

function normalizeAgentConfig(configInput) {
  if (!configInput) {
    return {};
  }
  if (typeof configInput === "object") {
    return configInput;
  }
  if (typeof configInput === "string") {
    const parsed = parseJSON(configInput, { fallback: null });
    if (parsed) {
      return parsed;
    }
  }
  return {};
}

function normalizeVariables(variablesInput) {
  if (!variablesInput) {
    return {};
  }

  if (typeof variablesInput === "object") {
    return variablesInput;
  }

  if (typeof variablesInput === "string") {
    const parsed = parseJSON(variablesInput, { fallback: {} });
    return parsed ?? {};
  }

  return {};
}

export async function runMicrosoftAgentWorkflow({
  messages,
  agentConfig,
  workflowVariables,
  azureResourceProfile,
  keySource,
  apiKey,
  serverUrl,
  clientId,
  clientSecret,
  tenantId,
  metadata,
  scope,
}) {
  const { Constants } = Config;

  const resolvedProfile = normalizeAzureProfile(azureResourceProfile, keySource);
  const resolvedAgentConfig = normalizeAgentConfig(agentConfig);
  const resolvedVariables = normalizeVariables(workflowVariables);
  const resolvedMetadata = parseJSON(metadata, { fallback: metadata ?? {} });

  const endpoint =
    serverUrl ??
    Constants.endpoints?.agentFramework?.microsoft?.defaultUrl ??
    "https://agentframework.microsoft.com/api/run";

  const resolvedClientId = resolveValue({
    explicit: clientId,
    keySource,
    keyName: "microsoftAgentFrameworkClientId",
    preferenceKey: "microsoftAgentFrameworkClientId",
    envKey: "MICROSOFT_AGENT_FRAMEWORK_CLIENT_ID",
  });

  const resolvedClientSecret = resolveValue({
    explicit: clientSecret,
    keySource,
    keyName: "microsoftAgentFrameworkClientSecret",
    preferenceKey: "microsoftAgentFrameworkClientSecret",
    envKey: "MICROSOFT_AGENT_FRAMEWORK_CLIENT_SECRET",
  });

  const resolvedTenantId =
    tenantId ??
    resolvedProfile.tenantId ??
    resolveValue({
      explicit: null,
      keySource,
      keyName: "azureEntraTenantId",
      preferenceKey: "azureEntraTenantId",
      envKey: "AZURE_ENTRA_TENANT_ID",
    });

  let bearerToken = apiKey;
  if (nullUndefinedOrEmpty(bearerToken, true)) {
    bearerToken = await fetchClientCredentialToken({
      tenantId: resolvedTenantId,
      clientId: resolvedClientId,
      clientSecret: resolvedClientSecret,
      scope: scope ?? Constants.endpoints?.agentFramework?.microsoft?.scope ?? DEFAULT_SCOPE,
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": JSON_CONTENT_TYPE,
    },
    body: JSON.stringify(
      buildRequestBody({
        messages,
        agentConfig: resolvedAgentConfig,
        workflowVariables: resolvedVariables,
        azureResourceProfile: resolvedProfile,
        metadata: resolvedMetadata,
      })
    ),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(
      `Microsoft Agent Framework call failed (${response.status}): ${failureText}`
    );
  }

  const responseJSON = await response.json();

  return {
    text: extractTextFromResponse(responseJSON),
    events: Array.isArray(responseJSON?.events) ? responseJSON.events : [],
    artifacts: Array.isArray(responseJSON?.artifacts) ? responseJSON.artifacts : [],
    raw: responseJSON,
    profile: resolvedProfile,
  };
}

export default {
  runMicrosoftAgentWorkflow,
};
