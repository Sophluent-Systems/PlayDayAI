import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import StableDiffusion from './imageGenEndpoints/stablediffusion.js';
import OpenAI from './imageGenEndpoints/openai.js';
import Google from './imageGenEndpoints/google.js';

const endpoints = {
    stablediffusion: StableDiffusion.doTxt2ImgRequest,
    openai: OpenAI.doTxt2ImgRequest,
    google: Google.doTxt2ImgRequest,
}

export async function doImageGeneration(params) {
    
    if (!params.endpoint) {
        throw new Error("doImageGeneration: endpoint not specified");
    }

    const endpoint = endpoints[params.endpoint];

    const buffer = await endpoint(params);

    // buffer should be in binary format (decoded from Base64 or fetched from a URL, etc.)

    // Generate a unique filename using UUID and assume .png extension.
    // You can improve this by determining the file type from the response header or the URL.
    const filename = `${uuidv4()}.png`;
    
    // Define the path to save the image
    const imagefolder = path.join(process.cwd(), '../public', 'gen/images');    
    const imageFullPath = path.join(imagefolder, filename);

    // ensure the directory exists
    try {
      await fs.access(imagefolder);
    } catch (error) {
      console.log("Error accessing image folder: ", error);
      console.log("This is not necessarily fatal... attempting to create the folder now.");
      try {
        await fs.mkdir(imagefolder, { recursive: true });
        console.log("Successfully created image folder:", imagefolder);
      } catch (mkdirError) {
        console.error("FATAL: Failed to create image folder:", mkdirError);
        throw mkdirError;
      }
    }
    
    try {
      await fs.writeFile(imageFullPath, buffer);
      console.log("Successfully wrote image to:", imageFullPath);
    } catch (writeError) {
      console.error("FATAL: Failed to write image file:", writeError);
      throw writeError;
    }

    // Return the relative path to the saved image
    return `/gen/images/${filename}`;
  }
  