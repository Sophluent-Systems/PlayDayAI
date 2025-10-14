import { nullUndefinedOrEmpty } from "@src/common/objects";

const sharedNegativePrompt = "worst quality, low quality, jpeg artifacts, ugly, morbid, mutilated, extra fingers, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, extra limbs, cloned face, disfigured, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck";

function buildClamp(overrides = {}) {
  return {
    cfg_scale: { min: 0, max: 12 },
    steps: { min: 1, max: 50 },
    outputQuality: { min: 50, max: 100 },
    samples: { min: 1, max: 4 },
    ...overrides,
  };
}

function buildOverride(options = {}) {
  const {
    includeCfgScale = false,
    cfgScaleValues = [],
    stepsValues = [20],
    stylePresetValues = ["", "none"],
    extraPromptParamsValues = ["uhd, high quality"],
  } = options;

  const overrides = {};

  if (Array.isArray(extraPromptParamsValues) && extraPromptParamsValues.length) {
    overrides.extraPromptParams = extraPromptParamsValues;
  }
  if (Array.isArray(stepsValues) && stepsValues.length) {
    overrides.steps = stepsValues;
  }
  if (Array.isArray(stylePresetValues) && stylePresetValues.length) {
    overrides.stylePreset = stylePresetValues;
  }

  const cfgCandidates = [];
  if (includeCfgScale) {
    cfgCandidates.push(7);
  }
  if (Array.isArray(cfgScaleValues)) {
    cfgCandidates.push(...cfgScaleValues);
  }
  if (cfgCandidates.length) {
    overrides.cfg_scale = Array.from(new Set(cfgCandidates));
  }

  return overrides;
}

export const stableDiffusionGuardrails = {
  "sd3.5-large": {
    defaults: {
      extraPromptParams: "photorealistic, ultra detailed, 8k uhd, sharp focus, studio lighting, award-winning",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 4,
      steps: 28,
      sampling_method: "DPM++ 2M (SGM Uniform)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      cfgScaleValues: [7],
    }),
    clamp: buildClamp(),
  },
  "sd3.5-large-turbo": {
    defaults: {
      extraPromptParams: "photorealistic, cinematic lighting, high detail, crisp focus",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 1,
      steps: 4,
      sampling_method: "Euler (SGM Uniform)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [5.5],
      stepsValues: [22, 24],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 12 },
    }),
  },
  "sd3.5-medium": {
    defaults: {
      extraPromptParams: "photorealistic, finely detailed, 8k resolution, volumetric lighting",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 3.5,
      steps: 28,
      sampling_method: "Euler",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [6.5, 6],
      stepsValues: [24, 26],
    }),
    clamp: buildClamp({
      steps: { min: 1, max: 40 },
    }),
  },
  "sd3.5-flash": {
    defaults: {
      extraPromptParams: "clean details, photorealistic, balanced lighting, high resolution",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 1,
      steps: 4,
      sampling_method: "Euler",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [5],
      stepsValues: [12, 16, 18],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 12 },
    }),
  },
  "sd3-large": {
    defaults: {
      extraPromptParams: "photorealistic, ultra detailed, 8k, dramatic lighting, crisp focus",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 4,
      steps: 28,
      sampling_method: "DPM++ 2M (SGM Uniform)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      cfgScaleValues: [7],
      stepsValues: [24, 26],
    }),
    clamp: buildClamp(),
  },
  "sd3-large-turbo": {
    defaults: {
      extraPromptParams: "high detail, cinematic lighting, crisp focus, vivid rendering",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 1,
      steps: 4,
      sampling_method: "Euler (SGM Uniform)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [5.5],
      stepsValues: [18, 20, 22],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 12 },
    }),
  },
  "sd3-medium": {
    defaults: {
      extraPromptParams: "high quality, detailed, photorealistic, balanced studio lighting",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 4,
      steps: 25,
      sampling_method: "Euler",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [6],
      stepsValues: [20, 22, 24],
    }),
    clamp: buildClamp({
      steps: { min: 1, max: 40 },
    }),
  },
  "sd3-flash": {
    defaults: {
      extraPromptParams: "clean render, detailed, vibrant lighting, crisp edges",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 1,
      steps: 4,
      sampling_method: "Euler",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [4.5, 4],
      stepsValues: [12, 14, 16],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 12 },
    }),
  },
  core: {
    defaults: {
      extraPromptParams: "clean concept art, cohesive color palette, production-ready render",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: null,
      steps: null,
      sampling_method: null,
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [5],
      stepsValues: [18, 20, 26],
      stylePresetValues: ["digital-art", "digital art"],
    }),
    clamp: buildClamp(),
  },
  "sdxl-1.0": {
    defaults: {
      extraPromptParams: "masterpiece, ultra high resolution, photorealistic, intricate details, 8k",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 7,
      steps: 30,
      sampling_method: "DPM++ 2M Karras",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [6.5],
      stepsValues: [24, 26],
    }),
    clamp: buildClamp({
      steps: { min: 10, max: 60 },
    }),
  },
  "sdxl-lightning": {
    defaults: {
      extraPromptParams: "stylized, dynamic lighting, high detail, clean render",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 1,
      steps: 4,
      sampling_method: "Euler (SGM Uniform)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [3.5],
      stepsValues: [6, 8, 12],
      stylePresetValues: ["digital-art", "digital art"],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 8 },
    }),
  },
  "sdxl-turbo": {
    defaults: {
      extraPromptParams: "sharp focus, photorealistic, detailed textures, balanced lighting",
      negativePrompt: sharedNegativePrompt,
      stylePreset: "photographic",
      safetyFilter: "moderate",
      aspectRatio: "1:1",
      width: 1024,
      height: 1024,
      cfg_scale: 2,
      steps: 4,
      sampling_method: "DPM++ SDE Karras",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [4.5, 4],
      stepsValues: [10, 12, 16],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 6 },
      steps: { min: 1, max: 12 },
    }),
  },
  "flux-pro": {
    defaults: {
      extraPromptParams: "photorealistic, ultra detailed, cinematic lighting, global illumination",
      negativePrompt: sharedNegativePrompt,
      stylePreset: null,
      safetyFilter: "moderate",
      aspectRatio: "16:9",
      width: 1344,
      height: 768,
      cfg_scale: 3.5,
      steps: 50,
      sampling_method: "Euler (FlowMatch)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [5.5],
      stepsValues: [20, 24, 30],
      stylePresetValues: ["photographic", "digital-art", "digital art"],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 6 },
      steps: { min: 10, max: 60 },
    }),
  },
  "flux-fast": {
    defaults: {
      extraPromptParams: "clean render, stylized, detailed, cinematic lighting",
      negativePrompt: sharedNegativePrompt,
      stylePreset: null,
      safetyFilter: "moderate",
      aspectRatio: "16:9",
      width: 1344,
      height: 768,
      cfg_scale: 0,
      steps: 4,
      sampling_method: "Euler (FlowMatch)",
      outputFormat: "png",
      outputQuality: 90,
      samples: 1,
    },
    overrideLegacyValues: buildOverride({
      includeCfgScale: true,
      cfgScaleValues: [4, 3.5],
      stepsValues: [12, 14, 16],
      stylePresetValues: ["digital-art", "digital art", "photographic"],
    }),
    clamp: buildClamp({
      cfg_scale: { min: 0, max: 4 },
      steps: { min: 1, max: 12 },
    }),
  },
};

