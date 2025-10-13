import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';
import { doImageGeneration } from '../../imageGen.js';

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

          const generationResult = await doImageGeneration({seed, keySource, ...params ,prompt: prompt});
          const imagePath = generationResult?.path ?? generationResult;
          const metadata = generationResult?.metadata;
          
          console.error("Received result from txt2img: ", imagePath);

          let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {
                result: {
                    "image": imagePath,
                },
            },
            context: {
                ...params,
                prompt: prompt,
            }
        }

        if (metadata && Object.keys(metadata).length > 0) {
            returnVal.output.result.metadata = metadata;
            returnVal.context.metadata = metadata;
        }

        return returnVal;
    }
}
