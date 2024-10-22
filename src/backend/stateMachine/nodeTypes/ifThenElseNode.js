import { nodeType } from  './nodeType.js';
import { Config } from "@src/backend/config";
import { parseAsDiscreteTypeIfPossible } from '@src/common/objects';

export class ifThenElseNode extends nodeType {
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
        const { Constants } = Config;

        let returnVal = {
            state: "completed",
            output: {
                 index: {},
            }
        }
 
        Constants.debug.logIfThenElse && console.error(`If/Then compare value=${params.value} ${params.comparator} ${params.compareValue}`);
 
        if (typeof params.value === "undefined" || typeof params.comparator === "undefined" || typeof params.compareValue === "undefined") {
             throw new Error("If/Then: undefined value: value=" + params.value + " comparator=" + params.comparator + " compareValue=" + params.compareValue);
        }

        const value = parseAsDiscreteTypeIfPossible(params.value);
        const compareValue = parseAsDiscreteTypeIfPossible(params.compareValue);

        let result=true;
        switch (params.comparator) {
            case "==":
                result = value == compareValue;
                break;
            case "!=":
                result = value != compareValue;
                break;
            case "<":
                result = value < compareValue;
                break;
            case "<=":
                result = value <= compareValue;
                break;
            case ">":
                result = value > compareValue;
                break;
            case ">=":
                result = value >= compareValue;
                break;
            default:
                throw new Error("If/Then: unknown comparator: " + params.comparator);
        }

        if (result) {
            returnVal.eventsEmitted = ["then", "completed"];
        } else {
             returnVal.eventsEmitted = ["else", "completed"];
        }
 
        returnVal.output.value = {};
        if (typeof value == "string") {
            returnVal.output.value = {
                "text": value,
            }
        } else {
            returnVal.output.value = {
                "data": value,
            }
        }
          
        return returnVal;
    }
}