import { nodeType } from  './nodeType.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { Config } from "@src/backend/config";
import { getBlobFromStorage } from '@src/backend/blobstorage';

export class audioPlaybackNode extends nodeType {

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
        const { Constants } = Config;

        let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {},
        }

        let finalAudioOutput = {
            audioType: params.audioType || "speech",
            loop: params.loop || false,
            autoplay: params.autoplay || "onlyFirstTime",
        }

        if (params.audio.source == "storage") {

          Constants.debug.logSTT && console.error("STT: Fetching blob: ", params.audio.data);
          const storageEntry = await getBlobFromStorage(stateMachine.db, params.audio.data);

          // generate a URL that will work in a browser
          const url = `data:${storageEntry.mimeType};base64,${storageEntry.data}`;

            finalAudioOutput = {
                ...finalAudioOutput,
                "mimeType": storageEntry.mimeType,
                "data": url,
                "source": "url",
            }

        } else if (params.audio.source == "url"){

            finalAudioOutput = {
                ...finalAudioOutput,
                ...params.audio
            }

        } else if (params.audio.source == "buffer"){

          // generate a base64 URL for the buffer
          const base64 = params.audio.data.toString('base64');
          const mimeType = params.audio.mimeType;

          // generate a URL that will work in a browser
          const url = `data:${mimeType};base64,${base64}`;

            finalAudioOutput = {
                ...finalAudioOutput,
                "mimeType": mimeType,
                "data": url,
                "source": "url",
            }

        } else {
            throw new Error("Unsupported source type for audio");
        } 
         
        returnVal.output.result = {
            audio: finalAudioOutput,
        };

        if (!nullUndefinedOrEmpty(params.text)) {
            returnVal.output.result.text = params.text;
        }

        return returnVal;
    }
}