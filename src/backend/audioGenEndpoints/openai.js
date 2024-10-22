
import { Config } from "@src/backend/config";
import OpenAI from 'openai';
import { getAccountServiceKey } from "@src/backend/accounts";

async function doTxt2AudioRequest(params) {
  const { keySource } = params;
  const { Constants } = Config;

  const apiParams = {
    model: params.model || "tts-1",
    input: params.text,
    voice: params.voice || "alloy",
  }

  if (params.speed) {
    apiParams.speed = params.speed;
  }

  Constants.debug.logTTS &&  console.error("openAI TTS params: ", apiParams)

  const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "openAIkey") : params.apiKey;

  const openai = new OpenAI({
    apiKey: apiKeyToUse
  });

  const mp3 = await openai.audio.speech.create(apiParams);

  Constants.debug.logTTS &&  console.error("openAI TTS result: ", mp3)
  
  const buffer = Buffer.from(await mp3.arrayBuffer());

  return {
      "mimeType": "audio/mp3",
      "data": buffer,
      "source": "buffer",
  };
}

export default {
  doTxt2AudioRequest
};