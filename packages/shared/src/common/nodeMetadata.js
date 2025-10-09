import { Constants } from "@src/common/defaultconfig";
import { nullUndefinedOrEmpty } from "./objects";


export class nodeMetadata {
    constructor({ fullNodeDescription }) {
        this.fullNodeDescription = fullNodeDescription;
    }

    static parametersToCopy = [];

    static AllowedVariableOverrides = {};

    static nodeAttributes = {
        addable: false,
        defaultOutputField: "result",
    };

    static events = [
        "completed",
    ];

    static triggers = [
        "default",
    ]

    static inputTemplate = {
        "includeHistory": false,
        "historyParams": {},
    }

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return [
            "result",
        ];
    }

    static initMenu = [];

    static defaultPersona = "builtInDebug";

    static newNodeTemplate = {};
}

export class contextAwareMetadata extends nodeMetadata {
    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            contextAware: true,
        };
    }
}

export class externalTextInputMetadata extends nodeMetadata {

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "External Text Input",
            tooltip: "Get input from an external source",
            mediaTypes: ["text"],
            userInput: true,
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "User Input Node",
        },
      ];

    static newNodeTemplate = {
        nodeType: "externalTextInput",
        instanceName: "User Input",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        params: {
            supportedTypes: ["text"],
            "tokenLimit": 90,
        }
    };

    static defaultPersona = "builtInUserInput";
}

export class externalMultiInputMetadata extends nodeMetadata {

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "External Multi Input",
            tooltip: "Get input from an external source",
            mediaTypes: ["text", "audio", "image", "video"],
            userInput: true,
        };
    }

    static events = [
        "completed",
        "on_text",
        "on_audio",
        "on_image",
        "on_video",
    ];

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "User Input Node",
        },
      ];

    static newNodeTemplate = {
        nodeType: "externalMultiInput",
        instanceName: "User Input",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        params: {
            supportedTypes: ["text", "audio"],
            "tokenLimit": 400,
        }
    };
    
    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        let outputs = !nullUndefinedOrEmpty(this.fullNodeDescription.params.supportedTypes) ? this.fullNodeDescription.params.supportedTypes : ["text"];

        return outputs;
    }

    static defaultPersona = "builtInUserInput";
}

export class codeBlockMetadata extends contextAwareMetadata {
    static parametersToCopy = [
        "code_UNSAFE",
    ];

    static AllowedVariableOverrides = {
        "data" : {
            label: "Data",
            mediaType: "composite",
        },
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Code Block",
            tooltip: "Run custom code",
            mediaTypes: ["data", "text"],
            codeExecutionResult: true,
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Code Block",
        },
        {
          label: "Code to run:",
          type: "codeEditor",
          path: "params.code_UNSAFE",
          tooltip: "Code to run",
          defaultValue: "",
        },
      ];

    static newNodeTemplate = {
        nodeType: "codeBlock",
        instanceName: "New Code Block",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        inputs: [],
        params: {
            "code_UNSAFE": "console.log('Hello, world!');",
        }, 
        properties: {
            "reviewable": true,
        },
    };
}

export class scenarioMetadata extends contextAwareMetadata {
    static parametersToCopy = [
        "scenarios",
    ];

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Scenario",
            tooltip: "Randomly select scenarios",
            mediaTypes: ["text"],
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Scenarios",
        },
        {
          label: "Scenarios",
          type: "scenarioEditor",
          path: "params.catalog",
          tooltip: "Scenarios",
          defaultValue: [],
        },
      ];

    static newNodeTemplate = {
        nodeType: "scenario",
        instanceName: "Scenarios",
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "catalog": [],
            "frequencyMin": 3,
            "frequencyMax": 10,
        }, 
        properties: {
            "reviewable": true,
        },
    };
}

export class flowControlMetadata extends contextAwareMetadata {
    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            flowControl: true,
        };
    }
}

export class forLoopMetadata extends flowControlMetadata {
    
    static AllowedVariableOverrides = {
        "start": {
            label: "Start",
            mediaType: "text",
        },
        "end": {
            label: "End",
            mediaType: "text",
        },
    };

