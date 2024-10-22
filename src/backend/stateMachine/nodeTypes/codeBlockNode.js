import { ContextAwareNode } from './ContextAwareNode.js';
import { generateFullFunctionFromUserCode } from '@src/common/customcode.js'
import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { Config } from "@src/backend/config";
import vm from 'vm';


export class codeBlockNode extends ContextAwareNode {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    customCodeLog(logType, ...messages) {
        // Convert all messages to a string and concatenate them
        var logString = logType + ': ';
        
        logString += messages.map(message => {
            if (typeof message === 'object') {
                // Stringify objects
                return JSON.stringify(message);
            } else {
                // Convert non-objects to string
                return message.toString();
            }
        }).join(' ');
    
        // Add the log string to the global array
        return logString;
    }
        

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, inputs, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled}) {
        const { Constants } = Config

        let returnVal = {
            state: "completed",
            output: {
                result: {},
            },
            context: {}
        }

        console.error(" codeBlockNode.runImpl starting for inputs=", inputs, "\n\n params=", params, "...");

        if (!nullUndefinedOrEmpty(params.code_UNSAFE)) {

            const codeToUse = generateFullFunctionFromUserCode(params.code_UNSAFE);
    
            Constants.debug.logCode && console.error("**************************************");
            Constants.debug.logCode && console.error("  Running custom code");
            Constants.debug.logCode && console.error("--------------------------------------");
            Constants.debug.logCode && console.error(codeToUse);
            Constants.debug.logCode && console.error("--------------------------------------");
            
            let consoleLogs = [];
            let callbackContext = {
                console: {
                    log: (...args) => {
                        const logString = this.customCodeLog('LOG', ...args);
                        // print the arguments into a string as if to the console
                        Constants.debug.logCode && console.error(logString);
                        consoleLogs.push(logString);
                    },
                    warn: (...args) => {
                        const logString = this.customCodeLog('WARN', ...args);
                        // print the arguments into a string as if to the console
                        Constants.debug.logCode && console.error(logString);
                        consoleLogs.push(logString);
                    },
                    error: (...args) => {
                        const logString = this.customCodeLog('ERROR', ...args);
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
            script.runInNewContext(callbackContext);

            Constants.debug.logCode && console.error(" &&& Calling DoTurn() ", typeof callbackContext.DoTurn);
                  

            let codeContext = this.getLocalVariable(record, "codeContext", {});
            let paramsToUse = {...params};
            delete paramsToUse.code_UNSAFE;
            if (paramsToUse.persona) {
                delete paramsToUse.persona;
            }
            let codeResult = {};
            try {
                codeResult = await callbackContext.DoTurn({params: paramsToUse, inputs, context: codeContext});
            } catch (error) {
                console.error("Error in custom code: ", error);
                returnVal.state = "failed";
                returnVal.error = { message: error.message };
            }

            Constants.debug.logDataParsing && console.error("   -> OUTPUT: ", codeResult);

            Constants.debug.logCode && console.error(" -> CONTEXT [AFTER]: ", codeContext);
            Constants.debug.logCode && console.error("**************************************");

            this.setLocalVariable(record, "codeContext", codeContext);

            if (typeof codeResult === 'string') {
                returnVal.output.result = {
                    "text": codeResult,
                }
            } else {
                returnVal.output.result = {
                    "data": codeResult,
                }
            }
            returnVal.context = {
                ...returnVal.context,
                consoleLogs: consoleLogs,
                codeContext: codeContext,
            }
            returnVal.eventsEmitted = ["completed"];
        }
        
        return returnVal;
    }
}