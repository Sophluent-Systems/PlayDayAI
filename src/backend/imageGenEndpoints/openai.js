
import { Config } from "@src/backend/config";
import OpenAI from 'openai';
import { getAccountServiceKey } from "@src/backend/accounts";


async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
      throw new Error(`Failed to fetch ${imageUrl}: ${response.statusText}`);
  }
  const buffer = await response.buffer();
  return buffer;
}

async function doTxt2ImgRequest(params) {
    const { keySource } = params;
    const { Constants } = Config;

    const apiParams = {
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: `${params.width}x${params.height}`,
      response_format: "b64_json",
    }

    Constants.debug.logImageGen &&  console.error("openAI image gen params: ", apiParams)

    const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "openAIkey") : params.apiKey;

    const openai = new OpenAI({
      apiKey: apiKeyToUse
    });

    const response = await openai.images.generate(apiParams);    
    const data = response.data[0];
    const base64img = data.b64_json;

    const buffer = Buffer.from(base64img, 'base64');

    return buffer;
    
}

export default {
  doTxt2ImgRequest
};