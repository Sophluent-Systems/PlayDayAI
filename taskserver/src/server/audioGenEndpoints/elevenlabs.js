import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getAccountServiceKey } from "@src/backend/accounts";

const DEFAULT_MODEL = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const LEGACY_VOICE_NAME_HINTS = new Map([
  ["rachel", "21m00Tcm4TlvDq8ikWAM"],
]);

const voiceCacheByApiKey = new Map();
const voiceCachePromises = new Map();

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function isVoiceId(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return /^[a-zA-Z0-9]{16,}$/.test(trimmed);
}

async function preloadVoices(client, cacheKey) {
  if (!voiceCachePromises.has(cacheKey)) {
    voiceCachePromises.set(
      cacheKey,
      (async () => {
        const existingCache = voiceCacheByApiKey.get(cacheKey);
        const cache = existingCache instanceof Map ? existingCache : new Map();
        voiceCacheByApiKey.set(cacheKey, cache);

        try {
          const response = await client.voices.getAll();
          const voices = firstDefined(response?.voices, response?.data?.voices, []);

          for (const voice of voices) {
            if (!voice) {
              continue;
            }

            const voiceId = typeof voice.voiceId === "string" ? voice.voiceId.trim() : "";
            const name = typeof voice.name === "string" ? voice.name.trim() : "";

            if (voiceId.length > 0) {
              cache.set(voiceId.toLowerCase(), voiceId);
            }
            if (name.length > 0 && voiceId.length > 0) {
              cache.set(name.toLowerCase(), voiceId);
            }
          }
        } catch (error) {
          console.warn("Failed to preload ElevenLabs voices list", error);
        }

        return cache;
      })()
    );
  }

  try {
    return await voiceCachePromises.get(cacheKey);
  } catch (error) {
    voiceCachePromises.delete(cacheKey);
    throw error;
  }
}

