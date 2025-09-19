
export function generateOutputFormatInstructions(promptParameters) {
  
  let outputFormatInstructions = "  ";

  if (promptParameters.dataFieldsPassType) {
    for (let dataField of promptParameters.outputDataFields) {
      if ((!dataField.passType && promptParameters.dataFieldsPassType == 'preProcess') ||
            dataField.passType === promptParameters.dataFieldsPassType ||
            promptParameters.dataFieldsPassType === 'all') {
                     
           outputFormatInstructions += `- Output must include a variable name ${dataField.variableName} of type ${dataField.dataType}: ${dataField.instructions}`;
      }
      
    }
  }
  
  return outputFormatInstructions;
}

export default {
  generateOutputFormatInstructions,
}