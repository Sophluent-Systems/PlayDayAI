import { nullUndefinedOrEmpty } from '@src/common/objects';
import { llmNode } from './llmNode';

export class llmDataNode extends llmNode {

  
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    async getLLMParams(params, stateMachine, seed, keySource, inputs = {}) {
        const sanitizedParams = {...params};
        if (sanitizedParams.llmParameters) {
          delete sanitizedParams.llmParameters;
        }

        let llmParameters = {...await super.getLLMParams(sanitizedParams, stateMachine, seed, keySource)};

        const aggregatedSources = [];
        const externalDataForContext = [];

        if (Array.isArray(params.dataSources)) {
          params.dataSources.forEach((source, index) => {
            if (nullUndefinedOrEmpty(source)) {
              return;
            }
            if (typeof source === 'string') {
              aggregatedSources.push(source);
              externalDataForContext.push({ source: `configured_source_${index + 1}`, value: source });
            } else if (typeof source === 'object') {
              const serialized = JSON.stringify(source, null, 2);
              aggregatedSources.push(serialized);
              externalDataForContext.push({ source: source.label ?? `configured_source_${index + 1}`, value: source });
            }
          });
        }

        if (inputs && typeof inputs === 'object') {
          Object.entries(inputs).forEach(([key, value]) => {
            if (nullUndefinedOrEmpty(value)) {
              return;
            }
            const payload = value?.result ?? value;
            const textParts = [];
            if (!nullUndefinedOrEmpty(payload?.text, true)) {
              textParts.push(payload.text);
            }
            if (payload?.data) {
              try {
                textParts.push(JSON.stringify(payload.data, null, 2));
              } catch (error) {
                textParts.push(String(payload.data));
              }
            }
            if (payload?.metadata) {
              try {
                textParts.push(JSON.stringify(payload.metadata, null, 2));
              } catch (error) {
                textParts.push(String(payload.metadata));
              }
            }
            if (textParts.length > 0) {
              const formatted = `Source "${key}":\n${textParts.join("\n")}`;
              aggregatedSources.push(formatted);
              externalDataForContext.push({ source: key, value: payload });
            }
          });
        }

        if (aggregatedSources.length > 0) {
          const supplementalMessageText = `Additional data sources available for this turn:\n\n${aggregatedSources.join("\n\n---\n\n")}`;
          const supplementalMessage = {
            role: "system",
            content: {
              text: supplementalMessageText,
            },
            personaSource: "builtin",
            persona: {
              displayName: "Data Sources",
            },
          };
          if (!Array.isArray(llmParameters.messages)) {
            llmParameters.messages = [];
          }
          llmParameters.messages.push(supplementalMessage);
          llmParameters.externalDataSources = externalDataForContext;
        }

        if (nullUndefinedOrEmpty(llmParameters.dataFieldsPassType)) {
          llmParameters.dataFieldsPassType = params.dataFieldsPassType ?? "all";
        }

        return llmParameters;
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, inputs, channel, stateMachine, record, seed, debuggingTurnedOn, keySource, wasCancelled}) {

      params.llmParameters = await this.getLLMParams(params, stateMachine, seed, keySource, inputs);

      let returnVal;
        // If there are no data fields to request, this is a no-op and returns an empty object
      if (!nullUndefinedOrEmpty(params.llmParameters.outputDataFields)) {
          // We need to send the data fields to the AI
          returnVal = await super.runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled});

          const output = returnVal.output;

          const data = returnVal.output.result.data;

          let modifiedOutputs = {};

          if (!nullUndefinedOrEmpty(data)) {
              modifiedOutputs.result = {
                data: data
              };

              // Loop through all the outputDataFields and if we got one in the results, add it to the output
              params.llmParameters.outputDataFields.forEach(dataField => {
                const variableName = dataField.variableName;
                if (typeof data[variableName] != "undefined") {
                  if (dataField.dataType == "array") {
                    modifiedOutputs[variableName] = {
                      data: data[variableName]
                    };
                  } else {
                    modifiedOutputs[variableName] = {
                      text:  `${data[variableName]}`
                    };
                  }
                }
              });
          }

          returnVal.output = modifiedOutputs;

      } else {
        
          // Nothing to do!
          returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {},
            context: {
                seed: seed,
                rawResponse: "",
                model: "",
                inputFormat: "",
                outputFormat: "",
                prompt: "",
                llmContext: {},
            }
          };
      }

      return returnVal;
  }
}