function normalizeComparisonTarget(value) {
  if (value === null || typeof value === "undefined") {
    return { type: "null", value: null };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { type: "number", value }
      : { type: "string", value: String(value).trim().toLowerCase() };
  }

  if (typeof value === "boolean") {
    return { type: "number", value: value ? 1 : 0 };
  }

  const stringValue = String(value).trim();
  if (stringValue.length === 0) {
    return { type: "empty", value: "" };
  }

  const numeric = Number(stringValue);
  if (!Number.isNaN(numeric)) {
    return { type: "number", value: numeric };
  }

  return { type: "string", value: stringValue.toLowerCase() };
}

function valuesEqual(left, right) {
  const normalizedLeft = normalizeComparisonTarget(left);
  const normalizedRight = normalizeComparisonTarget(right);

  if (normalizedLeft.type === "number" && normalizedRight.type === "number") {
    return normalizedLeft.value === normalizedRight.value;
  }

  if (normalizedLeft.type === "null" && normalizedRight.type === "null") {
    return true;
  }

  return normalizedLeft.value === normalizedRight.value;
}

function matchesLegacyValue(currentValue, legacyList) {
  if (!Array.isArray(legacyList) || legacyList.length === 0) {
    return false;
  }

  return legacyList.some((legacyValue) => valuesEqual(currentValue, legacyValue));
}

function shouldApplyDefault(currentValue, recommendedValue, legacyList = []) {
  if (valuesEqual(currentValue, recommendedValue)) {
    return false;
  }

  if (recommendedValue === null) {
    return matchesLegacyValue(currentValue, legacyList);
  }

  if (nullUndefinedOrEmpty(currentValue)) {
    return true;
  }

  return matchesLegacyValue(currentValue, legacyList);
}

function clampIfNeeded(value, bounds = {}) {
  if (value === null || typeof value === "undefined") {
    return { applied: false, value };
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { applied: false, value };
  }

  let clamped = numeric;

  if (typeof bounds.min === "number" && clamped < bounds.min) {
    clamped = bounds.min;
  }

  if (typeof bounds.max === "number" && clamped > bounds.max) {
    clamped = bounds.max;
  }

  if (clamped === numeric) {
    return { applied: false, value: numeric };
  }

  return { applied: true, value: clamped };
}

export function applyStableDiffusionGuardrail(modelId, params = {}) {
  const guardrail = stableDiffusionGuardrails[modelId];
  const source = params ?? {};

  if (!guardrail) {
    return { ...source };
  }

  const result = { ...source };
  const defaults = guardrail.defaults ?? {};
  const overrideLegacyValues = guardrail.overrideLegacyValues ?? {};

  for (const [key, recommendedValue] of Object.entries(defaults)) {
    const legacyCandidates = overrideLegacyValues[key] ?? [];
    if (shouldApplyDefault(source[key], recommendedValue, legacyCandidates)) {
      result[key] = recommendedValue;
    }
  }

  const clamp = guardrail.clamp ?? {};
  for (const [key, bounds] of Object.entries(clamp)) {
    const currentValue = result[key];
    const { applied, value: clampedValue } = clampIfNeeded(currentValue, bounds);
    if (applied) {
      result[key] = clampedValue;
    }
  }

  return result;
}

export function computeStableDiffusionGuardrailOverrides(modelId, params = {}) {
  const guardrail = stableDiffusionGuardrails[modelId];
  if (!guardrail) {
    return {};
  }

  const sanitized = applyStableDiffusionGuardrail(modelId, params);
  const managedKeys = new Set([
    ...Object.keys(guardrail.defaults ?? {}),
    ...Object.keys(guardrail.clamp ?? {}),
  ]);

  const updates = {};
  managedKeys.forEach((key) => {
    if (!valuesEqual(params?.[key], sanitized[key])) {
      updates[key] = sanitized[key];
    }
  });

  return updates;
}

export function getStableDiffusionGuardrail(modelId) {
  return stableDiffusionGuardrails[modelId] ?? null;
}