    static events = [
        "completed",
        "loop"
    ];

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            defaultOutputField: "index",
            addable: true,
            label: "For loop",
            tooltip: "Run a block of nodes multiple times",
        };
    }
    

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["index"];
    }

    static initMenu = [
        {
          label: "From",
          type: "decimal",
          range: [0, 9999999],
          path: "params.start",
          defaultValue: 0,
          tooltip: "Starting value of the for loop.",
        },
        {
          label: "To",
          type: "decimal",
          range: [0, 9999999],
          path: "params.end",
          defaultValue: 10,
          tooltip: "Starting value of the for loop.",
        },
      ];

    static newNodeTemplate = {
        nodeType: "forLoop",
        instanceName: "For loop",
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "start": 0,
            "end": 10,
        }, 
        properties: {
            "reviewable": false,
        },
    };
}

export class ifThenElseMetadata  extends nodeMetadata {

    static AllowedVariableOverrides = {
        "value": {
            label: "Value",
            mediaType: "text",
        },
    };
    
    static events = [
        "completed",
        "then",
        "else"
    ];

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["value"];
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            defaultOutputField: "value",
            addable: true,
            label: "If / Then",
            tooltip: "Branch vased on the value of an input variable",
        };
    }

    static supportedComparators = [
        "==",
        "!=",
        ">",
        "<",
        ">=",
        "<=",
    ];

    static initMenu = [
        {
          label: "Comparison",
          path: "params.comparator",
          type: "dropdown",
          options: ifThenElseMetadata.supportedComparators.map((option) => {return {label: option, value: option}}),
          defaultValue: "==",
          tooltip: "Comparison operator to use to compare the two values.",
        },
        {
          label: "Comparison Value (uses JS eval)",
          type: "text",
          path: "params.compareValue",
          tooltip: "The value to compare against.",
          maxChar: 1000,
          multiline: false,
          defaultValue: "true",
        },
      ];

    static newNodeTemplate = {
        nodeType: "ifThenElse",
        instanceName: "If/Then",
        requireAllEventTriggers: false,
        requireAllVariables: true,
        inputs: [],
        params: {
            "value": "0",
            "comparator": "==",
            "compareValue": true,
        }, 
        properties: {
            "reviewable": true,
        },
    };
}

export class arrayIndexMetadata extends nodeMetadata {
    
    static AllowedVariableOverrides = {
        "array": {
            label: "Array",
            mediaType: "array",
        },
        "index": {
            label: "Index",
            mediaType: "text",
        },
    };

    static events = [
        "completed",
    ];

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            defaultOutputField: "result",
            addable: true,
            label: "Array Indexer",
            tooltip: "Produce the value of one index in an array",
        };
    }
    

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["result"];
    }

    static initMenu = [
      ];

    static newNodeTemplate = {
        nodeType: "arrayIndex",
        instanceName: "Array Indexer",
        requireAllEventTriggers: false,
        requireAllVariables: true,
        inputs: [],
        params: {
            "array": [],
        }, 
        properties: {
            "reviewable": false,
        },
    };
}

export class arrayIteratorMetadata extends flowControlMetadata {
    
    static AllowedVariableOverrides = {
        "array": {
            label: "Array",
            mediaType: "data",
        },
    };

    static events = [
        "completed",
        "loop"
    ];

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            defaultOutputField: "result",
            addable: true,
            label: "Array Iterator",
            tooltip: "Iterates through every value in an array in order",
        };
    }
    

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["index", "result"];
    }

    static initMenu = [
      ];

    static newNodeTemplate = {
        nodeType: "arrayIterator",
        instanceName: "Array Iterator",
        requireAllEventTriggers: false,
        requireAllVariables: true,
        inputs: [],
        params: {
            "array": [],
            "index": 0,
        }, 
        properties: {
            "reviewable": false,
        },
    };
}

export class whileLoopMetadata extends flowControlMetadata {
    
    static events = [
        "completed",
        "loop",
    ];

