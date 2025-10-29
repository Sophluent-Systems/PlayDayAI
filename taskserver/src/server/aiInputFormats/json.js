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
  
  let systemMessage = `${promptParameters.identity.name} - ${promptParameters.identity.description}\n\n${promptParameters.context}`;
  if (!nullUndefinedOrEmpty(promptParameters.outputFormatInstructions)) {
    systemMessage += "\n\n" + `${promptParameters.outputFormatInstructions}`;
  }
  const lastUserMessageIndex = getMostRecentMessageOfType(messages, ['user']);
  const turnInstructions = generateInstructionsFromPromptParameters(promptParameters, (lastUserMessageIndex == -1));
    
  const promptMessages = generateMessageArrayWithInstructions({
    messages: messages, 
    caseToSet: 'lowerCase', 
    roleTranslations,
    systemMessage,
    turnInstructions,
  });

  const finalMessageList = promptMessages.map(({ role, content }) => ({
    role,
    content,
  }));

  const promptPayload = {
    previousMessages: finalMessageList,
  };

  const prompt = `INPUT: ${JSON.stringify(promptPayload, null, 2)}\n`;

  return prompt;
}


function generateOutputFormatInstructions(promptParameters) {
  
    let outputFormatInstructions = "";

    let dataFieldInstructions = "";
    if (promptParameters.dataFieldsPassType && promptParameters.outputDataFields && promptParameters.outputDataFields.length > 0) {
        for (let dataField of promptParameters.outputDataFields) {
          if ((!dataField.passType && promptParameters.dataFieldsPassType == 'preProcess') ||
              dataField.passType === promptParameters.dataFieldsPassType ||
              promptParameters.dataFieldsPassType === 'all') {
                dataFieldInstructions += "\n" + `            ${dataField.variableName}:  <${dataField.dataType}>, // ${dataField.instructions}`;
          }
        }
    }

    if (dataFieldInstructions) {
      outputFormatInstructions = "\n\nComplete following JSON object, filling in only these fields:\n{";
      outputFormatInstructions += dataFieldInstructions;
      outputFormatInstructions += "\n}";
    }
    
    return outputFormatInstructions;
  }
  
 export default {
  generateMessageHistoryPrompt,
  generateOutputFormatInstructions
 }
