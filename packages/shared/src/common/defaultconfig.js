import { isBackend } from './nexthelpers';

export const defaultConstants = {
    "engineVersion": 1,
    "source": "local",
    "hiddenFields": [
        "params.apiKey",
        "params.serverUrl"
    ],
    "allowedInputTypes": [
        "text"
    ],
    "defaults": {
        "userTokenLimit": 100
    },
    "privateVersionFields": [
        "params.serverUrl",
        "params.apiKey"
    ],
    "models": {
        "llm": {
            "gpt-4o": {
                "label": "GPT-4o",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "gpt-4o-mini": {
                "label": "GPT-4o-mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "o1-preview": {
                "label": "o1 Preview",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "o1-mini": {
                "label": "o1 Mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "gpt-4": {
                "label": "GPT-4",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "gpt-4-turbo": {
                "label": "GPT-4-turbo",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/completions"
            },
            "claude-3-5-sonnet-20240620": {
                "label": "Claude 3.5 Sonnet",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-3-opus-20240229": {
                "label": "Claude 3 Opus",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "gemini-1.5-flash": {
                "label": "Gemini 1.5-flash",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "<google>"
            },
            "llama-2-13b-chat": {
                "label": "Llama 2 13B Chat",
                "defaultInputFormat": "llama2",
                "defaultOutputFormat": "text"
            },
            "dolphin-2.2.1-mistral-7B": {
                "label": "Dolphin 2.2.1 Mistral 7B",
                "defaultInputFormat": "chatml",
                "defaultOutputFormat": "text"
            },
            "mistral-7b-instruct-v0.1": {
                "label": "Mistral 7B Instruct v0.1",
                "defaultInputFormat": "instruct",
                "defaultOutputFormat": "text"
            },
            "Airoboros-L2-13B-3.1.1": {
                "label": "Airoboros L2 13B 3.1.1",
                "defaultInputFormat": "llama2",
                "defaultOutputFormat": "text"
            }
        },
        "imageGeneration": {
            "stablediffusion": {
                "label": "Stable Diffusion",
                "defaultUrl": "http://img.playday.ai:7880/sdapi/v1/txt2img",
                "defaultModel": "sdxl-1",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            },
            "openai": {
                "label": "OpenAI",
                "defaultUrl": "https://api.openai.com/v1/images",
                "defaultModel": "dall-e-3",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            }
        },
        "audioGeneration": {
            "elevenlabs": {
                "label": "Eleven Labs",
                "defaultUrl": "https://api.elevenlabs.io/v1/text-to-speech",
                "defaultModel": "eleven_multilingual_v2"
            },
            "openai": {
                "label": "OpenAI",
                "defaultUrl": "https://api.openai.com/v1/tts",
                "defaultModel": "tts-1"
            }
        }
    },
    "endpoints": {
        "llm": {
            "openai": {
                "models": [
                    "gpt-4o",
                    "gpt-4o-mini",
                    "o1-preview",
                    "o1-mini",
                    "gpt-4",
                    "gpt-4-turbo"
                ],
                "label": "OpenAI API",
                "type": "openai",
                "defaultModel": "gpt-4o",
                "defaultUrl": "https://api.openai.com/v1/completions",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "anthropic": {
                "models": [
                    "claude-3-5-sonnet-20240620",
                    "claude-3-opus-20240229"
                ],
                "label": "Claude 3",
                "type": "anthropic",
                "defaultModel": "claude-3-sonnet-20240620",
                "defaultUrl": "https://api.anthropic.com/v1/messages",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:anthropicKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "google": {
                "models": [
                    "gemini-1.5-flash"
                ],
                "label": "Gemini 1.5-flash",
                "type": "google",
                "defaultModel": "gemini-1.5-flash",
                "defaultUrl": "<google>",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:googleLLMKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "llm.playday.ai-webui": {
                "models": [
                    "llama-2-13b-chat",
                    "dolphin-2.2.1-mistral-7B",
                    "mistral-7b-instruct-v0.1",
                    "Airoboros-L2-13B-3.1.1"
                ],
                "label": "PlayDay.ai WebUI Endpoint",
                "type": "local",
                "defaultModel": "dolphin-2.2.1-mistral-7B",
                "defaultUrl": "http://llm.playday.ai:5000/v1/completions",
                "defaultInputFormat": "chatml"
            }
        },
        "imageGeneration": {
            "stablediffusion": {
                "models": [
                    "core",
                    "sd3"
                ],
                "label": "Stable Diffusion",
                "type": "stablediffusion",
                "defaultUrl": "https://api.stability.ai/v2beta/stable-image/generate",
                "defaultAPIKey": "setting:stabilityAIKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                "defaultModel": "core",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            },
            "openai": {
                "models": [
                    "dall-e-3"
                ],
                "label": "OpenAI",
                "type": "openai",
                "defaultUrl": "https://api.openai.com/v1/images",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                "defaultModel": "dall-e-3",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            }
        },
        "audioGeneration": {
            "elevenlabs": {
                "models": [
                    "eleven_monolingual_v1",
                    "eleven_multilingual_v1",
                    "eleven_multilingual_v2",
                    "eleven_turbo_v2"
                ],
                "label": "Eleven Labs",
                "type": "elevenlabs",
                "defaultModel": "eleven_multilingual_v2",
                "defaultVoice": "Rachel",
                "defaultUrl": "https://api.elevenlabs.io/v1/text-to-speech",
                "defaultAPIKey": "setting:elevenLabsKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "openai": {
                "models": [
                    "tts-1"
                ],
                "label": "OpenAI",
                "type": "openai",
                "defaultModel": "tts-1",
                "defaultVoice": "alloy",
                "defaultUrl": "https://api.openai.com/v1/tts",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            }
        }
    },
    "modelRequestFormats": {
        "inputOptions": [
            "chatgpt",
            "anthropic",
            "simplechat",
            "instruct",
            "chatinstruct",
            "json",
            "llama2",
            "metharme",
            "chatml"
        ],
        "outputOptions": [
            "text",
            "json"
        ]
    },
    "defaultMessageFilter": [
        "user",
        "assistant",
        "image"
    ],
    "defaultDebugSettings": {
        "singleStep": false,
        "seedOverrideEnabled": false,
        "seedOverrideValue": -1,
        "messageFilters": [
            "user",
            "assistant",
            "image"
        ]
    },
    "scrollingModeOptions": {
        "noScrolling": "No scrolling",
        "messageComplete": "Scroll on completed message",
        "lineByLine": "Scroll line by line"
    },
    "defaultScrollingMode": "messageComplete",
    "defaultAccountInfo": {
        "profile": {},
        "preferences": {
            "editMode": true
        }
    },
    "features": {
        "suggestions": {
            "outputDataField": {
                "instructions": "A list of 4 different plausible and specific options for what the player could do next, each of them brief, from the player's POV",
                "dataType": "array",
                "variableName": "suggestions",
                "passType": "postProcess"
            }
        }
    },
    "userRoles": [
        "admin",
        "creator",
        "consumer",
        "guest"
    ],
    "userRoleDisplayNames": {
        "admin": "Administrators",
        "individuals": "Specific people",
        "creator": "Fellow creators",
        "consumer": "PlayDay early access users",
        "guest": "Anyone"
    },
    "gameRoles": [
        "game_owner",
        "game_editor",
        "game_sourceViewer",
        "game_player"
    ],
    "gamePermissions": [
        "game_play",
        "game_viewSource",
        "game_modifyPermissions",
        "game_viewUserSessions",
        "game_viewTrainingData",
        "game_viewUsageData",
        "game_edit",
        "game_delete"
    ],
    "servicePermissions": [
        "service_guestAccess",
        "service_basicAccess",
        "service_editMode",
        "service_modifyGlobalPermissions"
    ],
    "validRecordStates": [
        "started",
        "completed",
        "failed",
        "waitingForExternalInput",
        "waitingForSubtree"
    ],
    "audioPlaybackTypes": [
        {
            "value": "speech",
            "label": "Speech"
        },
        {
            "value": "backgroundMusic",
            "label": "Background Music"
        },
        {
            "value": "soundEffect",
            "label": "Sound Effect"
        }
    ],
    "audioRecordingDefaults": {
        "audioDuckingMode": "on_speaking",
        "onlyRecordOnSpeaking": true,
        "continuousRecording": false,
        "echoCancellation": false,
        "debug": true,
        "timeSlice": 200,
        "speechInterval": 50,
        "speechThreshold": -60,
        "silenceTimeout": 1000,
        "speechDetectMode": "vad",
        "minimumSpeechDuration": 600,
        "audioSessionType": "play-and-record",
        "audioSessionChangeDelay": 200
    },
    "supportedMimeTypes": [
        "audio/mpeg",
        "audio/webm",
        "audio/mp3",
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "text/plain"
    ],
    "debug": {
        "logAICalls": false,
        "logAudioPlayback": false,
        "logAssistantPrompts": false,
        "logCode": false,
        "logCodeEditor": false,
        "logCompression": false,
        "logContextNodes": false,
        "logDataParsing": false,
        "logDataPasses": false,
        "logFlowControl": false,
        "logForLoop": false,
        "logIfThenElse": false,
        "logImageGen": false,
        "logImagePromptGen": false,
        "logInit": true,
        "logPlayPhases": false,
        "logPermissions": false,
        "logPubSub": false,
        "logRabbitMQ": false,
        "logRetryLogic": false,
        "logScenarios": false,
        "logSessionRestart": false,
        "logStateMachine": false,
        "logStateManager": false,
        "logStreamingMessages": false,
        "logSTT": false,
        "logSuggestions": false,
        "logTaskSystem": false,
        "logTTS": false,
        "logVersionDiffs": false,
        "logVersionEditor": false,
        "logWhileLoop": false
    },
    "config": {
        "hardCodedStepLimit": 100,
        "sessionUpdateTimeout": 90000,
        "sessionUpdateRetryTime": 5000,
        "clientFailureRetryTime": 5000,
        "taskDefaultExpirationTimeMS": 300000,
        "sessionPubSub": {
            "inactivityTimeout": 10 * 60 * 1000
        },
        "sandboxLLMBlockingUrl": "http://127.0.0.1:4000/v1/completions",
        "sandboxLLMStreamingUrl": "http://127.0.0.1:4000/v1/completions"
    }
};


let loadedConstants = null;

async function fetchConstants() {
    if (isBackend()) {
        return defaultConstants;
    }

    try {
        const response = await fetch('/api/getconfig');
        const data = await response.json();
        if (response.status !== 200) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data.Constants;
    } catch (error) {
        console.error("Error fetching constants:", error);
        return defaultConstants;
    }
}

export async function getConstants() {
    if (loadedConstants === null) {
        loadedConstants = await fetchConstants();
    }
    return loadedConstants;
}

export const Constants = new Proxy({}, {
    get: (target, prop) => {
        if (loadedConstants) {
            return loadedConstants[prop];
        }
        return defaultConstants[prop];
    },
    set: (target, prop, value) => {
        if (loadedConstants) {
            loadedConstants[prop] = value;
        } else {
            defaultConstants[prop] = value;
        }
        return true;
    }
});

export const defaultConfig = { 
    Constants: defaultConstants 
};
