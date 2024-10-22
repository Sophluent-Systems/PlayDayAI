import { nodeType } from  './nodeType.js';
import { doAudioGen } from '@src/backend/audioGen.js';

export class ttsNode extends nodeType {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, seed, keySource}) {

          const result = await doAudioGen({...params, seed, keySource});

          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "text": params.text,
                    "audio": result,
                },
                text: {
                    "text": params.text,
                }
            },
            context: {
                ...params
            }
        }

        return returnVal;
    }
}