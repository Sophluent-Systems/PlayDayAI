import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';

export class arrayIndexNode extends nodeType {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled}) {
        let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {},
            }
        }
 
        let indexToUse = params.index;

        // attempt to parse as a number
        try {
            indexToUse = parseInt(indexToUse);
        } catch (e) {
            throw new Error("arrayIndex: index value of '" + params.index + "' is not a number");
        }

        if (nullUndefinedOrEmpty(params.array) || !Array.isArray(params.array) || indexToUse >= params.array.length) {
             throw new Error("arrayIndex: undefined index: index=" + params.index + " for array=" + JSON.stringify(params.array));
        }

        let result = params.array[indexToUse];

        returnVal.output.result = {};
        
        // if result is an object, return it as data, otherwise return it as text

        if (typeof result != "object") {
            returnVal.output.result = {
                "text": `${result}`,
            }
        } else {
            returnVal.output.result = result;
        }
          
        return returnVal;
    }
}