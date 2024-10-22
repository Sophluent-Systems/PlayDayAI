import { nullUndefinedOrEmpty } from '@src/common/objects';
import { Config } from "@src/backend/config";
import OpenAI from 'openai';
import { measureExecutionTimeAsync } from "@src/common/perf";
import { getAccountServiceKey } from "@src/backend/accounts";

const handleChatGPTStreamingResponse = async (stream, callback)  => {
  const { Constants } = Config;
  Constants.debug.logAICalls && console.log("handleChatGPTStreamingResponse [start]");

  try {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          const continueProcessing = await callback('data', token);
          if (!continueProcessing) {
            await callback('cancelled', null);
            break;
          }
        }
      }

      await callback('done', null);
      Constants.debug.logAICalls && console.log("handleChatGPTStreamingResponse [success]");
      return { success: true, data: null, error: null };;
    } catch (error) {
      const errorToSend = new Error("handleChatGPTStreamingResponse: " + error.message);
      console.log('handleChatGPTStreamingResponse - error: ', errorToSend.message);
      return { success: false, data: null, error: errorToSend };
    }
}

function createChatGPTMessageArrayFromPrompt(prompt) {

  //
  // If we can parse the prompt as an array, we'll use that.
  //

  try {
    const parsedPrompt = JSON.parse(prompt);
    if (Array.isArray(parsedPrompt)) {
      return parsedPrompt;
    }
  } catch (error) {
    // ignore
  }

  //
  // Otherwise, we'll create a message array with a single system message.
  //

  return [{ role: "system", content: prompt }];
}

const fixMessageHistoryForSpecificModels = (messageArray, model) => {
  // if the model does not start with "o1", return the prompt as-is

  // if the model starts with "o1", replace 'system' with 'user'
  if (model.startsWith("o1")) {
    return messageArray.map(message => {
      if (message.role === 'system') {
        return {  ...message, role: 'user' };
      } else {
        return message;
      }
    });
  }

    
  return messageArray;
}

const doFetchChatGPT = async (params, stream) => {    
    const {prompt, llmParameters } = params;
    const { keySource } = llmParameters;
    const { Constants } = Config;
    const isO1Model = llmParameters.model.startsWith("o1");
   
    Constants.debug.logAICalls && console.log("doFetchChatGPT");
  
    const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "openAIkey") : llmParameters.apiKey;

    if (nullUndefinedOrEmpty(apiKeyToUse) ||
    apiKeyToUse == 'sk-xxxxxxxxxxxxxxxxxxxxxxxx') {
      
        throw Error(`OpenAI: Invalid OpenAI API Key: "${apiKeyToUse}"`);
    } 
    
    if (prompt.length < 1) {
      throw Error("OpenAI: No message history prompt provided");
    }
    
    if (isO1Model && stream) {
      throw Error("OpenAI: Streaming is not supported for O1 models");
    }

    const openai = new OpenAI({
      apiKey: apiKeyToUse
    });

    let messageArray = createChatGPTMessageArrayFromPrompt(prompt);

    messageArray = fixMessageHistoryForSpecificModels(messageArray, llmParameters.model);

    let openApiParams = {
      messages: messageArray,
      model: llmParameters.model,
      temperature: isO1Model ? 1 : llmParameters.temperature
    };
    if (llmParameters.outputFormat == 'json' && llmParameters.model != 'gpt-4' && llmParameters.model != 'gpt-3-turbo') {
      openApiParams.response_format = { type: "json_object" }
    }
    if (stream) {
      openApiParams.stream = true;
    }
    if (llmParameters.seed >= 0) {
      openApiParams.seed = llmParameters.seed;
      console.log("Seed: ", llmParameters.seed)
    }

    return await openai.chat.completions.create(openApiParams);
}


async function blockingAPI(params) {

      const { result, elapsedTime } = await measureExecutionTimeAsync(async () => await doFetchChatGPT(params, false));
      console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
      if (!result.choices) {
        throw Error("blockingAPI: Invalid response from OpenAI: " + JSON.stringify(result));
      }
      return { success: true, data: result.choices[0].message.content, error: null, executionTime: elapsedTime };
}

async function streamingAPI(params) {
    const { callback } = params;

    const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
        const response = await doFetchChatGPT(params, true);
        const streamingResult = await handleChatGPTStreamingResponse(response, callback);
        return streamingResult;
    });
    console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
    return {...result, executionTime: elapsedTime};
}

export default {
  blockingAPI,
  streamingAPI
};