import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_TYPE = "application/json";

function buildRequestBody({ query, searchConfig }) {
  const config = searchConfig || {};
  const body = {
    q: query,
    max_snippets: config.snippetLimit ?? 5,
    search_focus: config.safeMode === false ? "balanced" : "strict",
  };

  if (!nullUndefinedOrEmpty(config.freshnessWindow, true)) {
    body.freshness = config.freshnessWindow;
  }

  if (!nullUndefinedOrEmpty(config.locale, true)) {
    body.locale = config.locale;
  }

  if (Array.isArray(config.allowedDomains) && config.allowedDomains.length > 0) {
    body.allowed_domains = config.allowedDomains;
  }

  return body;
}

function convertSnippets(responseJSON) {
  if (!responseJSON) {
    return [];
  }

  if (Array.isArray(responseJSON.snippets)) {
    return responseJSON.snippets.map((snippet) => ({
      title: snippet.title ?? "",
      url: snippet.url ?? "",
      excerpt: snippet.snippet ?? snippet.content ?? "",
      publishedAt: snippet.published_at ?? null,
      score: snippet.score ?? null,
      metadata: snippet.metadata ?? {},
    }));
  }

  if (Array.isArray(responseJSON.results)) {
    return responseJSON.results.map((result) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      excerpt: result.snippet ?? result.content ?? "",
      publishedAt: result.published_at ?? null,
      score: result.score ?? null,
      metadata: result,
    }));
  }

  return [];
}

export async function runPerplexitySearch({
  query,
  searchConfig,
  keySource,
  apiKey,
  serverUrl,
}) {
  const { Constants } = Config;

  if (nullUndefinedOrEmpty(query, true)) {
    throw new Error("Perplexity search: query is required");
  }

  const resolvedKey =
    keySource?.source === "account"
      ? getAccountServiceKey(keySource.account, "perplexityApiKey")
      : apiKey;

  if (nullUndefinedOrEmpty(resolvedKey)) {
    throw new Error("Perplexity search: missing API key");
  }

  const endpoint =
    serverUrl ??
    Constants.endpoints?.search?.perplexity?.defaultUrl ??
    "https://api.perplexity.ai/search";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      "Content-Type": JSON_TYPE,
    },
    body: JSON.stringify(buildRequestBody({ query, searchConfig })),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`Perplexity search failed (${response.status}): ${failureText}`);
  }

  const responseJSON = await response.json();
  const snippets = convertSnippets(responseJSON);

  return {
    snippets,
    raw: responseJSON,
  };
}
