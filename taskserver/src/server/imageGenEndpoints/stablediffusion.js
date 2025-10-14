
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from "@src/backend/accounts";

const MODEL_ENDPOINT_RULES = [
  { test: /^sd3(\.5)?-/i, endpoint: 'sd3', includeModel: true, requiresAspectRatio: true },
  { test: /^core/i, endpoint: 'core', includeModel: false, requiresAspectRatio: false },
  { test: /^sdxl/i, endpoint: 'sdxl', includeModel: true, requiresAspectRatio: false },
  { test: /^flux/i, endpoint: 'flux', includeModel: true, requiresAspectRatio: true },
  { test: /^ultra/i, endpoint: 'ultra', includeModel: true, requiresAspectRatio: true },
];

const SD3_ALLOWED_ASPECT_RATIOS = [
  { value: '21:9', width: 21, height: 9 },
  { value: '16:9', width: 16, height: 9 },
  { value: '3:2', width: 3, height: 2 },
  { value: '4:3', width: 4, height: 3 },
  { value: '5:4', width: 5, height: 4 },
  { value: '1:1', width: 1, height: 1 },
  { value: '4:5', width: 4, height: 5 },
  { value: '3:4', width: 3, height: 4 },
  { value: '2:3', width: 2, height: 3 },
  { value: '9:16', width: 9, height: 16 },
];

const ASPECT_RATIO_VALUES = SD3_ALLOWED_ASPECT_RATIOS.map(({ value }) => value);

function sanitizeApiKey(rawKey) {
  if (nullUndefinedOrEmpty(rawKey, true)) {
    return null;
  }

  const trimmed = `${rawKey}`.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }

  if (trimmed.startsWith('setting:')) {
    const [, remainder] = trimmed.split(':');
    if (!remainder) {
      return null;
    }
    const [, fallbackKey] = remainder.split(';');
    if (fallbackKey && !fallbackKey.includes('xxxxxxxx')) {
      return fallbackKey.trim();
    }
    return null;
  }

  if (trimmed.includes('xxxxxxxx')) {
    return null;
  }

  return trimmed;
}

function toFiniteNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function appendIfPresent(formData, key, value) {
  if (!nullUndefinedOrEmpty(value, true)) {
    formData.append(key, `${value}`);
  }
}

function appendNumberIfFinite(formData, key, value, options = {}) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return;
  }

  const { round = true, min = null, max = null } = options;
  let candidate = round ? Math.round(numeric) : numeric;

  if (min !== null && candidate < min) {
    return;
  }
  if (max !== null && candidate > max) {
    return;
  }

  formData.append(key, `${candidate}`);
}

function resolveModelRouting(model) {
  if (nullUndefinedOrEmpty(model)) {
    return { endpoint: 'sd3', includeModel: false, requiresAspectRatio: true };
  }

  for (const rule of MODEL_ENDPOINT_RULES) {
    if (rule.test.test(model)) {
      return {
        endpoint: rule.endpoint,
        includeModel: rule.includeModel,
        requiresAspectRatio: rule.requiresAspectRatio,
      };
    }
  }

  return {
    endpoint: model,
    includeModel: false,
    requiresAspectRatio: false,
  };
}

function sanitizeAspectRatio(input) {
  if (nullUndefinedOrEmpty(input)) {
    return null;
  }

  const cleaned = `${input}`.trim().replace(/\s+/g, '');
  if (ASPECT_RATIO_VALUES.includes(cleaned)) {
    return cleaned;
  }
  return null;
}

function inferAspectRatioFromDimensions(width, height) {
  const w = toFiniteNumber(width);
  const h = toFiniteNumber(height);
  if (!w || !h || h === 0) {
    return null;
  }

  const ratio = w / h;
  let closest = null;
  let smallestDiff = Number.POSITIVE_INFINITY;

  for (const candidate of SD3_ALLOWED_ASPECT_RATIOS) {
    const diff = Math.abs(ratio - candidate.width / candidate.height);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = candidate.value;
    }
  }

  return closest;
}

function buildRequestMetadata(response, model, endpoint) {
  const headers = response.headers;
  return {
    model,
    endpoint,
    requestId: headers.get('x-request-id') || headers.get('x-requestid') || null,
    traceId: headers.get('x-trace-id') || null,
    creditsConsumed: headers.get('x-credits-consumed') || null,
    clientId: headers.get('x-stability-client-id') || null,
    contentType: headers.get('content-type') || null,
    serverTiming: headers.get('server-timing') || null,
  };
}

