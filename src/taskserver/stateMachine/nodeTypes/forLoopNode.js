import { FlowControlNode } from './FlowControlNode.js';
import { Config } from "@src/backend/config";

export class forLoopNode extends FlowControlNode {
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
       
       let index = this.getLocalVariable(record, "index");

       Constants.debug.logForLoop && console.error("Starting for loop... index=", index)

       if (typeof index === "undefined") {
            
        Constants.debug.logForLoop && console.error("Configuring for loop with params=", params)

            let startIndex = params.start;

            if (typeof startIndex != "number") {
                // attempt to parse as a number
                try {
                    startIndex = parseInt(startIndex);
                } catch (e) {
                    throw new Error("forLoop: start value of '" + params.start + "' is not a number");
                }

                // if startindex is NaN, then it's not a number
                if (isNaN(startIndex)) {
                    throw new Error("forLoop: start value of '" + params.start + "' is not a number");
                }
            }

            let endIndex = params.end;

            if (typeof endIndex != "number") {
                // attempt to parse as a number
                try {
                    endIndex = parseInt(endIndex);
                } catch (e) {
                    throw new Error("forLoop: end value of '" + params.end + "' is not a number");
                }

                // if endindex is NaN, then it's not a number
                if (isNaN(endIndex)) {
                    throw new Error("forLoop: end value of '" + params.end + "' is not a number");
                }
            }
        
            this.setLocalVariable(record, "endIndex", endIndex);

            index = startIndex;

       } else {
            index = index + 1;
       }


       this.setLocalVariable(record, "index", index);

       // get the "end" value as it's been parsed as a number
       const endIndex = this.getLocalVariable(record, "endIndex");

       if (index >= endIndex) {
            this.markEndOfFlowControl(record);
            returnVal.eventsEmitted = ["completed"];
       } else {
            returnVal.eventsEmitted = ["loop"];
       }

       returnVal.output.index = {
            "text": `${index}`,
       }
                
       return returnVal;
    }
    
    async flowControlShouldContinue(subtreeCompleteParams) {
        const { Constants } = Config;
        let { record } = subtreeCompleteParams;

        const index = this.getLocalVariable(record, "index");
        const endIndex = this.getLocalVariable(record, "endIndex");

        if (typeof index === "undefined") {
            throw new Error("forLoop: index was not set");
        } 
        
        if (index >= endIndex) {
            // this forLoop completed at some point
            Constants.debug.logForLoop && console.error(`FOR LOOP: index=${index} > endIndex=${endIndex} -- for loop completed return FALSE`);
            return false;
        } else {
            Constants.debug.logForLoop && console.error(`FOR LOOP: index=${index} <= endIndex=${endIndex} -- for loop NOT completed return TRUE`);
            return true;
        }
    }
}