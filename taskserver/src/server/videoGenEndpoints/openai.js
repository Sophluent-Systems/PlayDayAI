import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getAccountServiceKey } from "@src/backend/accounts";

const JSON_TYPE = "application/json";
const DEFAULT_POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 600;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSeconds(value) {
  if (typeof value === "number" && value > 0) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildRequestBody({ prompt, videoGenerationSettings, seed, model }) {
  const settings = videoGenerationSettings ?? {};

  const payload = {
    model: model ?? "sora-2",
    prompt,
  };

  const seconds =
    sanitizeSeconds(settings.seconds) ??
    sanitizeSeconds(settings.durationSeconds);
  if (seconds) {
    payload.seconds = String(seconds);
  }

  if (settings.size && typeof settings.size === "string") {
    payload.size = settings.size;
  } else if (
    typeof settings.size === "number" ||
    (settings.size && typeof settings.size !== "string")
  ) {
    payload.size = String(settings.size);
  }

  if (typeof seed === "number" && seed >= 0) {
    payload.seed = String(seed);
  } else if (typeof seed === "string" && seed.trim() !== "") {
    payload.seed = seed;
  }

  if (settings.outputFormat) {
    payload.output_format =
      typeof settings.outputFormat === "string"
        ? settings.outputFormat
        : String(settings.outputFormat);
  }

  if (
    settings.extraOptions &&
    typeof settings.extraOptions === "object" &&
    !Array.isArray(settings.extraOptions)
  ) {
    Object.entries(settings.extraOptions).forEach(([key, value]) => {
      if (value == null) {
        return;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        payload[key] = String(value);
      } else {
        payload[key] = value;
      }
    });
  }

  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (typeof value === "number") {
      payload[key] = String(value);
    }
  });

  return JSON.stringify(payload);
}

async function fetchJson(url, { apiKey }) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: JSON_TYPE,
    },
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(
      `OpenAI video status request failed (${response.status}): ${failureText}`
    );
  }

  return response.json();
}

async function fetchVideoContent(url, { apiKey }) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/octet-stream",
    },
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(
      `OpenAI video content request failed (${response.status}): ${failureText}`
    );
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    metadata: {
      contentType,
    },
  };
}

async function waitForJobCompletion({
  jobId,
  baseUrl,
  apiKey,
  pollIntervalMs,
  initialStatus,
  maxAttempts,
}) {
  let attempts = 0;
  const statusUrl = `${baseUrl}/${jobId}`;

  let jobStatus =
    initialStatus && initialStatus.id === jobId
      ? initialStatus
      : await fetchJson(statusUrl, { apiKey });

  while (
    jobStatus &&
    ["queued", "in_progress", "starting", "processing"].includes(
      jobStatus.status
    ) &&
    attempts < maxAttempts
  ) {
    await delay(pollIntervalMs);
    jobStatus = await fetchJson(statusUrl, { apiKey });
    attempts += 1;
  }

  if (!jobStatus) {
    throw new Error(
      `OpenAI video generation job "${jobId}" returned an empty status payload`
    );
  }

  if (jobStatus.status !== "completed") {
    let failureReason =
      jobStatus.error?.message ??
      jobStatus.failure_reason ??
      jobStatus.status ??
      "unknown error";

    if (
      ["queued", "in_progress", "starting", "processing"].includes(
        jobStatus.status
      )
    ) {
      failureReason = `${jobStatus.status} after ${attempts} poll attempt${
        attempts === 1 ? "" : "s"
      }`;
    }

    throw new Error(
      `OpenAI video generation job "${jobId}" failed: ${failureReason}`
    );
  }

  return jobStatus;
}

async function doGenerateVideo(params) {
  const { keySource, videoGenerationSettings, prompt, seed, model } = params;
  const { Constants } = Config;

  if (nullUndefinedOrEmpty(prompt)) {
    throw new Error("OpenAI video generation failed: prompt is required");
  }

  const apiKey =
    keySource?.source === "account"
      ? getAccountServiceKey(keySource.account, "openAIkey")
      : params.apiKey;

  if (nullUndefinedOrEmpty(apiKey)) {
    throw new Error("OpenAI video generation failed: API key is missing");
  }

  const baseUrl =
    params.serverUrl ??
    Constants.endpoints?.videoGeneration?.openai?.defaultUrl ??
    "https://api.openai.com/v1/videos";

  const pollIntervalMs =
    videoGenerationSettings?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const body = buildRequestBody({
    prompt,
    videoGenerationSettings,
    seed,
    model: model ?? Constants.endpoints?.videoGeneration?.openai?.defaultModel,
  });

  console.log("OpenAI video generation url: ", baseUrl);
  console.log("OpenAI video generation body: ", JSON.stringify(body, null, 2));

  const createResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": JSON_TYPE,
    },
    body,
  });

  if (!createResponse.ok) {
    const failureText = await createResponse.text();
    throw new Error(
      `OpenAI video generation request failed (${createResponse.status}): ${failureText}`
    );
  }

  const creationPayload = await createResponse.json();
  const jobId = creationPayload?.id;

  if (!jobId) {
    throw new Error(
      `OpenAI video generation failed: missing job id in response ${JSON.stringify(
        creationPayload
      )}`
    );
  }

  const maxPollAttempts =
    videoGenerationSettings?.maxPollAttempts ?? MAX_POLL_ATTEMPTS;

  const jobStatus = await waitForJobCompletion({
    jobId,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    pollIntervalMs,
    initialStatus: creationPayload,
    maxAttempts: Math.max(1, Number(maxPollAttempts) || MAX_POLL_ATTEMPTS),
  });

  const contentUrl = `${baseUrl.replace(/\/$/, "")}/${jobId}/content`;
  const content = await fetchVideoContent(contentUrl, { apiKey });

  let thumbnailBuffer = null;
  const previewImage =
    jobStatus.preview_image ??
    jobStatus.preview_frame ??
    jobStatus.thumbnail;

  if (typeof previewImage === "string") {
    try {
      thumbnailBuffer = Buffer.from(previewImage, "base64");
    } catch (error) {
      console.warn(
        "OpenAI video generation: failed to decode preview image as base64",
        error
      );
    }
  }

  return {
    buffer: content.buffer,
    metadata: {
      ...content.metadata,
      jobId,
      job: jobStatus,
    },
    thumbnail: thumbnailBuffer,
  };
}

export default {
  doGenerateVideo,
};
