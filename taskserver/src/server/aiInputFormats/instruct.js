
import { 
  generateInstructionsFromPromptParameters,
  generateMessageArrayWithInstructions,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";
import { nullUndefinedOrEmpty } from "@src/common/objects";


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
  let promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
  });

  let prompt = `### Instruction:\n${promptParameters.identity.name} - ${promptParameters.identity.description}` + "\n\n" + promptParameters.context + "\n\n";
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    prompt += `${promptParameters.outputFormatInstructions}` + "\n\n";
  }

  if (promptMessages.length > 0) {
      prompt += "Below is a chat between USER (the player) and ASSISTANT (the game):\n";  
      prompt += promptMessages.map((message) => `${message.role} ${message.content}`).join('\n');
  }

  prompt += "\n\n";
  prompt += turnInstructions; // + "\n\n Respond as 'ASSISTANT', then stop before 'USER'.";

  prompt += "\nASSISTANT:\n### Response:";


  return prompt;
}

export default {
  generateMessageHistoryPrompt,
}
