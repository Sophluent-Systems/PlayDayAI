import { 
  generateInstructionsFromPromptParameters,
  generateMessageArrayWithInstructions,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";


const roleTranslations = {
  'user' : 'USER:',
  'system' : 'ASSISTANT:',
  'instruct' : 'ASSISTANT:',
  'assistant' : 'ASSISTANT:',
  'compressed' : 'ASSISTANT:',
}

function generateMessageHistoryPrompt(promptParameters, messages) {
  
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
  });

  let prompt = `${promptParameters.identity.name} - ${promptParameters.identity.description}` + "\n\n" + promptParameters.context + "\n\n";
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    prompt += `${promptParameters.outputFormatInstructions}` + "\n\n";
  }


  if (promptMessages.length > 0) {
      prompt += "The following is a chat below between USER (the player) and ASSISTANT (the game):\n"; 
      prompt += promptMessages.map((message) => `${message.role} ${message.content["text"]}`).join('\n');
  }

  const mostRecentUserMessageIndex = getMostRecentMessageOfType(messages, ['user', 'assistant'], -1);

  prompt += "\n\n";
  //if (mostRecentUserMessageIndex == -1 || messages[mostRecentUserMessageIndex].role == 'assistant') {
  //  prompt += "USER: ";
  //} 

  prompt += turnInstructions + "\n\nASSISTANT:";

  return prompt;
}


export default {
  generateMessageHistoryPrompt,
 }