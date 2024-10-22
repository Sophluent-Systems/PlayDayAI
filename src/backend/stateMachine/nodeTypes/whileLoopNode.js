import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { FlowControlNode } from './FlowControlNode.js';
import { Config } from "@src/backend/config";
import { parseAsDiscreteTypeIfPossible } from '@src/common/objects';


export class whileLoopNode extends FlowControlNode {
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
        const { Constants } = Config

        let returnVal = {
            state: "completed",
            output: {
                 index: {},
            }
        }
 
 
        if (typeof params.value === "undefined" || typeof params.comparator === "undefined" || typeof params.compareValue === "undefined") {
             throw new Error("whileLoop: undefined value: value=" + params.value + " comparator=" + params.comparator + " compareValue=" + params.compareValue);
        }

        let value = params.value;

        if (typeof value === "object") {
            if (!nullUndefinedOrEmpty(value.text)) {
                value = value.text;
            } else if (!nullUndefinedOrEmpty(value.data)) {
                value = value.data;
            }
        }

        value = parseAsDiscreteTypeIfPossible(value);

        let compareValue = params.compareValue;

        compareValue = parseAsDiscreteTypeIfPossible(compareValue);

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
                throw new Error("whileLoop: unknown comparator: " + params.comparator);
        }

        Constants.debug.logWhileLoop && console.error(`While loop compare value=${value}(${typeof value}) ${params.comparator} ${compareValue}(${typeof compareValue}) -> `, result ? "TRUE" : "FALSE");

        this.setLocalVariable(record, "comparisonResult", result);
 
        if (result) {
            returnVal.eventsEmitted = ["loop"];
        } else {
            this.markEndOfFlowControl(record);
             returnVal.eventsEmitted = ["completed"];
        }
 
        returnVal.output.value = {};
        if (typeof params.value == "string") {
            returnVal.output.value = {
                "text": params.value,
            }
        } else {
            returnVal.output.value = {
                "data": params.value,
            }
        }
          
        return returnVal;
     }
     
     async flowControlShouldContinue(subtreeCompleteParams) {
         const { Constants } = Config;
 
         let { record } = subtreeCompleteParams;
 
         const comparisonResult = this.getLocalVariable(record, "comparisonResult");
 
         if (typeof comparisonResult === "undefined") {
             throw new Error("whileLoop: comparisonResult was not set");
         } 
         
         if (comparisonResult) {
             Constants.debug.logForLoop && console.error(`WHILE LOOP:  return TRUE`);
             return true;
         } else {
            Constants.debug.logForLoop && console.error(`WHILE LOOP:  return FALSE`);
             return false;
         } 
     }
}