    static AllowedVariableOverrides = {
        "value": {
            label: "Value",
            mediaType: "text",
        },
    };

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["value"];
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            defaultOutputField: "value",
            addable: true,
            label: "While loop",
            tooltip: "Run a block of nodes multiple times",
        };
    }

    static supportedComparators = [
        "==",
        "!=",
        ">",
        "<",
        ">=",
        "<=",
    ];

    static initMenu = [
        {
          label: "Comparison",
          path: "params.comparator",
          type: "dropdown",
          options: ifThenElseMetadata.supportedComparators.map((option) => {return {label: option, value: option}}),
          defaultValue: "==",
          tooltip: "Comparison operator to use to compare the two values.",
        },
        {
          label: "Comparison Value (uses JS eval)",
          type: "text",
          path: "params.compareValue",
          tooltip: "The value to compare against.",
          maxChar: 1000,
          multiline: false,
          defaultValue: "true",
        },
      ];

    static newNodeTemplate = {
        nodeType: "whileLoop",
        instanceName: "While",
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "value": "0",
            "comparator": "==",
            "compareValue": true,
        }, 
        properties: {
            "reviewable": true,
        },
    };
}


export class imageGeneratorMetadata extends nodeMetadata {

    static parametersToCopy = [
        "serverUrl",
        "temperature",
        "width",
        "height",
        "extraPromptParams",
        "negativePrompt",
        "steps",
        "cfg_scale",
        "sampling_method",
        "promptTokenLimit",
        "apiKey",
    ];

    static AllowedVariableOverrides = {
        "prompt": {
            label: "Prompt",
            mediaType: "text",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Image Generator",
            tooltip: "Generate an image",
            mediaTypes: ["image"],
            isAIResponse: true,
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Image Generator",
        },
      ];

    static newNodeTemplate = {
        nodeType: "imageGenerator",
        instanceName: "New Image Generator",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        inputs: [],
        params: {
            "serverUrl": "https://api.openai.com/v1/images",
            "temperature": 0.7,
            "width": 1024,
            "height": 1024,
            "extraPromptParams": "uhd, high quality",
            "negativePrompt": "worst quality, low quality, jpeg artifacts, ugly, morbid, mutilated, extra fingers, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, extra limbs, cloned face, disfigured,  malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck",
            "steps": 20,
            "cfg_scale": 7,
            "sampling_method": "Euler a",
            "promptTokenLimit": 75,
            "seed": -1,
            "prompt": "An image of a dog in a field of flowers.",
            "endpoint": "openai",
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "model": "gpt-image-1"
        }, 
        properties: {
            "reviewable": true,
        },
    };

    static defaultPersona = "builtInAssistant";
}

export class llmMetadata extends nodeMetadata {
    static parametersToCopy = [
        "model",
        "inputFormat",
        "serverUrl",
        "endpoint",
        "apiKey"
    ];

    static AllowedVariableOverrides = {
        "context": {
            label: "Context",
            mediaType: "text",
        }
    };

    static inputTemplate = {
        "includeHistory": true,
        "historyParams": {
            "spanSelectionMode": "full",
            "ignoreCompression": false,
            "includeDeleted": false,
            "includeFailed": false,
            "includedNodes": [], // all
        },
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "LLM",
            tooltip: "Use a language model to generate text",
            mediaTypes: ["text"],
            canUseHistoryAsInput: true,
            isAIResponse: true,
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "AI Editor Node",
        },
        {
          label: "Instructions -- what should the AI do with the input it gets?",
          type: "text",
          path: "params.context",
          migratePath: "rules",
          tooltip: "This is the main assistant instructions.",
          maxChar: 16000,
          multiline: true,
          lines: 8,
          defaultValue: "Improve clarity, grammar, and structure of the user's text.",
        },
      ];

    static newNodeTemplate = {
        nodeType: "llm",
        instanceName: "New Assistant",
        canUseHistoryAsInput: true,
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
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
            "serverUrl": "https://api.openai.com/v1/chat/completions",
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "endpoint": "openai",
            "streaming": true,
        }, 
        properties: {
            "reviewable": true,
        }
    };

    static defaultPersona = "builtInAssistant";
}

