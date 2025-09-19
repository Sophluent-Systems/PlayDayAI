import { 
  generateInstructionsFromPromptParameters,
  addInstructionsToLastMessage,
  generateMessageArrayWithInstructions,
  generateChatInstructMessage,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const roleTranslations = {
   'user' : 'user',
   'system' : 'system',
   'instruct' : 'system',
   'assistant' : 'assistant',
   'compressed' : 'system',
}


function generateMessageHistoryPrompt(promptParameters, messages) {

  let systemMessage = `${promptParameters.identity.name} - ${promptParameters.identity.description}\n\n${promptParameters.context}`;
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    systemMessage += "\n\n" + `${promptParameters.outputFormatInstructions}`;
  }

  // To determine if this is the pre-first-turn case, check to see if there are any 'user' messages in the history so far
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
    systemMessage,
    turnInstructions,
  });

  if (promptMessages.length > 0 && nullUndefinedOrEmpty(promptMessages[promptMessages.length - 1].content)) {
    // remove the last message if it's empty
    promptMessages.pop();
  };

  return JSON.stringify(promptMessages);
}

export default {
  generateMessageHistoryPrompt
}