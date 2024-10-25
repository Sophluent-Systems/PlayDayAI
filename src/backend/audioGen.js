import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import ElevenLabs from './audioGenEndpoints/elevenlabs.js';
import OpenAI from './audioGenEndpoints/openai.js';

const endpoints = {
    openai: OpenAI.doTxt2AudioRequest,
    elevenlabs: ElevenLabs.doTxt2AudioRequest,
}

async function writeAudioFile(buffer, extension="mp3") {

  // buffer should be in binary format (decoded from Base64 or fetched from a URL, etc.)

  // Generate a unique filename using UUID and assume .png extension.
  // You can improve this by determining the file type from the response header or the URL.
  const filename = `${uuidv4()}.${extension}`;
  const subFolder = "gen/audio";

  // Define the path to save the image
  const folderToUse = path.join(process.cwd(), 'public', subFolder);    
  const fullPath = path.join(folderToUse, filename);

  // ensure the directory exists
  try {
      await fs.access(folderToUse);
  } catch (error) {
      console.log("Error acessing image folder: ", error);
      console.log("This is not necessarily fatal... attempting to create the folder now.")
      await fs.mkdir(folderToUse);
  }
  
  await fs.writeFile(fullPath, buffer);

  // Return the relative path to the saved image
  return `/${subFolder}/${filename}`;
}


export async function doAudioGen(params) {
    
    if (!params.endpoint) {
        throw new Error("doAudioGen: endpoint not specified");
    }

    const endpoint = endpoints[params.endpoint];

    let endpointResult = await endpoint(params);

    if (endpointResult.source == "buffer") {

      // get file extension from the MIME type
      const extension = endpointResult.mimeType.split("/")[1];

      const fileName = await writeAudioFile(endpointResult.data, extension);

      return {
          "mimeType": endpointResult.mimeType,
          "data": fileName,
          "source": "url",
      };

    } else if (endpointResult.source == "url") {

       return endpointResult;

    } else {
        throw new Error("doAudioGen: endpoint did not return a buffer or a URL");
    }
  }