export class llmDataMetadata extends llmMetadata {
    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "LLM Data (JSON output)",
            tooltip: "Use a language model to generate structured data",
            mediaTypes: ["text", "data"],
            canUseHistoryAsInput: true,
        };
    }

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        let outputs = [];
        const outputDataFields = this.fullNodeDescription.params?.outputDataFields;
        if (!nullUndefinedOrEmpty(outputDataFields)) {
            outputDataFields.forEach(dataField => {
                outputs.push(dataField.variableName);
            });
        }

        if (outputs.length == 0) {
            outputs.push("result");
        }

        return outputs;
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "AI Data Node",
        },
        {
          label: "Data fields to extract from the AI's output (comma separated):",
          type: "dataFieldsEditor",
          path: "params.outputDataFields",
          tooltip: "Data fields to request from the AI.",
          defaultValue: [],
        },
      ];

    static newNodeTemplate = {
        nodeType: "llmData",
        instanceName: "New Data AI",
        canUseHistoryAsInput: true,
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "context": "",
            "outputDataFields": [],
            "zerothTurnInstructions": "",
            "turnInstructions": "",
            "model": "gpt-5",
            "inputFormat": "chatinstruct",
            "outputFormat": "json",
            "temperature": 0.9,
            "newTokenTarget": 500,
            "tokenLimit": 4096,
            "top_p": 0.92,
            "top_k": 7,
            "repetition_penalty": 1.1,
            "serverUrl": "https://api.openai.com/v1/chat/completions",
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "endpoint": "openai",
            "streaming": true,
        }, 
        properties: {
            "reviewable": true,
        }
    };
    
    static defaultPersona = "builtInDebug";
}


export class fileStoreMetadata extends nodeMetadata {
    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "File Store",
            tooltip: "Make one ore more files available to other nodes",
            mediaTypes: ["text", "data", "image", "audio", "video"],
            canUseHistoryAsInput: false,
        };
    }

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        let outputs = ["array", "count"];
        const files = this.fullNodeDescription.params?.files;
        if (!nullUndefinedOrEmpty(files)) {
            files.forEach(file => {
                outputs.push(file.fileName);
            });
        }


        return outputs;
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "AI Data Node",
        },
        {
          label: "Files",
          type: "fileStoreEditor",
          path: "params.files",
          tooltip: "Files stored.",
          defaultValue: [],
        },
      ];

    static newNodeTemplate = {
        nodeType: "fileStore",
        instanceName: "File Store",
        canUseHistoryAsInput: false,
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "files": [],
        }, 
        properties: {
            "reviewable": false,
        }
    };
    
    static defaultPersona = "builtInDebug";
}

export class startMetadata extends nodeMetadata {
    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: false,
            label: "Start",
            tooltip: "The starting point of your flow",
            isSourceNode: true,
            mediaTypes: ["text"],
        };
    }

    static initMenu = [
        {
            label: "What should the welcome say?",
            type: "text",
            path: "params.text",
            maxChar: 2048,
            multiline: true,
            lines: 4,
            defaultValue: "Welcome! How can I help you?",
        }
      ];

    
      static defaultPersona = "builtInAssistant";
}

export class staticTextMetadata extends nodeMetadata {

    static AllowedVariableOverrides = {
        "text": {
            label: "Text",
            mediaType: "text",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Static Text",
            tooltip: "Display static text",
            mediaTypes: ["text"],
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Text Node",
        },
        {
            label: "What should the message say?",
            type: "text",
            path: "params.text",
            maxChar: 2048,
            multiline: true,
            lines: 4,
            defaultValue: "Just a reminder... [or whatever you want to say]",
        }
      ];

    static newNodeTemplate = {
        nodeType: "staticText",
        instanceName: "Static Text",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        params: {
            "text": "This is some text.",
        }
    };
    
    static defaultPersona = "builtInAssistant";
}


export class randomNumberMetadata extends nodeMetadata {

