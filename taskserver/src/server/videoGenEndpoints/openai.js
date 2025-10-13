import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_TYPE = "application/json";

function buildRequestBody({ prompt, videoGenerationSettings, seed, model }) {
  const settings = videoGenerationSettings || {};

  const payload = {
    model: model ?? "sora-1.0",
    prompt,
    duration: settings.durationSeconds ?? 8,
    frame_rate: settings.frameRate ?? 24,
    aspect_ratio: settings.aspectRatio ?? "16:9",
    style: settings.stylePreset ?? undefined,
    safety_sensitivity: settings.safetySensitivity ?? "medium",
    negative_prompts: settings.negativePrompts ?? [],
    camera_path: settings.cameraPath ?? undefined,
  };

  if (typeof seed === "number" && seed >= 0) {
    payload.seed = seed;
  }

  return JSON.stringify(payload);
}

function extractVideoBufferFromResponseBody(body) {
  if (!body) {
    throw new Error("OpenAI video response body was empty");
  }

  if (body.video && typeof body.video === "string") {
    return {
      buffer: Buffer.from(body.video, "base64"),
      metadata: body.metadata ?? {},
      thumbnail: body.thumbnail ? Buffer.from(body.thumbnail, "base64") : null,
    };
  }

  if (Array.isArray(body.data) && body.data.length > 0) {
    const primary = body.data[0];
    if (primary.b64_json || primary.b64_video) {
      const base64 = primary.b64_video ?? primary.b64_json;
      return {
        buffer: Buffer.from(base64, "base64"),
        metadata: primary.metadata ?? {},
        thumbnail: primary.b64_thumbnail ? Buffer.from(primary.b64_thumbnail, "base64") : null,
      };
    }
  }

  throw new Error("Unable to decode OpenAI video response payload");
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes(JSON_TYPE)) {
    const json = await response.json();
    return extractVideoBufferFromResponseBody(json);
  }

  // Fallback to raw binary (e.g., mp4 stream)
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    metadata: {
      contentType,
    },
    thumbnail: null,
  };
}

async function doGenerateVideo(params) {
  const { keySource, videoGenerationSettings, prompt, seed, model } = params;
  const { Constants } = Config;

  const apiKey =
    keySource?.source === "account"
      ? getAccountServiceKey(keySource.account, "openAIkey")
      : params.apiKey;

  if (nullUndefinedOrEmpty(apiKey)) {
    throw new Error("OpenAI video generation failed: API key is missing");
  }

  const serverUrl =
    params.serverUrl ??
    Constants.endpoints?.videoGeneration?.openai?.defaultUrl ??
    "https://api.openai.com/v1/video/generations";

  const body = buildRequestBody({ prompt, videoGenerationSettings, seed, model: model ?? Constants.endpoints?.videoGeneration?.openai?.defaultModel });

  const response = await fetch(serverUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": JSON_TYPE,
    },
    body,
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(
      `OpenAI video generation request failed (${response.status}): ${failureText}`
    );
  }

  return parseResponse(response);
}

export default {
  doGenerateVideo,
};