async function resolveVoiceId(options) {
  const cacheKey = firstDefined(options.cacheKey, "default");
  const existingCache = voiceCacheByApiKey.get(cacheKey);
  const cache = existingCache instanceof Map ? existingCache : new Map();
  voiceCacheByApiKey.set(cacheKey, cache);

  let candidate = options.requestedVoice;
  if (nullUndefinedOrEmpty(candidate)) {
    candidate = options.fallbackVoice;
  }
  if (nullUndefinedOrEmpty(candidate)) {
    return undefined;
  }

  const trimmed = String(candidate).trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (isVoiceId(trimmed)) {
    cache.set(trimmed.toLowerCase(), trimmed);
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();

  if (LEGACY_VOICE_NAME_HINTS.has(normalized)) {
    const hintedId = LEGACY_VOICE_NAME_HINTS.get(normalized);
    if (!nullUndefinedOrEmpty(hintedId)) {
      const hintedIdString = String(hintedId);
      cache.set(normalized, hintedIdString);
      cache.set(hintedIdString.toLowerCase(), hintedIdString);
      return hintedIdString;
    }
  }

  if (cache.has(normalized)) {
    return cache.get(normalized);
  }

  try {
    const populatedCache = await preloadVoices(options.client, cacheKey);
    if (populatedCache && populatedCache.has(normalized)) {
      return populatedCache.get(normalized);
    }
  } catch (error) {
    console.warn("Unable to resolve ElevenLabs voice name via API", error);
  }

  return undefined;
}

async function readableStreamToBuffer(stream) {
  if (!stream) {
    throw new Error("ElevenLabs returned an empty audio stream");
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  if (typeof stream.arrayBuffer === "function") {
    const arrayBuffer = await stream.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks = [];

    try {
      while (true) {
        const result = await reader.read();
        if (result.done) {
          break;
        }
        if (result.value) {
          chunks.push(Buffer.from(result.value));
        }
      }
    } finally {
      if (typeof reader.releaseLock === "function") {
        reader.releaseLock();
      }
    }

    return Buffer.concat(chunks);
  }

  if (Symbol.asyncIterator in stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported ElevenLabs stream type");
}

function buildVoiceSettings(params) {
  const directSettings = params.voiceSettings || params.voice_settings;
  if (directSettings && typeof directSettings === "object") {
    return directSettings;
  }

  const stability = params.stability;
  const similarityBoost = firstDefined(params.similarityBoost, params.similarity_boost);
  const style = params.style;
  const useSpeakerBoost = firstDefined(params.useSpeakerBoost, params.use_speaker_boost);

  const settings = {};

  if (typeof stability === "number") {
    settings.stability = stability;
  }
  if (typeof similarityBoost === "number") {
    settings.similarityBoost = similarityBoost;
  }
  if (typeof style === "number") {
    settings.style = style;
  }
  if (typeof useSpeakerBoost === "boolean") {
    settings.useSpeakerBoost = useSpeakerBoost;
  }

  return Object.keys(settings).length > 0 ? settings : undefined;
}

function selectOutputFormat(params, constants) {
  return firstDefined(
    params.outputFormat,
    params.output_format,
    constants?.audioGeneration?.elevenlabs?.defaultOutputFormat,
    DEFAULT_OUTPUT_FORMAT
  );
}

function formatToMimeType(format) {
  if (nullUndefinedOrEmpty(format)) {
    return "audio/mpeg";
  }

  const codec = format.split("_")[0].toLowerCase();

  switch (codec) {
    case "mp3":
      return "audio/mp3";
    case "pcm":
    case "wav":
      return "audio/wav";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "ulaw":
    case "mulaw":
      return "audio/basic";
    case "aac":
      return "audio/aac";
    default:
      return "audio/mpeg";
  }
}

function extractPronunciationLocators(params) {
  const locators = firstDefined(
    params.pronunciationDictionaryLocators,
    params.pronunciation_dictionary_locators,
    params.pronunciationDictionaryLocator,
    params.pronunciationDictionary
  );

  if (Array.isArray(locators) && locators.length > 0) {
    return locators;
  }

  return undefined;
}

function sanitizeBoolean(value) {
  return typeof value === "boolean" ? value : undefined;
}

function sanitizeNumber(value) {
  return typeof value === "number" ? value : undefined;
}

async function doTxt2AudioRequest(params) {
  const keySource = params.keySource;
  const constants = Config.Constants;

  let apiKeyToUse = params.apiKey;
  if (keySource && keySource.source === "account") {
    apiKeyToUse = getAccountServiceKey(keySource.account, "elevenLabsKey");
  }

  if (nullUndefinedOrEmpty(apiKeyToUse)) {
    throw new Error("ElevenLabs API key is required to generate audio");
  }

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKeyToUse,
  });

  const modelId = firstDefined(
    params.model,
    params.modelId,
    constants?.audioGeneration?.elevenlabs?.defaultModel,
    DEFAULT_MODEL
  );

  const outputFormat = selectOutputFormat(params, constants);

  const voiceId = await resolveVoiceId({
    client: elevenlabs,
    requestedVoice: firstDefined(params.voiceId, params.voice),
    fallbackVoice: constants?.audioGeneration?.elevenlabs?.defaultVoice,
    cacheKey: apiKeyToUse,
  });

  if (nullUndefinedOrEmpty(voiceId)) {
    const attemptedVoice = firstDefined(params.voice, params.voiceId, "");
    throw new Error(
      'Unable to resolve ElevenLabs voice identifier for value "' + String(attemptedVoice) + '"'
    );
  }

  if (constants?.debug?.logTTS) {
    console.error("ElevenLabs TTS request:", {
      voiceId,
      modelId,
      outputFormat,
    });
  }

  const requestPayload = {
    text: params.text,
    modelId,
    outputFormat,
  };

  const voiceSettings = buildVoiceSettings(params);
  if (voiceSettings) {
    requestPayload.voiceSettings = voiceSettings;
  }

  const languageCode = firstDefined(params.languageCode, params.language);
  if (!nullUndefinedOrEmpty(languageCode)) {
    requestPayload.languageCode = languageCode;
  }

  const pronunciationLocators = extractPronunciationLocators(params);
  if (pronunciationLocators) {
    requestPayload.pronunciationDictionaryLocators = pronunciationLocators;
  }

  const seed = sanitizeNumber(params.seed);
  if (seed !== undefined) {
    requestPayload.seed = seed;
  }

  if (!nullUndefinedOrEmpty(params.previousText)) {
    requestPayload.previousText = params.previousText;
  }

  if (!nullUndefinedOrEmpty(params.nextText)) {
    requestPayload.nextText = params.nextText;
  }

  if (Array.isArray(params.previousRequestIds) && params.previousRequestIds.length > 0) {
    requestPayload.previousRequestIds = params.previousRequestIds;
  }

  if (Array.isArray(params.nextRequestIds) && params.nextRequestIds.length > 0) {
    requestPayload.nextRequestIds = params.nextRequestIds;
  }

  const optimizeStreamingLatency = sanitizeNumber(params.optimizeStreamingLatency);
  if (optimizeStreamingLatency !== undefined) {
    requestPayload.optimizeStreamingLatency = optimizeStreamingLatency;
  }

  const enableLogging = sanitizeBoolean(params.enableLogging);
  if (enableLogging !== undefined) {
    requestPayload.enableLogging = enableLogging;
  }

  const usePvcAsIvc = sanitizeBoolean(params.usePvcAsIvc);
  if (usePvcAsIvc !== undefined) {
    requestPayload.usePvcAsIvc = usePvcAsIvc;
  }

  if (!nullUndefinedOrEmpty(params.applyTextNormalization)) {
    requestPayload.applyTextNormalization = params.applyTextNormalization;
  }

  const applyLanguageTextNormalization = sanitizeBoolean(params.applyLanguageTextNormalization);
  if (applyLanguageTextNormalization !== undefined) {
    requestPayload.applyLanguageTextNormalization = applyLanguageTextNormalization;
  }

  if (constants?.debug?.logTTS) {
    console.error("ElevenLabs payload prepared", requestPayload);
  }

  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, requestPayload);
  const audioBuffer = await readableStreamToBuffer(audioStream);

  if (constants?.debug?.logTTS) {
    console.error("ElevenLabs audio byte length", audioBuffer.length);
  }

  return {
    mimeType: formatToMimeType(outputFormat),
    data: audioBuffer,
    source: "buffer",
  };
}

export default {
  doTxt2AudioRequest,
};