function normalizeUrlBase(url) {
  if (nullUndefinedOrEmpty(url)) {
    return null;
  }
  const trimmed = `${url}`.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function resolveLegacyGenerationUrl(baseUrl, engineId) {
  let normalized = normalizeUrlBase(baseUrl);
  if (!normalized) {
    return null;
  }

  const v2Pattern = /\/v2beta\/stable-image\/generate$/i;
  if (v2Pattern.test(normalized)) {
    normalized = normalized.replace(v2Pattern, '/v1/generation');
  } else if (!/\/v1\/generation$/i.test(normalized)) {
    normalized = `${normalized}/v1/generation`;
  }

  return `${normalized}/${engineId}/text-to-image`;
}

function determineSdxlLightningEngine(modelId, params = {}) {
  const normalizedModel = `${modelId ?? ''}`.toLowerCase();
  if (normalizedModel.includes('4step')) {
    return 'sdxl-lightning-4step';
  }
  if (normalizedModel.includes('8step')) {
    return 'sdxl-lightning-8step';
  }

  const stepValue = toFiniteNumber(params.steps);
  if (stepValue !== null && stepValue <= 4) {
    return 'sdxl-lightning-4step';
  }
  return 'sdxl-lightning-8step';
}

function resolveLegacySdxlRoute(modelId, params = {}) {
  if (nullUndefinedOrEmpty(modelId)) {
    return null;
  }

  const normalized = `${modelId}`.trim().toLowerCase();
  if (!normalized.startsWith('sdxl')) {
    return null;
  }

  if (normalized.startsWith('sdxl-lightning')) {
    const engineId = determineSdxlLightningEngine(modelId, params);
    return {
      engineId,
      variant: 'sdxl-lightning',
    };
  }

  if (normalized.startsWith('sdxl-turbo')) {
    return {
      engineId: 'sdxl-turbo',
      variant: 'sdxl-turbo',
    };
  }

  if (normalized.startsWith('sdxl-1.0')) {
    return {
      engineId: 'stable-diffusion-xl-1024-v1-0',
      variant: 'sdxl-1.0',
    };
  }

  return {
    engineId: modelId,
    variant: normalized,
  };
}

function buildLegacySdxlPayload(params, engineId, { isLightning }) {
  const payload = {
    text_prompts: [
      { text: params.prompt, weight: 1 },
    ],
  };

  if (!nullUndefinedOrEmpty(params.negativePrompt)) {
    payload.text_prompts.push({ text: params.negativePrompt, weight: -1 });
  }

  const cfgScale = toFiniteNumber(params.cfg_scale);
  if (cfgScale !== null) {
    payload.cfg_scale = cfgScale;
  }

  const width = toFiniteNumber(params.width);
  if (width !== null && width >= 64) {
    payload.width = Math.round(width);
  }

  const height = toFiniteNumber(params.height);
  if (height !== null && height >= 64) {
    payload.height = Math.round(height);
  }

  const samples = toFiniteNumber(params.samples);
  if (samples !== null) {
    const clampedSamples = Math.max(1, Math.min(10, Math.round(samples)));
    payload.samples = clampedSamples;
  }

  const seed = toFiniteNumber(params.seed);
  if (seed !== null && seed >= 0) {
    payload.seed = Math.floor(seed);
  }

  const steps = toFiniteNumber(params.steps);
  if (isLightning) {
    payload.steps = engineId.endsWith('4step') ? 4 : 8;
  } else if (steps !== null) {
    payload.steps = Math.max(1, Math.round(steps));
  }

  if (!nullUndefinedOrEmpty(params.sampling_method)) {
    payload.sampler = params.sampling_method;
  }

  if (!nullUndefinedOrEmpty(params.stylePreset)) {
    payload.style_preset = params.stylePreset;
  }

  return payload;
}

async function doLegacySdxlRequest(params, { apiKey, baseUrl, modelId, engineId, variant, Constants }) {
  const url = resolveLegacyGenerationUrl(baseUrl, engineId);
  if (nullUndefinedOrEmpty(url)) {
    throw new Error("Stable Diffusion server URL is not configured.");
  }

  const isLightning = variant === 'sdxl-lightning';
  const requestBody = buildLegacySdxlPayload(params, engineId, { isLightning });

  const requestOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
  };

  if (Constants.debug.logImageGen) {
    console.log("Stable Diffusion (legacy SDXL) request url:", url);
    console.log("Stable Diffusion (legacy SDXL) engine:", engineId);
    console.log("Stable Diffusion (legacy SDXL) payload keys:", Object.keys(requestBody));
  }

  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    const failResponse = await response.text();
    const message = `stable diffusion API failure: status=${response.status}, response=${failResponse}`;
    console.error(message);
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  let buffer = null;
  let artifactMeta = null;

  if (contentType.includes('application/json')) {
    const json = await response.json();
    const artifact = json?.artifacts?.find((item) => item?.base64);
    if (!artifact?.base64) {
      throw new Error("Stable Diffusion returned an unexpected response without image data.");
    }
    artifactMeta = artifact;
    buffer = Buffer.from(artifact.base64, 'base64');
  } else {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  if (Constants.debug.logImageGen) {
    console.log("Stable Diffusion (legacy SDXL) response size (bytes):", buffer.length);
  }

  const metadata = {
    ...buildRequestMetadata(response, modelId || engineId, engineId),
  };

  if (artifactMeta?.seed !== undefined) {
    metadata.seed = artifactMeta.seed;
  }
  if (artifactMeta?.mime) {
    metadata.mime = artifactMeta.mime;
  }

  return {
    buffer,
    metadata,
  };
}

async function doTxt2ImgRequest(params) {
  const { keySource } = params;
  const { Constants } = Config;

  if (nullUndefinedOrEmpty(params.prompt)) {
    throw new Error("Stable Diffusion request requires a prompt.");
  }

  const resolvedKey =
    keySource?.source === 'account' && keySource?.account
      ? getAccountServiceKey(keySource.account, "stabilityAIKey")
      : params.apiKey;

  const apiKeyToUse = sanitizeApiKey(resolvedKey);

  if (!apiKeyToUse) {
    throw new Error("Stable Diffusion API key is missing. Please add a Stability AI key in Account Preferences or provide an API key for this node.");
  }

  const baseUrl = params.serverUrl || Constants?.endpoints?.imageGeneration?.stablediffusion?.defaultUrl;
  if (nullUndefinedOrEmpty(baseUrl)) {
    throw new Error("Stable Diffusion server URL is not configured.");
  }

  const modelId = params.model ?? '';
  const legacyRoute = resolveLegacySdxlRoute(modelId, params);
  if (legacyRoute) {
    return doLegacySdxlRequest(params, {
      apiKey: apiKeyToUse,
      baseUrl,
      modelId,
      engineId: legacyRoute.engineId,
      variant: legacyRoute.variant,
      Constants,
    });
  }

  const formData = new FormData();
  formData.append("prompt", params.prompt);

  if (!nullUndefinedOrEmpty(params.negativePrompt)) {
    formData.append("negative_prompt", params.negativePrompt);
  }

  const headers = {
    Accept: "image/*",
    Authorization: `Bearer ${apiKeyToUse}`,
  };

  const { endpoint, includeModel, requiresAspectRatio } = resolveModelRouting(modelId);

  if (includeModel && !nullUndefinedOrEmpty(modelId)) {
    formData.append('model', modelId);
  }

  const preferredAspectRatio = sanitizeAspectRatio(params.aspectRatio);
  const inferredAspectRatio = requiresAspectRatio
    ? inferAspectRatioFromDimensions(params.width, params.height)
    : sanitizeAspectRatio(params.aspectRatio);

  const aspectRatioToUse = preferredAspectRatio ?? inferredAspectRatio;

  if (aspectRatioToUse) {
    formData.append('aspect_ratio', aspectRatioToUse);
  } else if (requiresAspectRatio) {
    // Provide a sensible default if nothing else was specified.
    const defaultAspectRatio = Constants?.endpoints?.imageGeneration?.stablediffusion?.defaultAspectRatio ?? '1:1';
    formData.append('aspect_ratio', defaultAspectRatio);
  }

  if (!requiresAspectRatio) {
    appendNumberIfFinite(formData, 'width', params.width, { min: 64 });
    appendNumberIfFinite(formData, 'height', params.height, { min: 64 });
  }

  const seed = toFiniteNumber(params.seed);
  if (seed !== null && seed >= 0) {
    formData.append('seed', `${Math.floor(seed)}`);
  }

  appendNumberIfFinite(formData, 'cfg_scale', params.cfg_scale, { round: false });
  appendNumberIfFinite(formData, 'steps', params.steps, { min: 1 });
  appendIfPresent(formData, 'sampler', params.sampling_method);
  appendNumberIfFinite(formData, 'prompt_token_limit', params.promptTokenLimit, { min: 1 });
  appendNumberIfFinite(formData, 'samples', params.samples, { min: 1, max: 10 });

  const outputFormat = params.outputFormat || Constants?.endpoints?.imageGeneration?.stablediffusion?.defaultOutputFormat || 'png';
  formData.append('output_format', outputFormat);

  appendNumberIfFinite(formData, 'output_quality', params.outputQuality, { min: 1, max: 100 });
  appendIfPresent(formData, 'style_preset', params.stylePreset);
  appendIfPresent(formData, 'safety_filter', params.safetyFilter);

  const requestOptions = {
    method: "POST",
    headers,
    body: formData,
  };

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${normalizedBaseUrl}/${endpoint}`;

  if (Constants.debug.logImageGen) {
    console.log("Stable Diffusion request url:", url);
    console.log("Stable Diffusion model:", modelId || endpoint);
    console.log("Stable Diffusion payload keys:", Array.from(formData.keys()));
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const failResponse = await response.text();
    const message = `stable diffusion API failure: status=${response.status}, response=${failResponse}`;
    console.error(message);
    throw new Error(message);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (Constants.debug.logImageGen) {
    console.log("Stable Diffusion response size (bytes):", buffer.length);
  }

  return {
    buffer,
    metadata: buildRequestMetadata(response, modelId || endpoint, endpoint),
  };
}

export default {
  doTxt2ImgRequest
};
