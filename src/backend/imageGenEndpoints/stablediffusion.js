
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from "@src/backend/accounts";

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

  const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "stabilityAIKey") : params.apiKey;

  if (!nullUndefinedOrEmpty(apiKeyToUse)) {
    headers["Authorization"] = `Bearer ${apiKeyToUse}`;
  }


  const requestOptions = {
    method: "POST",
    headers: headers,
    body: formData,
    responseType: "arraybuffer"
  };

  const url = params.serverUrl + `/${params.model}`;

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