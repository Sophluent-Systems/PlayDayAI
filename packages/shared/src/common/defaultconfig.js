import { isFrontend } from './nexthelpers';

const defaultConstantsJSON = `
{
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
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-5": {
                "label": "GPT-5",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-4.1": {
                "label": "GPT-4.1",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-4o-mini": {
                "label": "GPT-4o-mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-5-mini": {
                "label": "GPT-5 Mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-4.1-mini": {
                "label": "GPT-4.1 Mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-5-nano": {
                "label": "GPT-5 Nano",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "o1-preview": {
                "label": "o1 Preview",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "o1-mini": {
                "label": "o1 Mini",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "gpt-5-pro": {
                "label": "GPT-5 Pro",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.openai.com/v1/chat/completions"
            },
            "claude-sonnet-4-5-20250929": {
                "label": "Claude Sonnet 4.5",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-sonnet-4-20250514": {
                "label": "Claude Sonnet 4",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-3-7-sonnet-20250219": {
                "label": "Claude 3.7 Sonnet",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-opus-4-1-20250805": {
                "label": "Claude Opus 4.1",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-opus-4-20250514": {
                "label": "Claude Opus 4",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "claude-3-5-haiku-20241022": {
                "label": "Claude 3.5 Haiku",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://api.anthropic.com/v1/messages"
            },
            "gemini-2.5-pro": {
                "label": "Gemini 2.5 Pro",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models"
            },
            "gemini-2.5-flash": {
                "label": "Gemini 2.5 Flash",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models"
            },
            "gemini-2.5-flash-lite": {
                "label": "Gemini 2.5 Flash Lite",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models"
            },
            "gemini-2.0-flash": {
                "label": "Gemini 2.0 Flash",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models"
            },
            "gemini-2.0-flash-lite": {
                "label": "Gemini 2.0 Flash Lite",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models"
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
            },
            "gemma-2-27b-it": {
                "label": "Gemma 2 27B Instruct",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text"
            },
            "gemma-2-9b-it": {
                "label": "Gemma 2 9B Instruct",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text"
            },
            "gemma-2-2b-it": {
                "label": "Gemma 2 2B Instruct",
                "defaultInputFormat": "chatinstruct",
                "defaultOutputFormat": "text"
            }
        },
        "imageGeneration": {
            "stablediffusion": {
                "label": "Stable Diffusion",
                "defaultUrl": "https://api.stability.ai/v2beta/stable-image/generate",
                "defaultModel": "sd3.5-large",
                "defaultWidth": 1024,
                "defaultHeight": 1024,
                "defaultAspectRatio": "1:1",
                "defaultOutputFormat": "png",
                "defaultOutputQuality": 90,
                "supportedAspectRatios": [
                    "21:9",
                    "16:9",
                    "3:2",
                    "4:3",
                    "5:4",
                    "1:1",
                    "4:5",
                    "3:4",
                    "2:3",
                    "9:16"
                ]
            },
            "openai": {
                "label": "OpenAI",
                "defaultUrl": "https://api.openai.com/v1/images",
                "defaultModel": "gpt-image-1",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            },
            "imagen-4.0-pro": {
                "label": "Imagen 4 Pro",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-pro:generateImage",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            }
        },
        "audioGeneration": {
            "elevenlabs": {
                "label": "Eleven Labs",
                "defaultUrl": "https://api.elevenlabs.io/v1/text-to-speech",
                "defaultModel": "eleven_v3"
            },
            "openai": {
                "label": "OpenAI",
                "defaultUrl": "https://api.openai.com/v1/audio/speech",
                "defaultModel": "gpt-4o-mini-tts"
            },
           "openrouter": {
               "label": "OpenRouter",
               "defaultUrl": "https://openrouter.ai/api/v1/audio/speech",
               "defaultModel": "openrouter/gpt-4o-mini-tts"
           }
        },
        "stt": {
            "whisper-1": {
                "label": "Whisper 1",
                "defaultInputFormat": "audio",
                "defaultOutputFormat": "text"
            },
            "openrouter/whisper-large-v3": {
                "label": "OpenRouter Whisper Large v3",
                "defaultInputFormat": "audio",
                "defaultOutputFormat": "text"
            }
        },
        "videoGeneration": {
            "openai": {
                "models": [
                    "sora-2",
                    "sora-2-pro"
                ],
                "label": "OpenAI Sora",
                "type": "openai",
                "defaultModel": "sora-2",
                "defaultUrl": "https://api.openai.com/v1/videos",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            }
        },
        "agentFramework": {
            "microsoft-agent-framework": {
                "label": "Microsoft Agent Framework",
                "defaultInputFormat": "json",
                "defaultOutputFormat": "json"
            }
        },
        "agentKit": {
            "openai-agentkit-default": {
                "label": "AgentKit Default",
                "defaultUrl": "https://api.openai.com/v1/responses",
                "defaultModel": "gpt-4.1-mini"
            }
        },
        "computerUse": {
            "gemini-2.5-computer-use": {
                "label": "Gemini 2.5 Computer Use",
                "defaultInputFormat": "json",
                "defaultOutputFormat": "json"
            }
        },
        "search": {
            "perplexity-default": {
                "label": "Perplexity Search",
                "defaultUrl": "https://api.perplexity.ai/search",
                "defaultSnippetLimit": 5
            }
        }
    },
    "endpoints": {
        "llm": {
            "openai": {
                "models": [
                    "gpt-4o",
                    "gpt-5",
                    "gpt-4.1",
                    "gpt-4o-mini",
                    "gpt-5-mini",
                    "gpt-4.1-mini",
                    "gpt-5-nano",
                    "gpt-5-pro",
                    "o1-preview",
                    "o1-mini"
                ],
                "label": "OpenAI API",
                "type": "openai",
                "defaultModel": "gpt-5",
                "defaultUrl": "https://api.openai.com/v1/chat/completions",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "anthropic": {
                "models": [
                    "claude-sonnet-4-5-20250929",
                    "claude-sonnet-4-20250514",
                    "claude-3-7-sonnet-20250219",
                    "claude-opus-4-1-20250805",
                    "claude-opus-4-20250514",
                    "claude-3-5-haiku-20241022"
                ],
                "label": "Claude",
                "type": "anthropic",
                "defaultModel": "claude-sonnet-4-5-20250929",
                "defaultUrl": "https://api.anthropic.com/v1/messages",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:anthropicKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "google": {
                "models": [
                    "gemini-2.5-pro",
                    "gemini-2.5-flash",
                    "gemini-2.5-flash-lite",
                    "gemini-2.0-flash",
                    "gemini-2.0-flash-lite",
                    "gemma-2-27b-it",
                    "gemma-2-9b-it",
                    "gemma-2-2b-it"
                ],
                "label": "Gemini 2.5",
                "type": "google",
                "defaultModel": "gemini-2.5-pro",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:googleLLMKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "openrouter": {
                "models": [],
                "label": "OpenRouter",
                "type": "openrouter",
                "defaultModel": "mistralai/mistral-large",
                "defaultUrl": "https://openrouter.ai/api/v1/chat/completions",
                "defaultInputFormat": "chatinstruct",
                "defaultAPIKey": "setting:openRouterApiKey;sk-or-v1-xxxxxxxxxxxxxxxx",
                "modelSelectionType": "text",
                "modelPlaceholder": "e.g. mistralai/mistral-large",
                "modelTooltip": "Specify any OpenRouter model id"
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
                "defaultUrl": "http://llm.playday.ai:5000/v1/chat/completions",
                "defaultInputFormat": "chatml"
            }
        },
        "imageGeneration": {
            "stablediffusion": {
                "models": [
                    "sd3.5-large",
                    "sd3.5-large-turbo",
                    "sd3.5-medium",
                    "sd3.5-flash",
                    "sd3-large",
                    "sd3-large-turbo",
                    "sd3-medium",
                    "sd3-flash",
                    "core",
                    "sdxl-1.0",
                    "sdxl-lightning",
                    "sdxl-turbo",
                    "flux-pro",
                    "flux-fast"
                ],
                "label": "Stable Diffusion",
                "type": "stablediffusion",
                "defaultUrl": "https://api.stability.ai/v2beta/stable-image/generate",
                "defaultAPIKey": "setting:stabilityAIKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                "defaultModel": "sd3.5-large",
                "defaultWidth": 1024,
                "defaultHeight": 1024,
                "defaultAspectRatio": "1:1",
                "supportedAspectRatios": [
                    "21:9",
                    "16:9",
                    "3:2",
                    "4:3",
                    "5:4",
                    "1:1",
                    "4:5",
                    "3:4",
                    "2:3",
                    "9:16"
                ],
                "defaultOutputFormat": "png",
                "defaultOutputQuality": 90,
                "aspectRatioModels": [
                    "sd3.5-large",
                    "sd3.5-large-turbo",
                    "sd3.5-medium",
                    "sd3.5-flash",
                    "sd3-large",
                    "sd3-large-turbo",
                    "sd3-medium",
                    "sd3-flash",
                    "flux-pro",
                    "flux-fast"
                ]
            },
            "openai": {
                "models": [
                    "gpt-image-1",
                    "gpt-image-1-mini",
                    "dall-e-3"
                ],
                "label": "OpenAI",
                "type": "openai",
                "defaultUrl": "https://api.openai.com/v1/images",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                "defaultModel": "gpt-image-1",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            },
            "google": {
                "models": [
                    "imagen-4.0-pro"
                ],
                "label": "Google Imagen 4",
                "type": "google",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-pro:generateImage",
                "defaultAPIKey": "setting:googleLLMKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                "defaultModel": "imagen-4.0-pro",
                "defaultWidth": 1024,
                "defaultHeight": 1024
            }
        },
        "audioGeneration": {
            "elevenlabs": {
                "models": [
                    "eleven_v3",
                    "eleven_turbo_v2_5",
                    "eleven_turbo_v2",
                    "eleven_flash_v2_5",
                    "eleven_flash_v2",
                    "eleven_multilingual_v2"
                ],
                "label": "Eleven Labs",
                "type": "elevenlabs",
                "defaultModel": "eleven_v3",
                "defaultVoice": "Rachel",
                "defaultUrl": "https://api.elevenlabs.io/v1/text-to-speech",
                "defaultAPIKey": "setting:elevenLabsKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "openai": {
                "models": [
                    "gpt-4o-mini-tts",
                    "gpt-audio",
                    "gpt-audio-mini"
                ],
                "label": "OpenAI",
                "type": "openai",
                "defaultModel": "gpt-4o-mini-tts",
                "defaultVoice": "alloy",
                "defaultUrl": "https://api.openai.com/v1/audio/speech",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "openrouter": {
                "models": [
                    "openrouter/gpt-4o-mini-tts"
                ],
                "label": "OpenRouter",
                "type": "openrouter",
                "defaultModel": "openrouter/gpt-4o-mini-tts",
                "defaultVoice": "alloy",
                "defaultUrl": "https://openrouter.ai/api/v1/audio/speech",
                "defaultAPIKey": "setting:openRouterApiKey;sk-or-v1-xxxxxxxxxxxxxxxx"
            }
        },
        "stt": {
            "openai": {
                "models": [
                    "whisper-1",
                    "gpt-4o-transcribe"
                ],
                "label": "OpenAI Whisper",
                "type": "openai",
                "defaultModel": "whisper-1",
                "defaultUrl": "https://api.openai.com/v1/audio/transcriptions",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            },
            "openrouter": {
                "models": [
                    "openrouter/whisper-large-v3"
                ],
                "label": "OpenRouter Whisper",
                "type": "openrouter",
                "defaultModel": "openrouter/whisper-large-v3",
                "defaultUrl": "https://openrouter.ai/api/v1/audio/transcriptions",
                "defaultAPIKey": "setting:openRouterApiKey;sk-or-v1-xxxxxxxxxxxxxxxx"
            }
        },
        "videoGeneration": {
            "openai": {
                "models": [
                    "sora-2",
                    "sora-2-pro"
                ],
                "label": "OpenAI Sora",
                "type": "openai",
                "defaultModel": "sora-2",
                "defaultUrl": "https://api.openai.com/v1/videos",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            }
        },
        "training": {
            "tinker-fine-tune": {
                "label": "Tinker Fine-Tune",
                "defaultInputFormat": "json",
                "defaultOutputFormat": "json"
            }
        },
        "agentKit": {
            "openai": {
                "models": [
                    "gpt-4.1-mini",
                    "gpt-4.1",
                    "gpt-4.1-nano"
                ],
                "label": "OpenAI AgentKit",
                "type": "openai",
                "defaultModel": "gpt-4.1-mini",
                "defaultUrl": "https://api.openai.com/v1/responses",
                "defaultAPIKey": "setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            }
        },
        "agentFramework": {
            "microsoft": {
                "models": [
                    "microsoft-agent-framework"
                ],
                "label": "Microsoft Agent Framework",
                "type": "microsoft",
                "defaultModel": "microsoft-agent-framework",
                "defaultUrl": "https://agentframework.microsoft.com/api/run",
                "scope": "https://graph.microsoft.com/.default",
                "defaultAPIKey": "setting:microsoftAgentFrameworkClientSecret;xxxxxxxx-xxxxxxxx",
                "defaultClientId": "setting:microsoftAgentFrameworkClientId;xxxxxxxx-xxxxxxxx",
                "defaultTenantId": "setting:azureEntraTenantId;xxxxxxxx-xxxxxxxx"
            }
        },
        "computerUse": {
            "google": {
                "models": [
                    "gemini-2.5-computer-use"
                ],
                "label": "Gemini Computer Use",
                "type": "google",
                "defaultModel": "gemini-2.5-computer-use",
                "defaultUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-user:computerUse",
                "defaultAPIKey": "setting:googleLLMKey;sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            }
        },
        "training": {
            "tinker": {
                "models": [
                    "tinker-fine-tune"
                ],
                "label": "Tinker Training",
                "type": "tinker",
                "defaultModel": "tinker-fine-tune",
                "defaultUrl": "https://api.tinker.ai/v1/jobs",
                "statusUrl": "https://api.tinker.ai/v1/jobs",
                "defaultAPIKey": "setting:tinkerApiKey;tk-xxxxxxxxxxxxxxxx"
            }
        },
        "search": {
            "perplexity": {
                "models": [
                    "perplexity-default"
                ],
                "label": "Perplexity Search",
                "type": "perplexity",
                "defaultModel": "perplexity-default",
                "defaultUrl": "https://api.perplexity.ai/search",
                "defaultAPIKey": "setting:perplexityApiKey;px-xxxxxxxxxxxxxxxx"
            }
        },
        "ads": {
            "google": {
                "models": [
                    "google-ads-mcp"
                ],
                "label": "Google Ads MCP",
                "type": "google-ads",
                "defaultModel": "google-ads-mcp",
                "defaultUrl": "https://ads-mcp.example.com/query",
                "defaultAPIKey": "setting:googleAdsServiceAccountKey;{\\"provider\\":\\"google\\"}"
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
            "editMode": true,
            "openAIkey": "",
            "anthropicKey": "",
            "googleLLMKey": "",
            "stabilityAIKey": "",
            "elevenLabsKey": "",
            "openaiAgentKitWebhookSecret": "",
            "openaiConnectorRegistryKey": "",
            "microsoftAgentFrameworkClientId": "",
            "microsoftAgentFrameworkClientSecret": "",
            "azureAiFoundryEndpoint": "",
            "azureEntraTenantId": "",
            "googleAdsServiceAccountKey": "",
            "perplexityApiKey": "",
            "ibmApiConnectKey": "",
            "ibmApiConnectSecret": "",
            "tinkerApiKey": "",
            "tinkerWebhookSecret": "",
            "openRouterApiKey": "",
            "temporalCloudApiKey": ""
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
        "debug": false,
        "autoSendOnSpeechEnd": true,
        "timeSlice": 200,
        "speechInterval": 50,
        "speechThreshold": -60,
        "silenceTimeout": 1000,
        "speechDetectMode": "vad",
        "minimumSpeechDuration": 600,
        "audioSessionType": "play-and-record",
        "audioSessionChangeDelay": 200,
        "vad": {
            "assetBaseUrl": "/vad/",
            "onnxWasmBaseUrl": "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/",
            "model": "legacy",
            "positiveSpeechThreshold": 0.6,
            "negativeSpeechThreshold": 0.4,
            "redemptionMs": 1000,
            "minSpeechMs": 250,
            "preSpeechPadMs": 300,
            "submitUserSpeechOnPause": true
        }
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
        "stateMachine": true,
        "stateMachineDependencies": true,
        "stateMachineQueue": true,
        "stateMachineRecords": false,
        "stateMachineCursors": false,
        "stateMachineHistoryCache": false,
        "stateMachineGraph": false,
        "stateMachinePlanning": false,
        "stateMachineInputs": false,
        "stateMachineTriggers": false,
        "logStateManager": false,
        "logStreamingMessages": false,
        "logSTT": false,
        "logSuggestions": false,
        "logTaskSystem": false,
        "logTTS": false,
        "logVersionDiffs": false,
        "logVersionEditor": false,
        "logWhileLoop": false,
        "useLocalConfigOnly": false
    },
    "config": {
        "hardCodedStepLimit": 100,
        "sessionUpdateTimeout": 90000,
        "sessionUpdateRetryTime": 5000,
        "clientFailureRetryTime": 5000,
        "taskDefaultExpirationTimeMS": 300000,
        "taskScheduler": {
            "enableChangeStreams": false,
            "pollingIntervalMS": 1000,
            "logPolling": false
        },
        "sessionPubSub": {
            "inactivityTimeout": 600000
        },
        "sandboxLLMBlockingUrl": "http://127.0.0.1:4000/v1/chat/completions",
        "sandboxLLMStreamingUrl": "http://127.0.0.1:4000/v1/chat/completions",
        "inputTransport": {
            "websocketEnabled": true,
            "maxBufferedBytesPerInput": 10485760,
            "maxPendingInputsPerSession": 4,
            "inputChunkTimeoutMS": 15000
        },
        "stateMachine": {
            "aiPriorityNodeTypes": [
                "llm",
                "llmData",
                "imageGenerator",
                "tts",
                "stt",
                "audioPlayback"
            ],
            "maxIncrementalSyncsBeforeFullReload": 20,
            "historyCacheLimit": 200
        }
    }
}
`;

export const defaultConstants = JSON.parse(defaultConstantsJSON);


let loadedConstants = null;

async function fetchConstants() {
    if (!isFrontend()) {
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
