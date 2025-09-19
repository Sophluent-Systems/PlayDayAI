import { nullUndefinedOrEmpty } from '@src/common/objects.js';
import { ContextAwareNode } from './ContextAwareNode.js';

export class FlowControlNode extends ContextAwareNode {
    constructor({db, session, fullNodeDescription}) {
        super({db, session, fullNodeDescription});
    }

    //
    // Override the runImpl function; all the
    // parameters for this node are passed in
    // already overridden with the params
    // from previous node runs.
    //
    async runImpl({params, channel, stateMachine, record, seed, debuggingTurnedOn, wasCancelled}) {
       throw new Error("runImpl not implemented for FlowControlNode");
    }

    
    async flowControlShouldContinue(flowControlParams) {
        throw new Error("flowControlShouldContinue not implemented for FlowControlNode");
    }

    async processFlowControlForThisNode(flowControlParams) {
        const { record } = flowControlParams;

        const executionContext = record.context?.executionContext;

        if (nullUndefinedOrEmpty(executionContext)) {
            throw new Error("No execution context found in record");
        }

        if (nullUndefinedOrEmpty(executionContext.includedStackIDs) ||
            !executionContext.includedStackIDs.includes(executionContext.stackID)) {
                
            console.error(`Flow control node for record of type ${record.nodeInstanceID} not included in stack, so skipping`);
            return false;
        }

        return await this.flowControlShouldContinue(flowControlParams)
    }

    markEndOfFlowControl(record) {
        this.popExecutionStack(record);
    }
}