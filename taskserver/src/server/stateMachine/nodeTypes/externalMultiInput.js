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

        const supportedTypes = Array.isArray(params.supportedTypes) ? params.supportedTypes : [];
        const supportedModes = Array.isArray(params.supportedModes) ? params.supportedModes : [];
        const waitingFor = new Set(supportedTypes);

        if (supportedModes.includes('stt') || supportedModes.includes('audio')) {
            waitingFor.add('audio');
        }
        if (supportedModes.includes('text')) {
            waitingFor.add('text');
        }

        if (waitingFor.size === 0) {
            waitingFor.add('text');
        }

        return {
            output: null,
            state: "waitingForExternalInput",
            waitingFor: Array.from(waitingFor),
            eventsEmitted: [],
        };
    }
}
