import { nodeType } from  './nodeType.js';

export class externalMultiInput extends nodeType {
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

        const supportedTypes = params.supportedTypes;
        
        return {
            output: null,
            state: "waitingForExternalInput",
            waitingFor: supportedTypes,
            eventsEmitted: [],
        };
    }
}