import { nullUndefinedOrEmpty } from '../../../common/objects';
import { llmNode } from './llmNode';

export class llmDataNode extends llmNode {

  
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    async getLLMParams(params, stateMachine, seed, keySource) {
        let llmParameters = {...await super.getLLMParams(params, stateMachine, seed, keySource)};

        return llmParameters;
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, keySource, wasCancelled}) {

      if (!params.llmParameters) {
        params.llmParameters = await this.getLLMParams(params, stateMachine, seed, keySource);
      }

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