import { handleNodeFetchBlockingResponse } from './common';
import { Config } from "@src/backend/config";
import { measureExecutionTimeAsync } from "@src/common/perf";
import { getAccountServiceKey } from "@src/backend/accounts";
import { nullUndefinedOrEmpty } from "@src/common/objects";

async function handleLocalLLMStreamingResponse(fetchResponse, callback) {
  const { Constants } = Config;
  Constants.debug.logAICalls && console.log("handleLocalLLMStreamingResponse [start]");

  try {
      const reader = fetchResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      let streamData = await reader.read();
      while (!streamData.done) {

          buffer += decoder.decode(streamData.value, { stream: true });
          let lastNewlineIndex = -1;
          const lines = buffer
              .split('\n')
              .filter((line) => line.trim().startsWith('data: '));
      
          for (const line of lines) {
              lastNewlineIndex += line.length - 1;
              const message = line.replace(/^data: /, '')
              Constants.debug.logStreamingMessages && console.log("   message: ", message);
              if (message === '[DONE]') {
                await callback('done', null);
                return { success: true, data: null, error: null };;
              }
              let json = null;
              try {
                 json = JSON.parse(message);
              } catch (error) {
                console.log("handleLocalLLMStreamingResponse: error parsing json: ", error.message);
                console.log("     attempting to parse: ", message);
                throw error;
              }
              const token = json.choices[0].text
              if (token) {
                const continueProcessing = await callback('data', token);
                if (!continueProcessing) {
                  await callback('cancelled', null);
                  await callback('done', null);
                  return { success: true, data: null, error: null };
                }
              }
          }
      
          // Remove processed data from the buffer
          buffer = buffer.slice(lastNewlineIndex + 1);

          streamData = await reader.read();
      }
      

      Constants.debug.logAICalls && console.log("handleLocalLLMStreamingResponse [success]");
      return { success: true, data: null, error: null };
    } catch (error) {
      console.log('handleLocalLLMStreamingResponse - error: ', error.message);
      return { success: false, data: null, error: error };
    }
}


const doFetchLocalLLM = async (params, stream) => {    
  const {prompt, llmParameters } = params;
  const { keySource } = llmParameters;
    const { Constants } = Config;
   
    Constants.debug.logAICalls && console.log("doFetchLocalLLM: ", llmParameters.serverUrl);
  
    const url = llmParameters.serverUrl;

    const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "openAIkey") : llmParameters.apiKey;
  
    if (nullUndefinedOrEmpty(apiKeyToUse) ||
    apiKeyToUse == 'sk-xxxxxxxxxxxxxxxxxxxxxxxx') {
      
        throw Error(`doFetchAnthropic: Invalid OpenAI API Key: "${apiKeyToUse}"`);
    } 
        

    let callParams = {
      'prompt': prompt,
      'max_tokens': llmParameters.newTokenTarget,
      'temperature': llmParameters.temperature,
      'top_p': llmParameters.top_p,
      'repetition_penalty': llmParameters.repetition_penalty,
      'top_k': llmParameters.top_k,
      'stream': stream
    };
    if (llmParameters.seed >= 0) {
      callParams['seed'] = llmParameters.seed;
      console.log("Seed: ", llmParameters.seed)
    }
    let options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyToUse}`,
        },
        body: JSON.stringify(callParams)
    };

    return await fetch(url, options);
}


async function blockingAPI(params) {

  try {
      const { result, elapsedTime } = await measureExecutionTimeAsync(async () => await doFetchLocalLLM(params, false));
      let data = await handleNodeFetchBlockingResponse(result);
      if (!data.choices) {
        throw Error("blockingAPI: Invalid response from LLM server: " + JSON.stringify(data));
      }
      console.log("data.choices[0]: ", data.choices[0]);
      return { success: true, data: data.choices[0].text, error: null, executionTime: elapsedTime };
  } catch (error) {
      console.log("localLLMBlockingAPI - error: ", error.message, error);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

async function streamingAPI(params) {
  const { callback } = params;

  try {
     const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
          const response = await doFetchLocalLLM(params, true);
          const streamingResult = await handleLocalLLMStreamingResponse(response, callback);
          return streamingResult;
     });
     console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
      return {...result, executionTime: elapsedTime};
  } catch (error) {
      console.log("localLLMStreamingAPI - error: ", error.message);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

export default {
  blockingAPI,
  streamingAPI
}
