import { nodeType } from  './nodeType.js';
import { getBlobFromStorage } from '@src/backend/blobstorage';

export class staticTextNode extends nodeType {

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

          let text = params.text;

          if (typeof text === "object") {
            if (text.source == "storage") {
                const storageEntry = await getBlobFromStorage(stateMachine.db, text.data);

                // convert storageEntry.data from base64 to utf8
                text = Buffer.from(storageEntry.data, 'base64').toString('utf8');
            }
        }

          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "text": text,
                },
            },
        }

        

        return returnVal;
    }
}