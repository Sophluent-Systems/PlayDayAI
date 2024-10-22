import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';
import { Config } from "@src/backend/config";
import { getBlobFromStorage } from '@src/backend/blobstorage';

const whisperApiEndpoint = "https://api.openai.com/v1/audio/transcriptions";

export class sttNode extends nodeType {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    
    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, stateMachine, seed, keySource}) {
        const { Constants } = Config

        Constants.debug.logSTT && console.error("STT: Running with params: ", params);

        if (nullUndefinedOrEmpty(params.audio)) {
            console.error("STT: No audio file provided for speech-to-text conversion");
            throw new Error("No audio file provided for speech-to-text conversion");
        }
        
        let blob;
        let fileName;
        if (params.audio.source == "storage") {

          Constants.debug.logSTT && console.error("STT: Fetching blob: ", params.audio.data);
          const storageEntry = await getBlobFromStorage(stateMachine.db, params.audio.data);
          // Get the file extension based on the storageEntry.mimeType  
          const buffer = Buffer.from(storageEntry.data, 'base64');
          const fileExtension = storageEntry.mimeType.split("/")[1];
          fileName = `audio.${fileExtension}`
          blob = new Blob([buffer], { type: storageEntry.mimeType, name: fileName });

        } else {

          throw new Error("Unsupported source type for audio");
        }
        
        const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "openAIkey") : params.apiKey;

        //
        // Upload blob as a file to the API
        //
        const formData = new FormData();
        formData.append("model", "whisper-1");
        formData.append("response_format", "text");
        formData.append("file", blob, fileName);
        const headers = {
          Authorization: `Bearer ${apiKeyToUse}`,
        };

        let options = {
          method: "POST",
          body: formData,
          mode: "cors",
          headers: headers,
        };

        const response = await fetch(
          params.serverUrl,
          options
        );

        if (response.status !== 200) {
          console.error("STT: Response status: ", response.status);
          console.error("STT: Response statusText: ", response.statusText);
          throw new Error("whisper error: status=" + response.status);
        }

        const responseText = await response.text();

        Constants.debug.logSTT && console.error("STT: Response: ", responseText);

        let returnVal = {
          state: "completed",
          eventsEmitted: ["completed"],
          output: {
              result: {
                  "text": responseText,
              },
          },
          context: {
              ...params
          }
        };

        return returnVal;
    }
}