    static AllowedVariableOverrides = {
        "low": {
            label: "Low",
            mediaType: "text",
        },
        "high": {
            label: "High",
            mediaType: "text",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Random Number",
            tooltip: "Generate a random number",
            mediaTypes: ["text"],
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Random Number",
        },
        {
          label: "Low (inclusive)",
          type: "float",
          path: "params.low",
          range: [0, 1000000000],
          tooltip: "Low end of the random number range.",
          defaultValue: 0,
        },
        {
          label: "High (exclusive)",
          type: "float",
          path: "params.high",
          range: [0, 1000000000],
          tooltip: "High end of the random number range.",
          defaultValue: 1,
        },
        {
          label: "Number Type",
          type: "dropdown",
          path: "params.numberType",
          tooltip: "Type of number to generate.",
          options: ["integer", "float"].map((option) => {return {label: option, value: option}}),
          defaultValue: "integer",
        },
      ];

    static newNodeTemplate = {
        nodeType: "randomNumber",
        instanceName: "Random Number",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        params: {
            "low": "0",
            "high": "1",
            "numberType": "integer",
        }
    };
    
    static defaultPersona = "builtInDebug";
}

export class delayMetadata extends nodeMetadata {

    static AllowedVariableOverrides = {
        "delay": {
            label: "Delay",
            mediaType: "text",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Delay",
            tooltip: "Delay processing for a specified amount of time",
            mediaTypes: [],
        };
    }

    static initMenu = [
        {
            label: "Give this new entry a name to help you keep track of it (not shown to users):",
            type: "text",
            path: "instanceName",
            tooltip: "A unique name for your reference.",
            maxChar: 30,
            multiline: false,
            defaultValue: "Text Node",
        },
        {
          label: "Delay (Seconds)",
          type: "float",
          path: "params.delay",
          range: [0.25, 10000.0],
          tooltip: "Delay time in seconds.",
          defaultValue: 1,
        },
    ];

    static newNodeTemplate = {
        nodeType: "delay",
        instanceName: "Delay",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        params: {
            "delay": 1.0,
        }
    };
    
    static defaultPersona = "builtInDebug";
}

export class sttMetadata extends nodeMetadata {
    static parametersToCopy = [
        "serverUrl",
        "model",
        "apiKey",
    ];

    static AllowedVariableOverrides = {
        "audio": {
            label: "Audio",
            mediaType: "audio",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Speech to Text",
            tooltip: "Convert speech to text",
            mediaTypes: ["text"],
            isAIResponse: true,
        };
    }

    static initMenu = [
        {
          label: "A descriptive name for the node",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Speech to Text",
        },
      ];

    static newNodeTemplate = {
        nodeType: "stt",
        instanceName: "Speech to Text",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        inputs: [],
        params: {
            "serverUrl": "https://api.openai.com/v1/audio/transcriptions",
            "endpoint": "openai",
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "model": "gpt-4o-transcribe",
        }, 
        properties: {
            "reviewable": false,
        },
    };

    static defaultPersona = "builtInDebug";
}

export class ttsMetadata extends nodeMetadata {
    static parametersToCopy = [
        "serverUrl",
        "audio",
        "model",
        "speed",
        "apiKey",
    ];

    static AllowedVariableOverrides = {
        "text": {
            label: "Text",
            mediaType: "text",
        }
    };

    getOutputs() {
        if (!this.fullNodeDescription) {
            throw new Error("No fullNodeDescription in nodeMetadata");
        }

        return ["result", "text"];
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Text to Speech",
            tooltip: "Convert text to speech",
            mediaTypes: ["audio", "text"],
            isAIResponse: true,
        };
    }

    static initMenu = [
        {
          label: "A descriptive name for the node",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Text to Speech",
        },
      ];

    static newNodeTemplate = {
        nodeType: "tts",
        instanceName: "New Text to Speech",
        requireAllEventTriggers: false,
        requireAllVariables: false,
        inputs: [],
        params: {
            "serverUrl": "https://api.openai.com/v1/audio/speech",
            "text": "The quick brown fox jumped over the lazy dog.",
            "endpoint": "openai",
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "model": "tts-1",
            "voice": "alloy",
            "speed": 1,
        }, 
        properties: {
            "reviewable": true,
        },
    };

    static defaultPersona = "builtInDebug";
}


export class audioPlaybackMetadata extends nodeMetadata {

