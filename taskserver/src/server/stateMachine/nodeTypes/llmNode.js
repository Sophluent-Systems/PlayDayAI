import { nodeType } from  './nodeType.js';
import { LLMPipelineStage } from '../../llmpipelinestage.js';
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { AIError } from '@src/common/errors';

export class llmNode extends nodeType {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }


    async getLLMParams(params, stateMachine, seed, keySource) {

        let messages = stateMachine.convertToMessageList(params.history, {mediaTypes: ["text"]});

        let personaName = params.persona?.displayName;
        if (nullUndefinedOrEmpty(personaName) || (params.personaSource == "builtin")) {
           personaName = "Assistant";
        }

        const personaDescription = nullUndefinedOrEmpty(params.persona?.identity) ? "An AI assistant" : params.persona.identity;
        const personaSource = params.personaSource;
        
        const llmParameters = {
            ...params,
            identity: {
              name: personaName,
              description: personaDescription,
              source: personaSource,
            },
            messages,
            seed,
            keySource,
        }
        delete llmParameters.history;
       
        return llmParameters;
    }

    async assistantCallback(results, context) {
      const { Constants } = Config;
      const {channel, recordID} = context;
      const { tokens, data, error, endOfStream } = results;
    
      const haltReason = context.wasCancelled && context.wasCancelled();
      if (haltReason) {
        throw new Error(haltReason);
      }

      if (data && Object.keys(data).length > 0) {
        Constants.debug.logStreamingMessages && console.error(" FOUND DATA: ", data);
        context.data = {...context.data, ...data};
        this.messageAppendDataContent(channel, recordID, data);
      }
    
      if (tokens) {
        context.text += tokens;
        await this.messageAppendTextContent(channel, recordID, tokens);
      }
      
      // Handle error state
      if (error != null) {
        console.error("assistantCallback: error: ", error);
        return false;
      }
    
      // Send the message end
      if (endOfStream) {
        Constants.debug.logStreamingMessages && console.error("assistantCallback: endOfStream");
      }

      return true;
    }
    

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, keySource, wasCancelled}) {
        const { Constants } = Config;

        let llmParameters = params.llmParameters;

        if (!llmParameters) {
            llmParameters = await this.getLLMParams(params, stateMachine, seed, keySource);
        }

        const pipeline = new LLMPipelineStage({
            llmParameters: llmParameters
         });
         
        if (!pipeline) {
          Constants.debug.logAICalls && console.warn("processAssistantRequestStreaming failed to create pipeline");
          throw new Error("Internal error: processAssistantRequestStreaming failed to create pipeline");
        }

        await pipeline.prepareAndGeneratePrompt(llmParameters.messages);

        let callbackContext = {channel: channel, data: {}, text: "", recordID: record.recordID, debuggingTurnedOn, wasCancelled};

        //
        // LOADS of heavy lifting right here
        //

        let results;
        try {
          results = await pipeline.start(this.assistantCallback.bind(this), callbackContext);
        } catch (error) {
          // For LLM node, catch the error so we can apply the context to the return value
          // for debugging purposes

          if (error instanceof AIError) {
            results = {
              finalLLMParameters: error.parameters,
              prompt: error.prompt,
              rawResponse: "",
              error: error
            };

          } else {
            results = {
              finalLLMParameters: llmParameters,
              rawResponse: "",
              prompt: "",
              model: llmParameters.model,
              error: error
            };
          }
        }

        let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {},
            },
            context: {
                seed: seed,
                rawResponse: results.rawResponse,
                model: results.finalLLMParameters.model,
                inputFormat: results.finalLLMParameters.inputFormat,
                outputFormat: results.finalLLMParameters.outputFormat,
                prompt: results.prompt,
                llmContext: results.finalLLMParameters,
            }
        }

        if (results.error) {
            returnVal.state = "failed";
            returnVal.error = results.error;
            returnVal.eventsEmitted = [];
        }

        const hasData = !nullUndefinedOrEmpty(callbackContext.data);
        if (hasData) { 
            returnVal.output.result.data = callbackContext.data;
        }
        if (!nullUndefinedOrEmpty(callbackContext.text, !hasData)) { 
            returnVal.output.result.text = callbackContext.text;
        }

        // excessive to store this AND the prompt
        if (returnVal.context.llmContext.messages) {
            delete returnVal.context.llmContext.messages;
        }

        return returnVal;
    }
}