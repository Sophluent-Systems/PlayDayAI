
import { 
  generateChatInstructMessage,
} from "./common";


function generateMessageHistoryPrompt(promptParameters, messages) {

  const chatInstructPrompt = generateChatInstructMessage({promptParameters, messages});

  return chatInstructPrompt;
}

export default {
  generateMessageHistoryPrompt
}