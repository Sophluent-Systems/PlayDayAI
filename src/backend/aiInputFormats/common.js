import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getMostRecentMessageOfType } from "@src/common/messages";

export function generateInstructionsFromPromptParameters(promptParameters, isFirstTurn=false) {

    let instructions = '';
    if ( isFirstTurn && !nullUndefinedOrEmpty(promptParameters.zerothTurnInstructions)) {
      instructions += promptParameters.zerothTurnInstructions;
    } else if (promptParameters.turnInstructions) {
      instructions += promptParameters.turnInstructions;
    }

    return instructions;
}

export function addInstructionsToLastMessage(messages, instructions) {
        let lastMessage = messages[messages.length - 1];
        lastMessage.content = `${lastMessage.content}\n\n${instructions}`;
        messages[messages.length - 1] = lastMessage;
        return messages;
}


export function generateMessageArrayWithInstructions({messages, caseToSet, roleTranslations, systemMessage, turnInstructions}) {

    let promptMessages = [];
    if (!nullUndefinedOrEmpty(systemMessage, true)) {
      const systemRole = roleTranslations ? roleTranslations["system"] : "ASSISTANT";
      promptMessages.push({ 
        role: caseToSet == "upperCase" ? systemRole.toUpperCase() : systemRole.toLowerCase(),
        content: systemMessage
      });
    }

    if (messages && messages.length > 0) {
      messages.map((message, index) =>  {
        const textContent = message.content?.text;
        if (nullUndefinedOrEmpty(textContent, true)) {
           // drop messages without text content
           return;
        }
        let role = roleTranslations ? roleTranslations[message.role] : message.role;
        if (nullUndefinedOrEmpty(role)) {
            throw new Error(`roleTranslations is not defined for role: ${message.role}`);
        }
        if (caseToSet) {
          role = caseToSet == "upperCase" ? role.toUpperCase() : role.toLowerCase();
        }
        promptMessages.push({ role: role, content: textContent});
      });
    }

    if (!nullUndefinedOrEmpty(turnInstructions)) {
      const turnInstructionsRole = roleTranslations ? roleTranslations["assistant"] : "ASSISTANT";
      promptMessages.push({
        role: caseToSet == "upperCase" ? turnInstructionsRole.toUpperCase() : turnInstructionsRole.toLowerCase(),
        content: turnInstructions
      })
    }
  
    return promptMessages;
}

export function generateChatInstructMessage({promptParameters, messages}) {

  const chatInstructRoleTranslations = {
    'user' : 'user',
    'system' : 'system',
    'instruct' : 'system',
    'assistant' : 'assistant',
    'compressed' : 'system',
 }

 
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  let turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));

  let newPrompt = `Provide the next response for ${promptParameters.identity.name} - ${promptParameters.identity.description}.` + "\n\n" + promptParameters.context;
  
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    newPrompt += `${promptParameters.outputFormatInstructions}`;
  }

  newPrompt += "\n---\n";

  for (let j = 0; j < messages.length; j++) {
    const message = messages[j];

    if (message.deleted) {
      continue;
    }

    const textContent = message.content?.text;
    if (nullUndefinedOrEmpty(textContent, true)) {
       // drop messages without text content
       return;
    }

    let identity = (message.personaSource != "builtin") ? message.persona?.displayName : null;

    if (nullUndefinedOrEmpty(identity)) {
      identity = chatInstructRoleTranslations[message.role];
    }

    newPrompt += `${identity}: ${textContent}\n`;

  }

  if (!nullUndefinedOrEmpty(turnInstructions.trim())) {
    newPrompt += turnInstructions;
  }

  newPrompt += `\n${promptParameters.identity.name}: `;

  return newPrompt;
}

