import { nullUndefinedOrEmpty } from '@src/common/objects';
import { Config } from "@src/backend/config";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { measureExecutionTimeAsync } from "@src/common/perf";
import { getAccountServiceKey } from "@src/backend/accounts";

const handleGoogleStreamingResponse = async (response, callback)  => {
  const { Constants } = Config;
  Constants.debug.logAICalls && console.log("handleGoogleStreamingResponse [start]");

  console.error("handleGoogleStreamingResponse: response=", response);

  try {

      //
      // This is far more janky than what google would have you believe, but
      // it's the only thing that works with the current version of the SDK
      // 

      for await (const chunk of response.stream) {
        const chunkText = chunk.text();
        console.error('G: ', chunkText);
        await callback('data', chunkText);
      }

      console.error("handleGoogleStreamingResponse [end]");
      return { success: true, data: null, error: null };

    } catch (error) {
    console.error('handleGoogleStreamingResponse - error: ', error.message, error.stack);
    return { success: false, data: null, error: error };
  }
}



const doFetchGoogle =async (params, stream) => {    
  const {prompt, llmParameters } = params;
  const { keySource } = llmParameters;
    const { Constants } = Config;
    Constants.debug.logAICalls && console.log("doFetchGoogle");
  
    const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "googleLLMKey") : llmParameters.apiKey;
  
    if (nullUndefinedOrEmpty(apiKeyToUse) ||
    apiKeyToUse == 'sk-xxxxxxxxxxxxxxxxxxxxxxxx') {
      
        throw Error(`doFetchAnthropic: Invalid OpenAI API Key: "${apiKeyToUse}"`);
    } 
        
    if (prompt.length < 1) {
      throw Error("doFetchGoogle: No message history prompt provided");
    }
    
    const genAI = new GoogleGenerativeAI(apiKeyToUse);


    let generationConfig  = {
      maxOutputTokens: llmParameters.newTokenTarget,
    };

    if (typeof llmParameters.temperature == 'number') {
      // cap the temperature between 0.0 and 1.0
      generationConfig .temperature = Math.min(1.0, Math.max(0.0, llmParameters.temperature));
    }

    if (typeof llmParameters.top_p == 'number') {
      // cap the topP between 0.0 and 1.0
      generationConfig .topP = llmParameters.top_p;
    }

    if (typeof llmParameters.top_k == 'number') {
      // cap the topK between 1 and 100
      generationConfig .topK = llmParameters.top_k;
    }

    // The Gemini 1.5 models are versatile and work with most use cases
    const model = genAI.getGenerativeModel({ model: llmParameters.model, generationConfig});

    if (stream) {

      const result = await model.generateContentStream(prompt);
      return result;

    } else {

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text;
    }
}


async function blockingAPI(params) {

  try {
    
      const { result, elapsedTime } = await measureExecutionTimeAsync(async () => await doFetchGoogle(params, false));
      console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
      console.error("BLOCKING RESPONSE: ", result)
      if (typeof result != 'string') {
        throw Error("blockingAPI: Invalid response from Google: " + JSON.stringify(result));
      }
      return { success: true, data: result, error: null, executionTime: elapsedTime };
  } catch (error) {
      // suggest checking https://status.openai.com/ ?
      console.log("Google BlockingAPI - error: ", error.message, error);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

async function streamingAPI(params) {
  const { callback } = params;

  try {
    const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
        const response = await doFetchGoogle(params, true);
        const streamingResult = await handleGoogleStreamingResponse(response, callback);
        return streamingResult;
    });
    console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
    return {...result, executionTime: elapsedTime};
  } catch (error) {
      console.log("Google StreamingAPI - error: ", error.message);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

export default {
  blockingAPI,
  streamingAPI
};