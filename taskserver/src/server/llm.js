import { Config } from "@src/backend/config";
import { AIError } from '@src/common/errors';
import chatGPTEndpoint from './aiEndpoints/chatGPT';
import localLLMEndpoint from './aiEndpoints/localllm';
import anthropicLLMEndpoint from './aiEndpoints/anthropic';
import googleEndpoint from './aiEndpoints/google';
import openRouterEndpoint from './aiEndpoints/openrouter';
import chatGPTFormats from './aiInputFormats/chatgpt';
import anthropicFormats from './aiInputFormats/anthropic';
import instructFormats from './aiInputFormats/instruct';
import chatInstructFormats from './aiInputFormats/chatinstruct';
import jsonFormats from './aiInputFormats/json';
import llama2Formats from './aiInputFormats/llama2';
import simpleChatFormats from './aiInputFormats/simplechat';
import metharmeFormats from './aiInputFormats/metharme';
import chatmlFormats from './aiInputFormats/chatml';
import textOutputFormat from './aiOutputFormats/text';
import jsonOutputFormat from './aiOutputFormats/json';

let endpoints = {
  'openai': chatGPTEndpoint,
  'anthropic': anthropicLLMEndpoint,
  'google': googleEndpoint,
  'llm.playday.ai-webui': localLLMEndpoint,
  'openrouter': openRouterEndpoint,
  'llm.playday.ai-h' : null,
};

async function loadEndpoint(endpoint) {
  if (!endpoints[endpoint]) {
    console.log("Loading endpoint: ", endpoint);
    switch (endpoint) {
      case 'openai':
        endpoints[endpoint] = await import('./aiEndpoints/chatGPT');
        break;
      case 'anthropic':
        endpoints[endpoint] = await import('./aiEndpoints/anthropic');
        break;
      case 'google':
        endpoints[endpoint] = await import('./aiEndpoints/google');
        break;
      case 'openrouter':
        endpoints[endpoint] = await import('./aiEndpoints/openrouter');
        break;
      case 'llm.playday.ai-webui':
        endpoints[endpoint] = await import('./aiEndpoints/localllm');
        break;
      default:
        throw Error("Endpoint not found: " + endpoint);
    }
  }

  return endpoints[endpoint];
}

const inputFormats = {
  'chatgpt': chatGPTFormats,
  'anthropic': anthropicFormats,
  'instruct': instructFormats,
  'chatinstruct': chatInstructFormats,
  'json': jsonFormats,
  'llama2': llama2Formats,
  'simplechat': simpleChatFormats,
  'metharme': metharmeFormats,
  'chatml': chatmlFormats,
};

const outputFormats = {
  'text': textOutputFormat,
  'json': jsonOutputFormat,
};


export function generateMessageHistoryPrompt(llmParameters, messages) {

  let outputFormatInstructions = outputFormats[llmParameters.outputFormat].generateOutputFormatInstructions(llmParameters);

  let finalLLMParamters = {...llmParameters, outputFormatInstructions: outputFormatInstructions};

  let prompt = inputFormats[llmParameters.inputFormat].generateMessageHistoryPrompt(finalLLMParamters, messages);
  
  return prompt;
}

export async function callLLMChat_Blocking(prompt, llmParameters) {
  const { Constants } = Config;

  Constants.debug.logAICalls && console.log("callLLMChat_Blocking model: ", llmParameters.model);
  Constants.debug.logAICalls && console.log("callLLMChat_Blocking Parameters: ", JSON.stringify(llmParameters, null, 2));
  Constants.debug.logAssistantPrompts && console.log("callLLMChat_Blocking  prompt: ", prompt);

  const endpoint = await loadEndpoint(llmParameters.endpoint);

  if (!endpoint) {
    throw Error("Endpoint not loaded: " + llmParameters.endpoint);
  }

  try {
      let result = await endpoint.blockingAPI({ prompt, llmParameters });

      if (result) {
        Constants.debug.logAICalls && console.log("callLLMChat_Blocking result: ", JSON.stringify(result, null, 2));
      }

      return result;
  } catch (error) {
    const aiError = new AIError({
      error: error,
      parameters: llmParameters,
      prompt: prompt,
    });
    console.log('callLLMChat_Streaming: ',aiError);
    return { success: false, data: null, error: aiError };
  }
}

export async function callLLMChat_Streaming(prompt, llmParameters, callback) {
  const { Constants } = Config;

    Constants.debug.logAICalls && console.log("callLLMChat_Streaming model: ", llmParameters.model);
    Constants.debug.logAICalls && Constants.debug.verbose && console.log("callLLMChat_Streaming Parameters: ", JSON.stringify(llmParameters, null, 2));
    Constants.debug.logAssistantPrompts && console.log("callLLMChat_Streaming prompt: ", prompt);

    const endpoint = await loadEndpoint(llmParameters.endpoint);

    if (!endpoint) {
      throw Error("Endpoint not loaded: " + llmParameters.endpoint);
    }

  try {
    
    let result = await endpoint.streamingAPI({prompt, llmParameters, callback});

    return result;
  } catch (error) {
    const aiError = new AIError({
      error: error,
      parameters: llmParameters,
      prompt: prompt,
    });
    console.log('callLLMChat_Streaming: ',aiError);
    return { success: false, data: null, error: aiError };
  }
}

