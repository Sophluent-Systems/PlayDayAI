import { nullUndefinedOrEmpty } from "@src/common/objects";

function generateOutputFormatInstructions(promptParameters) {
  
    let outputFormatInstructions = "";

    let dataFieldInstructions = "";
    if (!nullUndefinedOrEmpty(promptParameters.outputDataFields)) {
        for (let dataField of promptParameters.outputDataFields) {
                dataFieldInstructions += "\n" + `            ${dataField.variableName}:  <${dataField.dataType}>, // ${dataField.instructions}`;
        }

      outputFormatInstructions = "\n\nComplete following JSON object, filling in only these fields:\n{";
      outputFormatInstructions += dataFieldInstructions;
      outputFormatInstructions += "\n}";
    }
    
    return outputFormatInstructions;
  }
  
  export default {
    generateOutputFormatInstructions,
  }
 