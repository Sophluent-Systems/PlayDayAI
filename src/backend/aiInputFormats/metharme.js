import { 
  generateInstructionsFromPromptParameters,
  generateMessageArrayWithInstructions,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";


const roleTranslations = {
  'user' : '<|user|>',
  'system' : '<|system|>',
  'instruct' : '<|model|>',
  'assistant' : '<|model|>',
  'compressed' : '<|system|>',
}





function generateMessageHistoryPrompt(promptParameters, messages) {
  
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
  });

  let prompt = `<|system|>${promptParameters.identity.name} - ${promptParameters.identity.description}` + "\n\n" + promptParameters.context + "\n\n";

  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    newPrompt += `${promptParameters.outputFormatInstructions}` + "\n\n";
  }

  const mostRecentUserMessageIndex = getMostRecentMessageOfType(messages, ['user', 'assistant'], -1);

  if (promptMessages.length > 0) {
      prompt += "The following is a chat below between USER (the player) and ASSISTANT (the game):\n"; 
      prompt += promptMessages.map((message, index) => {
        if (index == mostRecentUserMessageIndex) {
          return `${message.role == 'user' ? '<|user|>' : '<|model|>'}${message.content["text"]}`;
        } else {
          return `${message.role} ${message.content["text"]}`;
        }
      }).join('\n');
  }


  prompt += "\n\n";
  //if (mostRecentUserMessageIndex == -1 || messages[mostRecentUserMessageIndex].role == 'assistant') {
  //  prompt += "USER: ";
  //} 

  //prompt += "<|system|>" + turnInstructions; // + "\n\n Respond as 'ASSISTANT', then stop before 'USER'.";
  prompt += turnInstructions;

  prompt += `\nASSISTANT:<|model|>`;


  return prompt;
}

export default {
  generateMessageHistoryPrompt,
 }