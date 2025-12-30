import vm from "vm";
import { Config } from "@src/backend/config";

export const defaultCodeStartingLines = [
    "async function DoTurn({params, inputs, context}) {",
    "  // Put whatever state you want preserved inside context",
    "",
    "  /********** ONLY EDIT BELOW THIS  LINE **********/",
];

export const defaultCodeEndingLines = [
    "}",
    ""
];


export function getCodeStartingLines() {

    let newCodeStartingLines = [...defaultCodeStartingLines];

    return newCodeStartingLines;
  }

export function getCodeEndingLines() {
    return defaultCodeEndingLines;
  } 

function customCodeLog(logType, ...messages) {
    let logString = `${logType}: `;

    logString += messages.map(message => {
        if (typeof message === 'object') {
            try {
                return JSON.stringify(message);
            } catch {
                return String(message);
            }
        }
        return message?.toString?.() ?? String(message);
    }).join(' ');

    return logString;
}

export function composeFullFunctionCode(startingCode, customCode, endingCode) {
    const startString = startingCode.join('\n');
    const codeString = (typeof customCode == 'string') ? customCode : "";
    const endString = endingCode.join('\n');
    return startString + "\n" + codeString + "\n" + endString;
  }

export function generateFullFunctionFromUserCode(customCode) {
    let startingCode = getCodeStartingLines();
    let endingCode = getCodeEndingLines();
    return composeFullFunctionCode(startingCode, customCode, endingCode);
  }


export async function updateParamsWithCustomCode(llmParameters, llmContext, mostRecentData, userTurnsSoFar) {
    const { Constants } = Config;
    if (llmParameters.code_UNSAFE) {
        const codeToUse = generateFullFunctionFromUserCode(llmParameters.code_UNSAFE);
        try {   

            if (!llmContext.turnHandlerContext) {
                llmContext.turnHandlerContext = {}
            } else {
                llmContext.turnHandlerContext = {...llmContext.turnHandlerContext};
            }

            Constants.debug.logCode && console.error(" &&& Running custom code");
            Constants.debug.logCode && console.error("**************************************");
            Constants.debug.logCode && console.error(llmParameters.code_UNSAFE);
            Constants.debug.logCode && console.error("**************************************");
            Constants.debug.logCode && console.error("turnHandlerContext [BEFORE]: ", llmContext.turnHandlerContext);
            
            let consoleLogs = [];
            let codeContext = {
                console: {
                    log: (...args) => {
                        const logString = customCodeLog('LOG', ...args);
                        // print the arguments into a string as if to the console
                        Constants.debug.logCode && console.error(logString);
                        consoleLogs.push(logString);
                    },
                    warn: (...args) => {
                        const logString = customCodeLog('WARN', ...args);
                        // print the arguments into a string as if to the console
                        Constants.debug.logCode && console.error(logString);
                        consoleLogs.push(logString);
                    },
                    error: (...args) => {
                        const logString = customCodeLog('ERROR', ...args);
                        // print the arguments into a string as if to the console
                        Constants.debug.logCode && console.error(logString);
                        consoleLogs.push(logString);
                    },
                }
            };

            const script = new vm.Script(codeToUse);

            /////////////////////////////
            // RUN THE SCRIPT!!
            /////////////////////////////
            script.runInNewContext(codeContext);

            let doTurnParams = {...mostRecentData,  turn: userTurnsSoFar+1 };

            Constants.debug.logCode && console.error(" &&& Calling DoTurn() ", typeof codeContext.DoTurn);
            let codeUpdates = await codeContext.DoTurn({...llmParameters}, doTurnParams, llmContext.turnHandlerContext);
            Constants.debug.logDataParsing && console.error(" &&& -> OUTPUT: ", JSON.stringify(codeUpdates, null, 2));
            Constants.debug.logDataParsing && console.error(" &&& -> NEW CONTEXT: ", JSON.stringify(llmContext.turnHandlerContext, null, 2));

            if (codeUpdates.newPromptValues) {
                Object.keys(codeUpdates.newPromptValues).map((key) => {
                    if (typeof codeUpdates.newPromptValues[key] !== 'undefined' && codeUpdates.newPromptValues[key] != null) {
                        Constants.debug.logCode && console.error(" &&& -> NEW PROMPT VALUE: ", key, " = ", codeUpdates.newPromptValues[key]);
                        llmParameters[key] = codeUpdates.newPromptValues[key];
                    }
                });
            }

            Constants.debug.logCode && console.error("turnHandlerContext [AFTER]: ", llmContext.turnHandlerContext);
            Constants.debug.logCode && console.error("**************************************");

            return { 
                ...codeUpdates,
                logs: consoleLogs,
            };
        } catch (error) {
            Constants.debug.logCode && console.error("#### Failed to eval custom code: : ", error);
            Constants.debug.logCode && console.error("   # CODE : ", codeToUse);

            return {
                error: error,
            };
        }
    }
}
