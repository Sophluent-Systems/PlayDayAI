import { 
  generateInstructionsFromPromptParameters,
  generateMessageArrayWithInstructions,
} from "./common";
import { getMostRecentMessageOfType } from "@src/common/messages";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const roleTranslations = {
   'user' : 'user',
   'system' : 'assistant',
   'instruct' : 'assistant',
   'assistant' : 'assistant',
   'compressed' : 'assistant',
}


function generateAsAlternatingMessages(messages) {

  let alternatingMessages = [];
  let lastRole = null;
  messages.map((message, index) => {
    if (lastRole == message.role) {
      let lastMessage = alternatingMessages.pop();
      lastMessage.content = `${lastMessage.content}\n\n${message.content}`;
      alternatingMessages.push(lastMessage);
    } else {
      alternatingMessages.push(message);
      lastRole = message.role;
    }
  });
  return alternatingMessages;
}


function generateMessageHistoryPrompt(promptParameters, messages) {
  
  if (messages.length < 1) {
    throw new Error("anthropic generateMessageHistoryPrompt: No messages yet, which is not allowed by Anthropic Claude");
  }

  let systemMessage = `${promptParameters.identity.name} - ${promptParameters.identity.description}\n\n${promptParameters.context}`;
  if (!nullUndefinedOrEmpty(promptParameters.zerothTurnInstructions)) {
    systemMessage += "\n\n" + `${promptParameters.outputFormatInstructions}`;
  }

    // To determine if this is the pre-first-turn case, check to see if there are any 'user' messages in the history so far
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  let translatedMessages = generateMessageArrayWithInstructions(messages, false, roleTranslations)
  let promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
    systemMessage,
  });

  promptMessages = generateAsAlternatingMessages(promptMessages);

  if (promptMessages[promptMessages.length - 1].role != 'user') {
    promptMessages.push({role: 'user', content: turnInstructions});
  } else {
    promptMessages[promptMessages.length - 1].content = `${promptMessages[promptMessages.length - 1].content}\n\n${turnInstructions}`;
  }
  if (nullUndefinedOrEmpty(promptMessages[promptMessages.length - 1].content)) {
    promptMessages[promptMessages.length - 1].content = "Continue the conversation.";
  };
  
  return JSON.stringify(promptMessages);
}

export default {
  generateMessageHistoryPrompt
}