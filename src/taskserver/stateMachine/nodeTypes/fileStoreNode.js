import { nodeType } from  './nodeType.js';
import { nullUndefinedOrEmpty } from '@src/common/objects';

export class fileStoreNode extends nodeType {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the inputs
    // from previous node runs.
    //
    async runImpl({params, seed}) {

          
        const files = params.files;

        let returnVal = {
            state: "completed",
            eventsEmitted: ["completed"],
            output: {},
        }

        // If there are no data fields to request, this is a no-op and returns an empty object
        if (!nullUndefinedOrEmpty(files)) {
            
            let modifiedOutputs = {
                array: {
                    array: [],
                },
                count: {
                    text: files?.length || 0,
                }
            };

            if (!nullUndefinedOrEmpty(files)) {
                // Loop through all the outputDataFields and if we got one in the results, add it to the output
                files.forEach(file => {
                    console.error("File: ", file)
                    const fileName = file.fileName;
                    const mimeSections = file.file.mimeType.split('/');

                    if (!mimeSections || mimeSections.length !== 2) {
                        throw new Error(`Invalid mime type for file ${fileName}: ${file.file.mimeType}`);
                    }

                    // grab the first section of the mime type
                    const type = mimeSections[0];
                    modifiedOutputs[fileName] = {};
                    modifiedOutputs[fileName][type] = file.file;
                    let fileData = {}
                    fileData[type] = file.file;
                    modifiedOutputs.array.array.push(fileData);
                });
            }

            modifiedOutputs.result = modifiedOutputs.array;

            returnVal.output = modifiedOutputs;

        } else {
            
            // Nothing to do!
            returnVal = {
                state: "completed",
                eventsEmitted: ["completed"],
                output: {},
                context: {
                    seed: seed,
                    rawResponse: "",
                    model: "",
                    inputFormat: "",
                    outputFormat: "",
                    prompt: "",
                    llmContext: {},
                }
            };
        }

        return returnVal;
    }
}