    static AllowedVariableOverrides = {
        "audio": {
            label: "Audio",
            mediaType: "audio",
        },
        "text": {
            label: "Text",
            mediaType: "text",
        }
    };

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Audio Playback",
            tooltip: "Play audio and optionally show text",
            mediaTypes: ["text", "audio"],
        };
    }

    static initMenu = [
        {
          label: "A descriptive name for the node",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Text to Speech",
        },
        {
            label: "Audio Type",
            type: "dropdown",
            path: "params.audioType",
            options: Constants.audioPlaybackTypes,
            defaultValue: "speech",
            tooltip: "Type of audio to play.",
        },
        {
            label: "Loop",
            type: "checkbox",
            path: "params.loop",
            defaultValue: false,
            tooltip: "Loop the audio.",
        },
        {
            label: "Autoplay",
            type: "dropdown",
            path: "params.autoplay",
            defaultValue: "onlyFirstTime",
            options: [
                {label: "Never", value: "never"},
                {label: "Only first time", value: "onlyFirstTime"},
                {label: "Always", value: "always"},
            ],
            tooltip: "Autoplay setting.",
        },
      ];

    static newNodeTemplate = {
        nodeType: "audioPlayback",
        instanceName: "Audio Playback",
        requireAllEventTriggers: false,
        requireAllVariables: true,
        params: {
            "audio": "",
            "text": "",
            hidden: false,
        }
    };

    static defaultPersona = "builtInAssistant";
}

export class imagePromptWriterMetadata extends llmMetadata {

    static inputTemplate = {
        "includeHistory": true,
        "historyParams": {
          "spanSelectionMode": "include",
          "ignoreCompression": false,
          "includeDeleted": false,
          "includeFailed": false,
          "includedNodes": [], //all
          "startingSpan": 0,
          "endingSpan": 1
        },
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Image Prompt Writer",
            tooltip: "Use a language model to generate an image prompt",
            mediaTypes: ["text"],
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Image Prompt Writer",
        },
        {
          label: "What kind of image should the AI generate?",
          type: "text",
          path: "params.context",
          migratePath: "rules",
          tooltip: "These are instructions guiding what keywords will be created.",
          maxChar: 16000,
          multiline: true,
          lines: 4,
          defaultValue: "Create a stylized comic book cel from the input.",
        },
      ];

    static newNodeTemplate = {
        nodeType: "llm",
        instanceName: "Image Prompt Maker",
        canUseHistoryAsInput: true,
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "context": "This is a prompt generator for image-generation tools like Stable Diffusion, based on the context below.",
            "zerothTurnInstructions": "Generate a prompt to be submitted to an image generator AI, in the form of a comma-separated list of keywords, conveying a scene that represents the most current events in the chat history. Format the response as a comma-delimited list of keyword phrases, with no other special characters or whitespace with no line breaks. 60 tokens max.",
            "turnInstructions": "Generate a prompt to be submitted to an image generator AI that describes a scene representing what's currently happening in the  chat (taking into account the full length of the chat for context but illustrating the latest events in the chat)., in the form of a comma-separated list of keywords. Be as specific and detailed as possible. Including the time period, region, setting, surroundings, characters, and action. Do not assume any specific details if unsure. No other special characters or whitespace with no line breaks.  60 tokens max.",
            "model": "gpt-4o",
            "serverUrl": "https://api.openai.com/v1/chat/completions",
            "endpoint": "openai",
            "inputFormat": "chatinstruct",
            "outputFormat": "text",
            "temperature": 0.7,
            "newTokenTarget": 60,
            "tokenLimit": 4096,
            "top_p": 0.9,
            "top_k": 8,
            "repetition_penalty": 1,
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "streaming": true,
        }, 
        properties: {
            "reviewable": true,
        }
    };
    
    static defaultPersona = "builtInDebug";
}

export class suggestionsWriterMetadata extends llmDataMetadata {

    static inputTemplate = {   
      "includeHistory": true,
      "historyParams": {
        "spanSelectionMode": "full",
        "ignoreCompression": false,
        "includeDeleted": false,
        "includeFailed": false,
        "includedNodes": [], // all
      },
    }

