import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_TYPE = "application/json";

function buildRequestPayload({ customerContext, gaqlQuery }) {
  const context = customerContext || {};
  if (nullUndefinedOrEmpty(gaqlQuery, true)) {
    throw new Error("Google Ads MCP: GAQL query is required");
  }

  const payload = {
    query: gaqlQuery,
    loginCustomerId: context.loginCustomerId ?? undefined,
    customerId: context.customerId ?? undefined,
  };

  if (!nullUndefinedOrEmpty(context.oauthProfileId, true)) {
    payload.oauthProfileId = context.oauthProfileId;
  }

  return payload;
}

async function handleResponse(response) {
  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`Google Ads MCP request failed (${response.status}): ${failureText}`);
  }

  const json = await response.json();

  if (!Array.isArray(json.rows)) {
    return {
      rows: [],
      raw: json,
    };
  }

  return {
    rows: json.rows,
    raw: json,
  };
}

export async function runGoogleAdsMCPQuery({
  customerContext,
  gaqlQuery,
  endpoint,
  apiKey,
  keySource,
}) {
  const { Constants } = Config;

  const resolvedKey =
    keySource?.source === "account"
      ? getAccountServiceKey(keySource.account, "googleAdsServiceAccountKey")
      : apiKey;

  if (nullUndefinedOrEmpty(resolvedKey)) {
    throw new Error("Google Ads MCP: missing service account credentials");
  }

  const serverUrl =
    endpoint ??
    Constants.endpoints?.ads?.google?.defaultUrl ??
    "https://ads-mcp.example.com/query";

  const response = await fetch(serverUrl, {
    method: "POST",
    headers: {
      "Content-Type": JSON_TYPE,
      Authorization: `Bearer ${resolvedKey}`,
    },
    body: JSON.stringify(buildRequestPayload({ customerContext, gaqlQuery })),
  });

  return handleResponse(response);
}
