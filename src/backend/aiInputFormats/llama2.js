import { 
  generateInstructionsFromPromptParameters,
  addInstructionsToLastMessage,
  generateMessageArrayWithInstructions,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";

const roleTranslations = {
   'user' : 'user',
   'system' : 'system',
   'instruct' : 'system',
   'assistant' : 'assistant',
   'compressed' : 'system',
}



function generateMessageHistoryPrompt(promptParameters, messages) {
  
  
  
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  
  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
  });

  let newPrompt =  `[INST] <<SYS>>${promptParameters.identity.name} - ${promptParameters.identity.description}` + "\n\n" + promptParameters.context;

  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    newPrompt += "\n\n" + `${promptParameters.outputFormatInstructions}`;
  }

  if (promptMessages.length > 0) {
    newPrompt += "\n\nBelow is a chat between USER (the player) and ASSISTANT (the game).";
  }

  newPrompt += "<</SYS>>\n";  

  for (let j = 0; j < promptMessages.length; j++) {
    const { content, role } = promptMessages[j];

    if (typeof content == 'string') {
      if (role === 'user') {
        newPrompt += "USER: " + content + "\n";
      } else if (role === 'assistant') {
        newPrompt += "ASSISTANT: " + content + "\n";
      } else if (role === 'system') {
        newPrompt += "ASSISTANT: " + content + "\n";
      } else {
        throw new Error(`Invalid message role: ${role}`)
      }
    }
  }

  newPrompt += "ASSISTANT: " + turnInstructions + "\n[/INST] ASSISTANT: ";

  return newPrompt;
}


export default {
  generateMessageHistoryPrompt,
 }