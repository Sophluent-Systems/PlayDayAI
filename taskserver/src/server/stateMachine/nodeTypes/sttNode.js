import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';
import { Config } from "@src/backend/config";
import { getBlobFromStorage } from '@src/backend/blobstorage';
import { getAccountServiceKey } from "@src/backend/accounts";

const OPENAI_TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_DEFAULT_MODEL = "whisper-1";
const OPENROUTER_TRANSCRIPTION_ENDPOINT = "https://openrouter.ai/api/v1/audio/transcriptions";
const OPENROUTER_DEFAULT_MODEL = "openrouter/whisper-large-v3";

async function buildAudioBlob({ audio }, db) {
    if (!audio || typeof audio !== "object") {
        throw new Error("STT: audio parameter is required");
    }

    let blob;
    let fileName;

    if (audio.source === "storage") {
        const storageEntry = await getBlobFromStorage(db, audio.data);
        if (!storageEntry) {
            throw new Error("STT: Unable to fetch stored audio payload");
        }
        const buffer = Buffer.from(storageEntry.data, 'base64');
        const mimeType = storageEntry.mimeType || "audio/mpeg";
        const fileExtension = mimeType.split("/")[1] || "mpeg";
        fileName = `audio.${fileExtension}`;
        blob = new Blob([buffer], { type: mimeType, name: fileName });
    } else if (audio.source === "base64") {
        const mimeType = audio.mimeType || "audio/mpeg";
        const fileExtension = mimeType.split("/")[1] || "mpeg";
        fileName = `audio.${fileExtension}`;
        const buffer = Buffer.from(audio.data, 'base64');
        blob = new Blob([buffer], { type: mimeType, name: fileName });
    } else {
        throw new Error(`STT: Unsupported audio source "${audio.source}"`);
    }

    return { blob, fileName };
}

function resolveApiKey(provider, keySource, params) {
    const source = keySource?.source;
    if (provider === "openrouter") {
        if (source === "account") {
            return getAccountServiceKey(keySource.account, "openRouterApiKey");
        }
        return params.apiKey;
    }

    if (source === "account") {
        return getAccountServiceKey(keySource.account, "openAIkey");
    }
    return params.apiKey;
}

function resolveServerUrl(provider, params, Constants) {
    if (!nullUndefinedOrEmpty(params.serverUrl, true)) {
        return params.serverUrl;
    }
    if (provider === "openrouter") {
        return Constants.endpoints?.stt?.openrouter?.defaultUrl ?? OPENROUTER_TRANSCRIPTION_ENDPOINT;
    }
    return Constants.endpoints?.stt?.openai?.defaultUrl ?? OPENAI_TRANSCRIPTION_ENDPOINT;
}

function resolveModel(provider, params, Constants) {
    if (!nullUndefinedOrEmpty(params.model, true)) {
        return params.model;
    }
    if (provider === "openrouter") {
        return Constants.endpoints?.stt?.openrouter?.defaultModel ?? OPENROUTER_DEFAULT_MODEL;
    }
    return Constants.endpoints?.stt?.openai?.defaultModel ?? OPENAI_DEFAULT_MODEL;
}

function buildHeaders(provider, apiKey, Constants) {
    const headers = {
        Authorization: `Bearer ${apiKey}`,
    };

    if (provider === "openrouter") {
        const referer = Constants.config?.openRouter?.referer || process.env.OPENROUTER_REFERER;
        const clientTitle = Constants.config?.openRouter?.clientTitle || "PlayDayAI Taskserver";
        if (!nullUndefinedOrEmpty(referer, true)) {
            headers["HTTP-Referer"] = referer;
        }
        if (!nullUndefinedOrEmpty(clientTitle, true)) {
            headers["X-Title"] = clientTitle;
        }
    }

    return headers;
}

async function extractTranscription(response) {
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType.includes("application/json")) {
        const json = await response.json();
        if (typeof json.text === "string") {
            return json.text;
        }
        if (typeof json.transcript === "string") {
            return json.transcript;
        }
        if (Array.isArray(json.output)) {
            const textChunks = json.output
                .map((item) => item?.text ?? item?.output_text ?? item?.content)
                .filter((chunk) => !nullUndefinedOrEmpty(chunk, true));
            if (textChunks.length > 0) {
                return textChunks.join("\n");
            }
        }
        return JSON.stringify(json);
    }
    return await response.text();
}

export class sttNode extends nodeType {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    async runImpl({params, stateMachine, seed, keySource}) {
        const { Constants } = Config;

        Constants.debug.logSTT && console.error("STT: Running with params: ", params);

        if (nullUndefinedOrEmpty(params.audio)) {
            throw new Error("No audio file provided for speech-to-text conversion");
        }

        const provider = params.endpoint ?? "openai";
        const apiKey = resolveApiKey(provider, keySource, params);

        if (nullUndefinedOrEmpty(apiKey, true)) {
            throw new Error(`STT: Missing API key for provider "${provider}"`);
        }

        const { blob, fileName } = await buildAudioBlob(params, stateMachine.db);

        const formData = new FormData();
        formData.append("model", resolveModel(provider, params, Constants));
        formData.append("response_format", params.response_format ?? "text");
        formData.append("file", blob, fileName);

        if (!nullUndefinedOrEmpty(params.prompt, true)) {
            formData.append("prompt", params.prompt);
        }

        const headers = buildHeaders(provider, apiKey, Constants);

        const serverUrl = resolveServerUrl(provider, params, Constants);

        const response = await fetch(serverUrl, {
            method: "POST",
            body: formData,
            headers,
        });

        if (!response.ok) {
            const failureText = await response.text();
            console.error("STT: Provider failure", response.status, failureText);
            throw new Error(`STT provider error (${provider}): status=${response.status}`);
        }

        const responseText = await extractTranscription(response);

        Constants.debug.logSTT && console.error("STT: Response: ", responseText);

        return {
          state: "completed",
          eventsEmitted: ["completed"],
          output: {
              result: {
                  "text": responseText,
              },
          },
          context: {
              ...params,
              endpoint: provider,
              serverUrl,
          }
        };
    }
}
