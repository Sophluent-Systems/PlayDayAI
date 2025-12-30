import { TextStreamFilterManager } from './filtertextstream';
import { stringArrayParser } from './outputParsers/stringArray';
import { jsonBlockParser } from './outputParsers/jsonBlock';
import { callLLMChat_Streaming, callLLMChat_Blocking, generateMessageHistoryPrompt } from './llm';
import { getMostRecentMessageOfType, getTurnCount } from '@src/common/messages';
import { Config } from "@src/backend/config";
import { updateParamsWithCustomCode } from '@src/common/customcode.js';



export class LLMPipelineStage {
    constructor(params) {
        this.originalllmParameters = {...params.llmParameters};
        this.llmParameters = {};
        this.llmContext = {};
        this.codeResults = {};
        this.filterManager = null;
        this.callback = null;
        this.callerContext = null;
        this.proxyContext = null;
        this.prompt = null;
        this.serverMessageIndices = [];
        this.serverMessages = null;
    }

    configureFilters() {
        if (this.llmParameters.outputFormat === 'json') {
            // 
            // It should be all one big JSON -- parse the whole
            // thing and sort it out later.
            //
            this.filterManager.addParser(jsonBlockParser);

        } else {
            if (this.llmParameters.dataFields) {
                this.llmParameters.dataFields.forEach(field => {

                    //
                    // TODO: Different filters for each data type
                    // 
                    if (field.dataType === 'array') {
                        this.filterManager.addParser(stringArrayParser(field.variableName));
                    } else {
                        throw new Error("Data type parser not implemented yet for data type " + field.dataType);
                    }
                });
            }
        }
    }

    async emitTokens(tokens, endOfStream = false) {
        let info = {
            tokens: tokens,
            data: {},
            error: null,
            endOfStream: endOfStream,
        };
        await this.callback(info, this.callerContext);
    }

    async pipelineStageProxyCallback(info) {

        let shouldContinue = true;
        if (this.callback) {
            // let the caller handle it
            shouldContinue = await this.callback(info, this.callerContext);

        } else {
            if (!this.proxyContext) {
                this.proxyContext = {
                    tokens: "",
                    data: {},
                };
            }

            if (!info.error) {
                if (info.tokens) {
                    this.proxyContext.tokens += info.tokens;
                }
                if (info.data) {
                    this.proxyContext.data = {...this.proxyContext.data, ...info.data};
                }
            }
        }
        return shouldContinue;
    }

    getMostRecentDataFields(fullMessageHistory) {
        const mostRecentDataMessageIndex = getMostRecentMessageOfType(fullMessageHistory, ['data'], fullMessageHistory.length-1);
      
        if (mostRecentDataMessageIndex !== -1) {
          return fullMessageHistory[mostRecentDataMessageIndex].data;
        }
      
        return {};
    }
      
    getLLMContext(serverMessages, contextType) {

        if (serverMessages && serverMessages.length > 0) {
            // Walk the server messages in reverse chronological order until we
            // come across a context in a previous message
            for (let j = serverMessages.length-1; j >= 0; j--) {
                const message = serverMessages[j];
                if (message.llmContexts && message.llmContexts[contextType]) {
                    return {...message.llmContexts[contextType]};
                }
            }
        }
      
        // found none -- return an empty object
        return {};
    }

    async prepareAndGeneratePrompt(messagesToUse) {

        //
        // Deep copy the original parameters and context
        //
        this.llmParameters = JSON.parse(JSON.stringify(this.originalllmParameters));

        /* gonna have to redo compression...
        this.serverMessageIndices = getServerMessageIndiciesAccountingForCompression(messagesToUse);

        this.serverMessages = generateTempMessageListFromIndicesList(messagesToUse, this.serverMessageIndices, false, ['role', 'content', 'recordID', 'llmContexts', 'data']);
       */
      
        this.serverMessages = messagesToUse;

        const mostRecentData = this.getMostRecentDataFields(this.serverMessages);
        const userTurnsSoFar = getTurnCount(this.serverMessages);

        this.llmContext = this.getLLMContext(this.serverMessages, this.contextType);

        if (this.llmParameters.code_UNSAFE) {
            const codeResults = await updateParamsWithCustomCode(this.llmParameters, this.llmContext, mostRecentData, userTurnsSoFar);
            if (codeResults.error) {
                throw new Error("Custom code error: " + codeResults.error);
            }
            this.codeResults = codeResults;
        }

        this.prompt = generateMessageHistoryPrompt(this.llmParameters, this.serverMessages);

        return this.prompt;
    }

    async start(callback, callbackContext) {
        const { Constants } = Config;

        this.callback = callback;
        this.callerContext = callbackContext;

        this.filterManager = new TextStreamFilterManager(this.pipelineStageProxyCallback.bind(this), this.callerContext);

        this.configureFilters();

        if (process.env.SANDBOX == 'true') {
            if (this.llmParameters.streaming) {
                this.llmParameters.serverUrl = Constants.config.sandboxLLMStreamingUrl;
            } else {
                this.llmParameters.serverUrl = Constants.config.sandboxLLMBlockingUrl;
            }
        }

        let llmCallResult = null;
        if (this.llmParameters.streaming) {
            llmCallResult = await callLLMChat_Streaming(
                this.prompt,
                this.llmParameters,
                (async (state, data) => await this.filterManager.filterTextStream(state, data)).bind(this),
                null,
            );
        } else {
            llmCallResult = await callLLMChat_Blocking(
                this.prompt,
                this.llmParameters
            );
            if (llmCallResult.success) {
                await this.filterManager.filterTextStream('done', llmCallResult.data);
            }
        }
        if (!llmCallResult.success) {
            throw llmCallResult.error;
        }

        return {
            prompt: this.prompt,
            rawResponse: this.filterManager.getRawResponse(),
            codeResults: this.codeResults,
            finalLLMParameters: this.llmParameters,
            finalLLMContext: this.llmContext,
            serverMessageIndices: this.serverMessageIndices,
            serverMessages: this.serverMessages,
            output: this.proxyContext,
            executionTime: llmCallResult ? llmCallResult.executionTime : 0,
        };
    }

    getServerMessages() {
        return this.serverMessages;
    }
}
