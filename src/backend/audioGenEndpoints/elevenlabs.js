
import { Config } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { ElevenLabsClient } from "elevenlabs";
import { getAccountServiceKey } from "@src/backend/accounts";

async function doTxt2AudioRequest(params) {
  const { keySource } = params;
  const { Constants } = Config;

  const apiParams = {
    model_id: params.model || "tts-1",
    text: params.text,
    voice: params.voice || "Rachel",
  }

  const voice = params.voice || "alloy";

  Constants.debug.logTTS &&  console.error("ElevenLabs TTS params: ", apiParams)
  Constants.debug.logTTS &&  console.error("ElevenLabs TTS apiKey: ", params.apiKey)

  const apiKeyToUse = keySource.source == 'account' ? getAccountServiceKey(keySource.account, "elevenLabsKey") : params.apiKey;

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKeyToUse
  })
  
  const audio = await elevenlabs.generate(apiParams);
  
  Constants.debug.logTTS && console.error("ElevenLabs TTS result: ", audio)
  
  return {
      "mimeType": "audio/mp3",
      "data": audio,
      "source": "buffer",
  };


}

export default {
  doTxt2AudioRequest
};