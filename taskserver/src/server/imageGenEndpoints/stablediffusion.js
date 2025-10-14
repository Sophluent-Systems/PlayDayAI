
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from "@src/backend/accounts";

function sanitizeApiKey(rawKey) {
  if (nullUndefinedOrEmpty(rawKey, true)) {
    return null;
  }

  const trimmed = `${rawKey}`.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }

  if (trimmed.startsWith('setting:')) {
    const [, remainder] = trimmed.split(':');
    if (!remainder) {
      return null;
    }
    const [, fallbackKey] = remainder.split(';');
    if (fallbackKey && !fallbackKey.includes('xxxxxxxx')) {
      return fallbackKey.trim();
    }
    return null;
  }

  if (trimmed.includes('xxxxxxxx')) {
    return null;
  }

  return trimmed;
}

async function doTxt2ImgRequest(params) {
  const { keySource } = params;
  const { Constants } = Config;
  
  const formData = new FormData();
  formData.append("prompt", params.prompt);
  formData.append("output_format", "png");
  formData.append("seed", params.seed < 0 ? 0 : params.seed);

  if (!nullUndefinedOrEmpty(params.negativePrompt)) {
    formData.append("negative_prompt", params.negativePrompt);
  }

  let headers = { 
    Accept: "image/*" 
  };

  const resolvedKey =
    keySource?.source === 'account' && keySource?.account
      ? getAccountServiceKey(keySource.account, "stabilityAIKey")
      : params.apiKey;

  const apiKeyToUse = sanitizeApiKey(resolvedKey);

  if (!apiKeyToUse) {
    throw new Error("Stable Diffusion API key is missing. Please add a Stability AI key in Account Preferences or provide an API key for this node.");
  }

  headers["Authorization"] = `Bearer ${apiKeyToUse}`;


  const requestOptions = {
    method: "POST",
    headers: headers,
    body: formData,
    responseType: "arraybuffer"
  };

  let requestModel = params.model;
  let endpointSuffix = requestModel;

  // SD 3.5 variants use the sd3 endpoint with the model specified in the payload
  if (typeof requestModel === 'string' && requestModel.startsWith('sd3.5-')) {
    endpointSuffix = 'sd3';
    formData.append('model', requestModel);
  }

  const url = `${params.serverUrl}/${endpointSuffix}`;

  Constants.debug.logImageGen &&  console.log("txt2img url: ", url)
  Constants.debug.logImageGen &&  console.log("txt2img params: ", formData)

  const response = await fetch(url, requestOptions);

  let buffer;
  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    Constants.debug.logImageGen &&  console.log("txt2img returned file size=", buffer.length);
  } else {
    const failResponse = await response.text();
    const message = `stable diffusion API failure: status=${response.status}, response=${failResponse}`;
    console.error(message);
    throw new Error(message);
  }

  return buffer;
}

export default {
  doTxt2ImgRequest
};
