import { nullUndefinedOrEmpty } from '@src/common/objects';
import { Config } from "@src/backend/config";
import Anthropic from '@anthropic-ai/sdk';
import { measureExecutionTimeAsync } from "@src/common/perf";
import { getAccountServiceKey } from "@src/backend/accounts";

const handleAnthropicStreamingResponse = async (response, callback)  => {
  const { Constants } = Config;
  Constants.debug.logAICalls && console.log("handleAnthropicStreamingResponse [start]");

  try {

    //
    // This is far more janky than what anthropic would have you believe, but
    // it's the only thing that works with the current version of the SDK
    // 

      for await (const messageStreamEvent of response) {
        if (messageStreamEvent.type === 'content_block_start') {
          if (messageStreamEvent.content_block.type == 'text') {
            await callback('data', messageStreamEvent.content_block.text);
          } else {
            console.error("handleAnthropicStreamingResponse - unknown delta type: ", messageStreamEvent.delta.type);
          }
        }

        if (messageStreamEvent.type === 'content_block_delta') {
          if (messageStreamEvent.delta.type == 'text_delta') {
            await callback('data', messageStreamEvent.delta.text);
          } else {
            console.error("handleAnthropicStreamingResponse - unknown delta type: ", messageStreamEvent.delta.type);
          }
        }

        
        if (messageStreamEvent.type === 'error') {
          console.error("handleAnthropicStreamingResponse - error: ", messageStreamEvent.error);
          await callback('error', messageStreamEvent.error);
        }

      }

      console.error("handleAnthropicStreamingResponse [end]");
      return { success: true, data: null, error: null };

    } catch (error) {
    console.error('handleAnthropicStreamingResponse - error: ', error.message, error.stack);
    return { success: false, data: null, error: error };
  }
}


function createAnthropicMessageArrayFromPrompt(prompt) {

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

  return [{ role: "assistant", content: "Provide the next request in this chat." }, {role: "user", content: prompt}];
}

const doFetchAnthropic = async (params, stream) => {   
    const {prompt, llmParameters } = params;
    const { keySource } = llmParameters;
    const { Constants } = Config;
    Constants.debug.logAICalls && console.log("doFetchAnthropic");

    const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "anthropicKey") : llmParameters.apiKey;
  
    if (nullUndefinedOrEmpty(apiKeyToUse) ||
    apiKeyToUse == 'sk-xxxxxxxxxxxxxxxxxxxxxxxx') {
      
        throw Error(`doFetchAnthropic: Invalid OpenAI API Key: "${apiKeyToUse}"`);
    } 
    
    if (prompt.length < 1) {
      throw Error("doFetchAnthropic: No message history prompt provided");
    }

    const anthropic = new Anthropic({apiKey: apiKeyToUse});

    let messages = createAnthropicMessageArrayFromPrompt(prompt);

    if (messages.length < 2) {
      console.error("doFetchAnthropic: No user messages provided (Claude requires this): ", messages);
      throw Error("doFetchAnthropic: No user messages provided (Claude requires this)");
    }

    let systemMessage = messages[0].content;
    messages.splice(0, 1);

    let anthropicParams = {
      model: llmParameters.model,
      max_tokens: llmParameters.newTokenTarget,
      system: systemMessage,
      messages: messages,
    };

    if (typeof llmParameters.temperature == 'number') {
      // cap the temperature between 0.0 and 1.0
      anthropicParams.temperature = Math.min(1.0, Math.max(0.0, llmParameters.temperature));
    }

    if (typeof llmParameters.top_p == 'number') {
      // cap the topP between 0.0 and 1.0
      anthropicParams.top_p = llmParameters.top_p;
    }

    if (typeof llmParameters.top_k == 'number') {
      // cap the topK between 1 and 100
      anthropicParams.top_k = llmParameters.top_k;
    }

    if (stream) {

      return anthropic.messages.stream(anthropicParams);

    } else {

      return await anthropic.messages.create(anthropicParams);
    }
}


async function blockingAPI(params) {

  try {
    
      const { result, elapsedTime } = await measureExecutionTimeAsync(async () => await doFetchAnthropic(params, false));
      console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
      console.error("BLOCKING RESPONSE: ", result)
      if (!result?.message?.content?.text) {
        throw Error("blockingAPI: Invalid response from OpenAI: " + JSON.stringify(result));
      }
      return { success: true, data: result.message.content.text, error: null, executionTime: elapsedTime };
  } catch (error) {
      // suggest checking https://status.openai.com/ ?
      console.log("Anthropic BlockingAPI - error: ", error.message, error);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

async function streamingAPI(params) {
  const { callback } = params;

  try {
    const { result, elapsedTime } = await measureExecutionTimeAsync(async () => {
        const response = await doFetchAnthropic(params, true);
        const streamingResult = await handleAnthropicStreamingResponse(response, callback);
        return streamingResult;
    });
    console.log(`Execution time: ${elapsedTime.toFixed(2)} milliseconds`);
    return {...result, executionTime: elapsedTime};
  } catch (error) {
      console.log("Anthropic StreamingAPI - error: ", error.message);
      return { success: false, data: null, error: error, executionTime: 0 }
  }
}

export default {
  blockingAPI,
  streamingAPI
};