import { FlowControlNode } from './FlowControlNode.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

export class arrayIteratorNode extends FlowControlNode {
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
           output: {
                index: {},
           }
       }

       if (nullUndefinedOrEmpty(params.array) || !Array.isArray(params.array)) {
            throw new Error("Array parameter is empty or not an array" + JSON.stringify(params.array));
       }

       
       let index = this.getLocalVariable(record, "index");

       console.error("Array iterator loop... index=", index)

       if (typeof index === "undefined") {
            
            index = 0;

            let endIndex = params.array.length;

            this.setLocalVariable(record, "endIndex", endIndex);

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
            let result = params.array[index];
    
            returnVal.output.result = {};
            
            // if result is an object, return it as data, otherwise return it as text
    
            if (typeof result != "object") {
                returnVal.output.result = {
                    "text": `${result}`,
                }
            } else {
                returnVal.output.result = {
                    "data": result,
                }
            }
    
            returnVal.output.index = {
                "text": `${index}`,
            }
            

            returnVal.eventsEmitted = ["loop"];
       }
       
                
       return returnVal;
    }
    
    async flowControlShouldContinue(subtreeCompleteParams) {

        let { record } = subtreeCompleteParams;

        const index = this.getLocalVariable(record, "index");
        const endIndex = this.getLocalVariable(record, "endIndex");

        if (typeof index === "undefined") {
            throw new Error("arrayIterator: index was not set");
        } 
        
        if (index >= endIndex) {
            // this arrayIterator completed at some point
            console.error(`FOR LOOP: index=${index} > endIndex=${endIndex} -- for loop completed return FALSE`);
            return false;
        } else {
            console.error(`FOR LOOP: index=${index} <= endIndex=${endIndex} -- for loop NOT completed return TRUE`);
            return true;
        }
    }
}