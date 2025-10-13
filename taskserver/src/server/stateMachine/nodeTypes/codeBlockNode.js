import { ContextAwareNode } from './ContextAwareNode.js';
import { generateFullFunctionFromUserCode } from '@src/common/customcode.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { Config } from "@src/backend/config";
import vm from 'vm';

const MAX_CONSOLE_LOG_ENTRIES = 400;
const MAX_CONSOLE_ENTRY_LENGTH = 4000;
const DEFAULT_EXECUTION_TIMEOUT_MS = 30000;
const MIN_EXECUTION_TIMEOUT_MS = 250;
const MAX_EXECUTION_TIMEOUT_MS = 300000;
const DEFAULT_SANDBOX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function clampExecutionTimeout(requestedTimeout) {
  const parsed = Number(requestedTimeout);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EXECUTION_TIMEOUT_MS;
  }
  return Math.max(MIN_EXECUTION_TIMEOUT_MS, Math.min(MAX_EXECUTION_TIMEOUT_MS, Math.floor(parsed)));
}

function resolveSandboxTTL(params) {
  const ttlHours = Number(params?.sandboxTTLHours);
  if (Number.isFinite(ttlHours) && ttlHours > 0) {
    return Math.max(1, ttlHours) * 60 * 60 * 1000;
  }
  return DEFAULT_SANDBOX_TTL_MS;
}

function truncateLogEntry(entry) {
  if (typeof entry !== "string") {
    return entry;
  }
  if (entry.length <= MAX_CONSOLE_ENTRY_LENGTH) {
    return entry;
  }
  return `${entry.slice(0, MAX_CONSOLE_ENTRY_LENGTH)}…`;
}

function appendConsoleLog(logs, entry) {
  logs.push(truncateLogEntry(entry));
  if (logs.length > MAX_CONSOLE_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_CONSOLE_LOG_ENTRIES);
  }
}

async function runWithTimeout(fn, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fn();
  }

  let timeoutHandle = null;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Custom code execution timed out after ${timeoutMs} ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export class codeBlockNode extends ContextAwareNode {

    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    customCodeLog(logType, ...messages) {
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
        

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, inputs, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled}) {
        const { Constants } = Config;

        let returnVal = {
            state: "completed",
            output: {
                result: {},
            },
            context: {}
        };

        Constants.debug.logCode && console.error("codeBlockNode.runImpl starting for inputs=", inputs, "\nparams=", params);

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
                        Constants.debug.logCode && console.error(logString);
                        appendConsoleLog(consoleLogs, logString);
                    },
                    warn: (...args) => {
                        const logString = this.customCodeLog('WARN', ...args);
                        Constants.debug.logCode && console.error(logString);
                        appendConsoleLog(consoleLogs, logString);
                    },
                    error: (...args) => {
                        const logString = this.customCodeLog('ERROR', ...args);
                        Constants.debug.logCode && console.error(logString);
                        appendConsoleLog(consoleLogs, logString);
                    },
                }
            };

            const script = new vm.Script(codeToUse);

            /////////////////////////////
            // RUN THE SCRIPT!!
            /////////////////////////////
            script.runInNewContext(callbackContext);

            Constants.debug.logCode && console.error(" &&& Calling DoTurn() ", typeof callbackContext.DoTurn);
                  

            const now = Date.now();
            const sandboxTTL = resolveSandboxTTL(params);
            let codeContext = this.getLocalVariable(record, "codeContext", {});
            const createdAt = Number(codeContext.__createdAt ?? now);
            let sandboxReset = false;

            if (params.resetSandbox === true || (Number.isFinite(createdAt) && now - createdAt > sandboxTTL)) {
                codeContext = { __createdAt: now, __resetAt: now, __runCounter: 0 };
                sandboxReset = true;
            } else {
                codeContext.__createdAt = createdAt;
                codeContext.__runCounter = codeContext.__runCounter ?? 0;
            }

            let paramsToUse = {...params};
            delete paramsToUse.code_UNSAFE;
            if (paramsToUse.persona) {
                delete paramsToUse.persona;
            }

            const executionTimeoutMs = clampExecutionTimeout(params.maxExecutionTimeMs);

            let codeResult = {};
            let executionError = null;
            try {
                codeResult = await runWithTimeout(
                    () => callbackContext.DoTurn({params: paramsToUse, inputs, context: codeContext}),
                    executionTimeoutMs
                );
                codeContext.__runCounter = (codeContext.__runCounter ?? 0) + 1;
            } catch (error) {
                executionError = error;
                console.error("Error in custom code: ", error);
                returnVal.state = "failed";
                returnVal.error = { message: error.message };
            } finally {
                codeContext.__lastRunAt = now;
            }

            Constants.debug.logDataParsing && console.error("   -> OUTPUT: ", codeResult);

            Constants.debug.logCode && console.error(" -> CONTEXT [AFTER]: ", codeContext);
            Constants.debug.logCode && console.error("**************************************");

            this.setLocalVariable(record, "codeContext", codeContext);

            if (executionError == null) {
                if (typeof codeResult === 'string') {
                    returnVal.output.result = {
                        "text": codeResult,
                    };
                } else {
                    returnVal.output.result = {
                        "data": codeResult,
                    };
                }
                returnVal.eventsEmitted = ["completed"];
            }

            returnVal.context = {
                ...returnVal.context,
                consoleLogs: consoleLogs,
                codeContext: codeContext,
                sandbox: {
                    resetApplied: sandboxReset,
                    ttlMs: sandboxTTL,
                    executionTimeoutMs,
                },
            };
        }
        
        return returnVal;
    }
}