    static {
        this.nodeAttributes = {
            ...super.nodeAttributes,
            addable: true,
            label: "Suggestions Writer",
            tooltip: "Use a language model to generate suggestions",
        };
    }

    static initMenu = [
        {
          label: "Give this new entry a name to help you keep track of it (not shown to users):",
          type: "text",
          path: "instanceName",
          tooltip: "A unique name for your reference.",
          maxChar: 30,
          multiline: false,
          defaultValue: "Image Prompt Writer",
        },
      ];

    static newNodeTemplate = {
        nodeType: "llmData",
        instanceName: "Suggestions Writer",
        canUseHistoryAsInput: true,
        requireAllEventTriggers: true,
        requireAllVariables: false,
        inputs: [],
        params: {
            "context": "",
            "outputDataFields": [
              {
                "variableName": "suggestions",
                "dataType": "array",
                "instructions": "An array of 4 different possible actions the user could take based on what's happening in the chat, where all options must be plausible, specific, and brief",
                "required": true
              }
            ],
            "context": "",
            "zerothTurnInstructions": "",
            "turnInstructions": "",
            "model": "gpt-5-mini",
            "serverUrl": "https://api.openai.com/v1/chat/completions",
            "endpoint": "openai",
            "inputFormat": "chatgpt",
            "outputFormat": "json",
            "temperature": 0.7,
            "newTokenTarget": 60,
            "tokenLimit": 4096,
            "top_p": 0.9,
            "top_k": 8,
            "repetition_penalty": 1,
            "apiKey": 'setting:openAIkey;sk-xxxxxxxxxxxxxxxxxxxxxxxx',
            "streaming": true,
        }, 
        properties: {
            "reviewable": true,
        }
    };

    static defaultPersona = "builtInDebug";
}

export const nodeTypeLookupTable = {
    "codeBlock": codeBlockMetadata,
    "externalTextInput": externalTextInputMetadata,
    "externalMultiInput": externalMultiInputMetadata,
    "forLoop": forLoopMetadata,
    "ifThenElse": ifThenElseMetadata ,
    "imageGenerator": imageGeneratorMetadata,
    "llm": llmMetadata,
    "llmData": llmDataMetadata,
    "fileStore": fileStoreMetadata,
    "start": startMetadata,
    "staticText": staticTextMetadata,
    "randomNumber": randomNumberMetadata,
    "delay": delayMetadata,
    "stt": sttMetadata,
    "tts": ttsMetadata,
    "whileLoop": whileLoopMetadata,
    "scenario": scenarioMetadata,
    "imagePromptWriter": imagePromptWriterMetadata,
    "suggestionsWriter": suggestionsWriterMetadata,
    "arrayIndex": arrayIndexMetadata,
    "arrayIterator": arrayIteratorMetadata,
    "audioPlayback": audioPlaybackMetadata,
};

//
// Reach into backend code SAFELY to pull out metadata about a node type
//
export function getMetadataForNodeType(nodeType) {
    const metadataClass = nodeTypeLookupTable[nodeType];
    if (!metadataClass) {
        throw new Error(`No metadata found for node type ${nodeType}`);
    }
    return metadataClass;
}

export function getInputsAndOutputsForNode(fullNodeDescription) {
    const metadataClass = getMetadataForNodeType(fullNodeDescription.nodeType);
    const metadata = new metadataClass({ fullNodeDescription });

    return {
        events: metadataClass.events || [],
        inputs: Object.keys(metadataClass.AllowedVariableOverrides).map(variableName => {return {value: variableName, label: metadataClass.AllowedVariableOverrides[variableName].label}}),
        outputs: metadata.getOutputs() || [],
    };
}

export function getAddableNodeTypes() {
    const addableKeys = Object.keys(nodeTypeLookupTable).filter(nodeType => {
        return nodeTypeLookupTable[nodeType].nodeAttributes.addable;
    });

    const addableNodeTypes = addableKeys.map(nodeType => {
        return {
            nodeType: nodeType,
            label: nodeTypeLookupTable[nodeType].nodeAttributes.label,
            tooltip: nodeTypeLookupTable[nodeType].nodeAttributes.tooltip,
        };
    });

    return addableNodeTypes;
}
