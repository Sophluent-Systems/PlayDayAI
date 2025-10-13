import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech";
const DEFAULT_OPENROUTER_TTS_MODEL = "openrouter/gpt-4o-mini-tts";

function resolveApiKey(keySource, params) {
  if (keySource?.source === "account" && keySource.account) {
    return getAccountServiceKey(keySource.account, "openRouterApiKey");
  }
  return params.apiKey;
}

function buildHeaders(apiKey, Constants) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": JSON_CONTENT_TYPE,
  };

  const referer = Constants.config?.openRouter?.referer || process.env.OPENROUTER_REFERER;
  const clientTitle = Constants.config?.openRouter?.clientTitle || "PlayDayAI Taskserver";

  if (!nullUndefinedOrEmpty(referer, true)) {
    headers["HTTP-Referer"] = referer;
  }
  if (!nullUndefinedOrEmpty(clientTitle, true)) {
    headers["X-Title"] = clientTitle;
  }

  return headers;
}

function buildRequestBody(params, Constants) {
  const voice = params.voice ?? params.voiceId ?? "alloy";
  const model = params.model ?? Constants.endpoints?.audioGeneration?.openrouter?.defaultModel ?? DEFAULT_OPENROUTER_TTS_MODEL;
  const format = params.outputFormat ?? params.format ?? "mp3";

  return {
    model,
    input: params.text ?? "",
    voice,
    format,
    metadata: params.metadata ?? {},
  };
}

async function extractAudioFromResponse(response) {
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (contentType.startsWith("audio/")) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType: contentType,
      buffer: Buffer.from(arrayBuffer),
    };
  }

  const payload = await response.json();
  let audioBase64 = payload?.audio ?? payload?.output_audio ?? "";
  if (Array.isArray(payload?.output)) {
    const firstAudio = payload.output.find((item) => item?.audio);
    if (firstAudio) {
      audioBase64 = firstAudio.audio;
    }
  }
  const mimeType = payload?.mime_type ?? payload?.output_mime_type ?? "audio/mpeg";

  if (nullUndefinedOrEmpty(audioBase64, true)) {
    throw new Error("OpenRouter TTS: Response did not include audio data");
  }

  return {
    mimeType,
    buffer: Buffer.from(audioBase64, "base64"),
  };
}

export async function doTxt2AudioRequest(params) {
  const { Constants } = Config;
  const apiKey = resolveApiKey(params.keySource, params);

  if (nullUndefinedOrEmpty(apiKey, true)) {
    throw new Error("OpenRouter TTS: Missing API key");
  }

  const endpoint =
    params.serverUrl ??
    Constants.endpoints?.audioGeneration?.openrouter?.defaultUrl ??
    DEFAULT_OPENROUTER_TTS_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(apiKey, Constants),
    body: JSON.stringify(buildRequestBody(params, Constants)),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`OpenRouter TTS request failed (${response.status}): ${failureText}`);
  }

  const { mimeType, buffer } = await extractAudioFromResponse(response);
  return {
    source: "buffer",
    mimeType,
    data: buffer,
  };
}

export default {
  doTxt2AudioRequest,
};
