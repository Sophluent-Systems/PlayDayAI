import { nullUndefinedOrEmpty, setNestedObjectProperty } from '@src/common/objects.js';
import { nodeType } from  './nodeType.js';
import { Config } from "@src/backend/config";
import { v4 as uuidv4 } from 'uuid';


export class ContextAwareNode extends nodeType {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});

    }

    prepExecutionContext({ history, record }) {
        const { Constants } = Config;

        //
        // Walk the record history from oldest to newest,
        // and build up the execution context from the
        // context of each record.
        //
        Constants.debug.logContextNodes && console.error("[CONTEXT] BEGIN produceStack for node type ", this.fullNodeDescription.nodeType);

        Constants.debug.logContextNodes && console.error("[CONTEXT] History length=", history.length);

        // Clear locals here so we can rebuild them -- perminant entries belong
        // in the stack frame
        record.context.executionContext.locals = {};
        record.context.executionContext.includedStackIDs = [];

        let seenStackIDs = {};
        if (!nullUndefinedOrEmpty(history)) {
            for (let i = history.length-1; i >= 0; i--) {
                const ancestorRecord = history[i]; 
                if (!nullUndefinedOrEmpty(ancestorRecord.context.executionContext?.stackFrame)) {
                    if (!seenStackIDs[ancestorRecord.context.executionContext.stackID]) {
                        seenStackIDs[ancestorRecord.context.executionContext.stackID] = true;
                        Constants.debug.logContextNodes && console.error(`[CONTEXT]          MERGING STACK in record for ID ${ancestorRecord.context.executionContext.stackID} `, ancestorRecord.nodeType, "\n", ancestorRecord.context.executionContext?.stackFrame);
                        
                        // We're going back in time, so we need to merge the stackFrame to the back
                        // not the front
                        if (record.context.executionContext.stackPopped) {
                            // If the stack has been popped, we can't add to it, and we need to invalidate locals found previously, above this
                            // threshold in the stack
                            record.context.executionContext.locals = {};
                            record.context.executionContext.includedStackIDs = [];
                        } else {
                            record.context.executionContext.locals = {...ancestorRecord.context.executionContext.stackFrame, ...record.context.executionContext.locals};
                            record.context.executionContext.includedStackIDs.push(ancestorRecord.context.executionContext.stackID);
                        }
                    } else {
                        Constants.debug.logContextNodes && console.error(`[CONTEXT]  SKPPING DUPE STACK ID in record  for ID ${ancestorRecord.context.executionContext.stackID} `, ancestorRecord.nodeType, "\n", ancestorRecord.context.executionContext?.stackFrame);
                    }
                }
            }
        }

        Constants.debug.logContextNodes && console.error("[CONTEXT]  FINAL LOCALS=\n", record.context.executionContext.locals);
    }

    async processExecutionContext(genContextParams) {
        const { Constants } = Config;

        const { history, record, executionContext, debuggingTurnedOn} = genContextParams;

        if (nullUndefinedOrEmpty(record.context)) {
            record.context = {};
        }

        if (nullUndefinedOrEmpty(record.context.executionContext)) {
            Constants.debug.logContextNodes && console.error("[CONTEXT]  NO EXECUTION CONTEXT FOUND - CREATING");            
            record.context.executionContext = {
                locals: {},
                stackFrame: {},
                stackID: uuidv4(),
            };
        }

        this.prepExecutionContext({ history, record });

        Constants.debug.logContextNodes && console.error("[CONTEXT]  FINAL EXECUTION CONTEXT=\n", record.context.executionContext);
    }

    getLocalVariable(record, path, defaultValue=undefined) {
        const value = record.context.executionContext.locals[path];
        if (typeof value !== 'undefined') {
            return value;
        } else {
            this.setLocalVariable(record, path, defaultValue);
            return defaultValue;
        }
    }

    setLocalVariable(record, path, value) {
        const { Constants } = Config;

        record.context.executionContext.stackFrame[path] = value;
        record.context.executionContext.locals[path] = value;

        Constants.debug.logContextNodes && console.error("[CONTEXT]  SETTING LOCAL VARIABLE ", path, " TO ", value);
        Constants.debug.logContextNodes && console.error("[CONTEXT]  stackFrame=\n", record.context.executionContext.stackFrame);
    }

    popExecutionStack(record) {
        const { Constants } = Config;

        Constants.debug.logContextNodes && console.error("[CONTEXT]  POPPING STACK ", record.context.executionContext.stackID);
        record.context.executionContext.stackPopped = true;
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled}) {
       throw new Error("runImpl not implemented for ContextAwareNode");
    }

}