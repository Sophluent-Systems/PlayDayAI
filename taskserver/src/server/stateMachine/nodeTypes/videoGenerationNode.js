import { nodeType } from './nodeType.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { doVideoGeneration } from '../../videoGen.js';

export class videoGenerationNode extends nodeType {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, seed, keySource }) {
    if (nullUndefinedOrEmpty(params?.prompt, true)) {
      throw new Error("videoGenerationNode: prompt is required");
    }

    const prompt = params.prompt;
    const videoSettings = params.videoGenerationSettings ?? {};

    const generationResult = await doVideoGeneration({
      prompt,
      videoGenerationSettings: videoSettings,
      endpoint: params.endpoint,
      apiKey: params.apiKey,
      serverUrl: params.serverUrl,
      model: params.model,
      keySource,
      seed,
    });

    const output = {
      result: {
        video: generationResult.path,
      },
    };

    if (generationResult.metadata) {
      output.result.metadata = generationResult.metadata;
    }

    return {
      state: "completed",
      eventsEmitted: ["completed"],
      output,
      context: {
        ...params,
        prompt,
        videoGenerationSettings: videoSettings,
      },
    };
  }
}

export default videoGenerationNode;
