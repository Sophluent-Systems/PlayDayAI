import { 
  generateInstructionsFromPromptParameters,
  generateMessageArrayWithInstructions,
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

/*

<|im_start|>system
You are Dolphin, a helpful AI assistant.<|im_end|>
<|im_start|>user
{prompt}<|im_end|>
<|im_start|>assistant

*/



export function generateMessageHistoryPrompt(promptParameters, messages) {
  
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
  });
  
  let newPrompt =  "<|im_start|>system\n" + `${promptParameters.identity.name} - ${promptParameters.identity.description}` + "\n\n" + promptParameters.context;
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    newPrompt += "\n\n" + `${promptParameters.outputFormatInstructions}`;
  }
  newPrompt += "<|im_end|>\n";

  for (let j = 0; j < promptMessages.length; j++) {
    const { content, role } = promptMessages[j];

    if (typeof content == 'string') {
      if (role === 'user') {
        newPrompt += "<|im_start|>user\n" + content;
      } else if (role === 'assistant') {
        newPrompt += "<|im_start|>assistant\n" + content;
      } else if (role === 'system') {
        newPrompt += "<|im_start|>assistant\n" + content;
      } else {
        throw new Error(`Invalid message role: ${role}`)
      }

      if (j == promptMessages.length - 1) {
        newPrompt += "\n\n" + turnInstructions;
      }

      newPrompt +=  "<|im_end|>\n";
    }
  }

  newPrompt += "<|im_start|>assistant\n";

  return newPrompt;
}

export default {
  generateMessageHistoryPrompt,
}
