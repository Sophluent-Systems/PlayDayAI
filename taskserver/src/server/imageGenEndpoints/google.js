
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from "@src/backend/accounts";

async function doTxt2ImgRequest(params) {
  const { keySource } = params;
  const { Constants } = Config;

  const formData = {
    prompt: params.prompt,
    output_format: "png",
    seed: params.seed ? params.seed : -1,

  };

  if (!nullUndefinedOrEmpty(params.negativePrompt)) {
    formData.negative_prompt = params.negativePrompt;
  }

  let headers = { 
    Accept: "image/*" 
  };


  const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "googleLLMKey") : params.apiKey;

  if (!nullUndefinedOrEmpty(apiKeyToUse)) {
    headers["Authorization"] = `Bearer ${apiKeyToUse}`;
  }

  Constants.debug.logImageGen &&  console.log("txt2img params: ", formData)

  const requestOptions = {
    method: "POST",
    headers: headers,
    body: formData,
    responseType: "arraybuffer"
  };

  const response = await fetch(params.url, requestOptions);

  let buffer;
  const metadata = {};
  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    Constants.debug.logImageGen &&  console.log("txt2img returned file size=", buffer.length);
    const synthId = response.headers?.get?.("x-goog-synthid");
    if (!nullUndefinedOrEmpty(synthId, true)) {
      metadata.synthId = synthId;
    }
  } else {
    const failResponse = await response.text();
    const message = `stable diffusion API failure: status=${response.status}, response=${failResponse}`;
    console.error(message);
    throw new Error(message);
  }

  return {
    buffer,
    metadata
  };
}

export default {
  doTxt2ImgRequest
};
