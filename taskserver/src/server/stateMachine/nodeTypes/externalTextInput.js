import { nodeType } from  './nodeType.js';

export class externalTextInput extends nodeType {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, stateMachine, record, inputs, channel}) {

        
        return {
            output: null,
            state: "waitingForExternalInput",
            waitingFor: ["text"],
            eventsEmitted: [],
        };
    }
}