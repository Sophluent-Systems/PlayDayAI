import { nodeType } from  './nodeType.js';

export class delayNode extends nodeType {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, seed}) {

          
        let delay = params.delay;

        // attempt to parse as a number
        try {
            delay = parseFloat(delay);
        } catch (e) {
            throw new Error("arrayIndex: index value of '" + params.index + "' is not a number");
        }

        const delayInMS = delay * 1000;

        // set a timeout for delay milliseconds
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, delayInMS)
        });

        let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {},
            },
        }

        return returnVal;
    }
}