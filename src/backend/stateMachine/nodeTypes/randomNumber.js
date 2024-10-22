import { nodeType } from  './nodeType.js';

export class randomNumberNode extends nodeType {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, stateMachine, seed}) {


          let low = params.low;
          let high = params.high;
          const numberType = params.numberType || "integer";

          // ensure "low" and "high" are numbers
          if (typeof low !== "number") {
              low = parseFloat(low);
          }
          if (typeof high !== "number") {
              high = parseFloat(high);
          }

          let number = 0;

            if (numberType == "integer") {
                
                // ensure "low" and "high" are numbers
                if (typeof low !== "number") {
                    low = parseInt(low);
                }
                if (typeof high !== "number") {
                    high = parseInt(high);
                }

                // generate a random number inclusive of "low" and exclusive of "high"
                number = Math.floor(Math.random() * (high - low)) + low;
            } else if (numberType == "float") {
                // ensure "low" and "high" are numbers
                if (typeof low !== "number") {
                    low = parseFloat(low);
                }
                if (typeof high !== "number") {
                    high = parseFloat(high);
                }

                // generate a random number inclusive of "low" and exclusive of "high"
                number = Math.random() * (high - low) + low;
            } else {
                throw new Error("randomNumber: numberType of '" + numberType + "' is not supported");
            }


          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "text": `${number}`,
                },
            },
        }

        return returnVal;
    }
}