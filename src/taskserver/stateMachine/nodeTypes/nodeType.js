import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getMetadataForNodeType } from '@src/common/nodeMetadata';
import { EnsureCorrectErrorType } from '@src/common/errors';

export class nodeType {
    constructor({db, session, fullNodeDescription}) {
        this.db = db;
        this.session = session;
        this.fullNodeDescription = fullNodeDescription;
        this.nodeMetadata = getMetadataForNodeType(fullNodeDescription.nodeType);
    }

    async messageStart({channel, stateMachine, record, debuggingTurnedOn}) {
        const message = stateMachine.messageFromRecord(record, { includeDebugInfo: debuggingTurnedOn });

        await channel.sendMessageStart(message);
    }

    async messageSendField(channel, recordID, fieldName, fieldValue, params) {
        await channel.sendField(recordID, fieldName, fieldValue, params);
    }

    async messageAppendTextContent(channel, recordID,  fieldValue) {
        await channel.appendTextContent(recordID, fieldValue);
    }

    async messageAppendDataContent(channel, recordID, fieldValue) {
        await channel.appendDataContent(recordID, fieldValue);
    }

    errorFieldForTransmission(error, debuggingTurnedOn=false) {
        
        const errorOfCorrectType = EnsureCorrectErrorType(error);

        let errorData = errorOfCorrectType.export();

        if (!debuggingTurnedOn) {
            errorData = { name: "Error", message: errorData.message };
        }
        return errorData;
    }

    async messageEnd({channel, record, debuggingTurnedOn}) {

        if (record.error) {
            await channel.sendField(record.recordID, "error", this.errorFieldForTransmission(record.error, debuggingTurnedOn));
        }

        if (debuggingTurnedOn) {
            await channel.sendField(record.recordID, "executionTime", record.executionTime);
        }

        await channel.sendMessageEnd(record.recordID);
    }

    async messageError(channel, error, debuggingTurnedOn=false) {
        await channel.sendCommand("error", this.errorFieldForTransmission(error, debuggingTurnedOn));
    }

    mergeAndDedupeHistories(history1, history2) {
        // Create an array of all records in history2 and not history 1
        let newRecords = history2.filter(record => {
            return !history1.find(existingRecord => existingRecord.recordID === record.recordID);
        });

        let combinedRecords = [...history1, ...newRecords];

        // sort the combined records by completion time
        combinedRecords.sort((a, b) => {
            return a.startTime - b.startTime;
        });

        return combinedRecords;
    }

    overwriteInputParams(inputs) {

        let paramsToOverwrite = {};

        if (inputs && inputs.length > 0) {
            
          for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];


            if (input.values) {
                Object.keys(input.values).forEach(variableName => {
                    const value = input.values[variableName];
                    const mediaType = this.nodeMetadata.AllowedVariableOverrides[variableName]?.mediaType || "text";

                    if (nullUndefinedOrEmpty(paramsToOverwrite[variableName])) {
                        paramsToOverwrite[variableName] = {};
                    }

                    if (mediaType == "composite") {
                        paramsToOverwrite[variableName] = value;
                    } else {
                        let inputOfType = null;

                        // See if there is a matching media type in the input
                        if (value && value[mediaType]) {
                            inputOfType = value[mediaType];
                        }
                        
                        paramsToOverwrite[variableName] = inputOfType;
                    }
                }
                );
            }
            }
        }

        return paramsToOverwrite;
    }

    gatherHistory(inputs) {

        let history = [];

        if (inputs && inputs.length > 0) {
          for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (input.history) {
                history = this.mergeAndDedupeHistories(history, input.history);
            }
          }
        }

        return history;
    }

    async gatherInputs({channel, inputs, stateMachine, record, additionalParams, debuggingTurnedOn}) {
        if (!record || nullUndefinedOrEmpty(record.recordID)) {
            throw new Error("gatherInputs: record must have a recordID");
        }

        let overwriteParams = this.overwriteInputParams(inputs);
        let history = this.gatherHistory(inputs);

        Object.assign(additionalParams, overwriteParams, { history });
    }

    
    async preProcess({channel, inputs, stateMachine, record, additionalParams, debuggingTurnedOn}) {
        if (!record || nullUndefinedOrEmpty(record.recordID)) {
            throw new Error("preProcess: record must have a recordID");
        }

        await this.messageStart({channel, stateMachine, record, debuggingTurnedOn});
        await this.messageSendField(channel, record.recordID, "processing", true);
    }

    async runImpl(runParams) {
        throw new Error('runImpl not implemented');
    }

    async run(params) {
        const { record, wasCancelled} = params;
        
        const haltReason = wasCancelled && wasCancelled();
        if (haltReason) {
            return {
                error: { message: haltReason }
            };
        }

        let results = {
            state: "completed", // the default
         };
        try {

            //
            // Run the implementation
            //
            const runImplResults = await this.runImpl({params: record.params, ...params });

            const completionTime = new Date();

            results = {
                ...results,
                ...runImplResults,
                context: { ...record.context || {}, ...runImplResults.context || {} },
                completionTime,
                executionTime: completionTime.getTime() - record.startTime.getTime(),
            };       

            
        } catch (e) {
            results.error = e;
            results.state = "failed";
            console.error(`nodeType.runImpl for ${this.fullNodeDescription.nodeType} failed! `, e);
        }

        return results;
    }

    convertOutputToMessageContent(output) {

        const nodeAttributes = this.nodeMetadata.nodeAttributes;

        const defaultOutputField = nodeAttributes.defaultOutputField;
        const defaultOutput = output?.[defaultOutputField];

        return defaultOutput || {};
    }

    async postProcess({channel, results, stateMachine, record, debuggingTurnedOn}) {


        if (results.state == "completed") {
            
            // send final output to the client
            await this.messageSendField(channel, record.recordID, "processing", false);
            await this.messageSendField(channel, record.recordID, "executionTime", record.executionTime);
            await this.messageSendField(channel, record.recordID, "completionTime", record.completionTime);
            await this.messageSendField(channel, record.recordID, "content", this.convertOutputToMessageContent(results.output));

        } else if (results.state == "failed") {
            
            await this.messageSendField(channel, record.recordID, "error", debuggingTurnedOn ? record.error : { message: "An error occurred"});
        }

        await this.messageSendField(channel, record.recordID, "processing", false);
        await this.messageSendField(channel, record.recordID, "state", record.state);
        await this.messageEnd({channel, record, debuggingTurnedOn});
    }

    async onSubtreeCompleted(subtreeCompleteParams) {
        // no-op
        return null;
    }
}