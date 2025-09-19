import AddCircleIcon from '@mui/icons-material/AddCircle';
import ChatIcon from '@mui/icons-material/Chat';
import GavelIcon from '@mui/icons-material/Gavel';
import ShieldIcon from '@mui/icons-material/Shield';

export const VersionTemplates = [
    {
        label: "Empty",
        description: "An empty version with only an input node.",
        icon: <AddCircleIcon fontSize='large' />,
        nodes: [
            {
              "nodeType": "start",
              "instanceID": "start",
              "instanceName": "-> Start",
              "params": {
                "text": "Start of the conversation."
              }
            },
        ]
    },
    {
        label: "Basic Assistant",
        description: "A basic assistant that responds to user input.",
        icon: <ChatIcon fontSize='large' />,
        nodes: [
          {
            "nodeType": "start",
            "instanceID": "start",
            "instanceName": "-> Start",
            "params": {
              "text": "How can I help you today?"
            },
            "hideOutput": false,
            "personaLocation": {
              "source": "builtin",
              "personaID": "builtInAssistant"
            }
          },
          {
            "nodeType": "externalMultiInput",
            "instanceName": "User Input",
            "requireAllEventTriggers": false,
            "requireAllVariables": false,
            "params": {
              "supportedTypes": [
                "text"
              ],
              "tokenLimit": 400
            },
            "instanceID": "002",
            "personaLocation": {
              "source": "builtin",
              "personaID": "builtInUserInput"
            },
            "inputs": [
              {
                "includeHistory": false,
                "historyParams": {},
                "triggers": [
                  {
                    "producerEvent": "completed",
                    "targetTrigger": "default"
                  }
                ],
                "producerInstanceID": "start"
              }
            ]
          },
          {
            "nodeType": "llm",
            "instanceName": "Assistant",
            "instanceID": "003",
            "requireAllEventTriggers": true,
            "requireAllVariables": false,
            "inputs": [
              {
                "includeHistory": true,
                "historyParams": {
                  "spanSelectionMode": "full",
                  "ignoreCompression": false,
                  "includeDeleted": false,
                  "includeFailed": false,
                  "includedNodes": []
                },
                "triggers": [
                  {
                    "producerEvent": "completed",
                    "targetTrigger": "default"
                  }
                ],
                "producerInstanceID": "002"
              }
            ],
            "params": {
              "context": "",
              "zerothTurnInstructions": "",
              "turnInstructions": "",
              "model": "gpt-4o",
              "inputFormat": "chatinstruct",
              "outputFormat": "text",
              "temperature": 0.9,
              "newTokenTarget": 500,
              "tokenLimit": 4096,
              "top_p": 0.92,
              "top_k": 7,
              "repetition_penalty": 1.1,
              "serverUrl": "https://api.openai.com/v1/completions",
              "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
              "endpoint": "openai",
              "streaming": true,
            },
            "properties": {
              "reviewable": true
            },
            "hideOutput": false,
            "personaLocation": {
              "source": "builtin",
              "personaID": "builtInAssistant"
            }
          },
        ]
    },
];