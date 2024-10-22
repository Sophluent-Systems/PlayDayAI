import { nullUndefinedOrEmpty } from '../../../common/objects.js';
import { nodeType } from  './nodeType.js';
import { doImageGeneration } from '@src/backend/imageGen.js';

export class imageGeneratorNode extends nodeType {
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

        let prompt = params.prompt;

        if (!nullUndefinedOrEmpty(params.extraPromptParams)) {
                prompt = prompt + "\n" + params.extraPromptParams;
        }

        console.error("txt2img prompt: ", prompt);

          const result = await doImageGeneration({seed, keySource, ...params ,prompt: prompt});
          
          console.error("Received result from txt2img: ", result);

          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "image": result,
                },
            },
            context: {
                ...params,
                prompt: prompt,
            }
        }

        return returnVal;
    }
}