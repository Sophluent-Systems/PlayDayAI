import { nodeType } from  './nodeType.js';

export class startNode extends nodeType {

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

          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "text": params.text,
                },
            },
        }

        return returnVal;
    }
}