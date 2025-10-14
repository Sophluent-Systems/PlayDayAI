import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';
import { doImageGeneration } from '../../imageGen.js';
import { applyStableDiffusionGuardrail } from '@src/common/stableDiffusionGuardrails.js';

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

        const baseParams = params ?? {};
        const guardrailedParams =
          (baseParams?.endpoint ?? "") === "stablediffusion"
            ? applyStableDiffusionGuardrail(baseParams.model, baseParams)
            : { ...baseParams };

        const promptSections = [];
        if (!nullUndefinedOrEmpty(guardrailedParams.prompt)) {
                promptSections.push(guardrailedParams.prompt);
        }
        if (!nullUndefinedOrEmpty(guardrailedParams.extraPromptParams)) {
                promptSections.push(guardrailedParams.extraPromptParams);
        }
        const combinedPrompt = promptSections.join("\n");

        console.error("txt2img prompt: ", combinedPrompt);

        const paramsForGeneration = {
            ...guardrailedParams,
            prompt: combinedPrompt
        };

        const generationResult = await doImageGeneration({seed, keySource, ...paramsForGeneration});
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
                ...paramsForGeneration,
            }
        }

        if (metadata && Object.keys(metadata).length > 0) {
            returnVal.output.result.metadata = metadata;
            returnVal.context.metadata = metadata;
        }

        return returnVal;
    }
}
