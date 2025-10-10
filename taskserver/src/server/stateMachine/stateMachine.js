/*
 * Processor-Oriented Mental Model
 * --------------------------------
 * The task server executes graph nodes the way a simple CPU executes instructions.
 * Every node instance is an "instruction" that can only issue once its operands
 * (producer records) are ready, and the scheduler keeps the pipeline full without
 * violating data dependencies.
 *
 * This commentary assumes familiarity with processor pipelines: issue queues,
 * scoreboards, reorder buffers, branch resolution, and stall management. By
 * mapping those concepts onto node execution, the maintenance story for this
 * state machine remains approachable even as the graph of LLM and I/O nodes grows.
 * 
 * Vocabulary crosswalk:
 * - Program / basic blocks  -> versionInfo.stateMachineDescription graph
 * - Instruction issue queue -> this.plan.readyToProcess
 * - Functional units        -> individual node instances (`run` implementations)
 * - Reorder buffer          -> this.recordsInProgress plus recordHistory persistence
 * - Scoreboard              -> createPlan/findReadyToProcess/generateRunInfoForNode
 * - Branch & loop handling  -> performPostProcessAndFlowControl + RecordGraph
 *
 * 1. Fetch and decode (plan creation)
 *    - `drainQueue` repeatedly calls `createPlan`, analogous to refilling the
 *      issue queue. `createPlan` fetches the latest DAG history (records from the
 *      DB plus any in-flight executions) and deduplicates it to avoid double
 *      counting records inserted while the query was running.
 *    - `recordsByNodeInstanceID` is built so later passes can ask "which outputs
 *      has producer X committed?" in O(1), mirroring how a CPU partitions the
 *      register file or reservation stations by producer.
 *    - The very first cycle seeds the pipeline with the start node when there are
 *      no prior records, matching the reset vector of a processor.
 *
 * 2. Scoreboarding and hazard detection
 *    - `findReadyToProcess` walks every node description and, for each input edge,
 *      calls `generateUnconsumedInputsForNode`. That helper identifies the newest
 *      completed producer records that have not yet been consumed by this node,
 *      using `getMostRecentRecordConsumingNodeType` as the "last read" pointer.
 *    - `generateRunInfoForNode` assembles a run bundle when all data hazards are
 *      cleared. It enforces trigger semantics (`requireAllEventTriggers` and
 *      `requireAllInputs`) and variable availability. If any required trigger or
 *      variable is missing, the node stalls and remains un-issued.
 *    - Variable-only dependencies are handled by `applyUnconsumedVariableInputsToRunInfo`.
 *      It back-fills operand values from the latest producer outputs, respecting
 *      composite payloads defined in node metadata. Missing variables stall the
 *      node when `requireAllVariables` is set.
 *    - Pending or failed records behave like long-latency instructions. When a
 *      node returns `waitingForExternalInput` or `failed`, the existing record is
 *      replayed into the plan only after the inputs are validated against the
 *      current node signature. If the node was deleted or its inputs changed,
 *      the stale record is marked deleted to prevent phantom replays.
 *
 * 3. Issue and ready queue management
 *    - Successful hazard checks push a `runInfo` bundle into
 *      `this.plan.readyToProcess`, the equivalent of an instruction issue queue.
 *      Inputs are removed from their unconsumed lists to prevent the same
 *      operands from issuing twice, mirroring how a scoreboard marks operands as
 *      "in flight".
 *    - `applyMessageHistoryToRunInfo` fetches contextual history per input when
 *      required, similar to supplying operand history for context-aware units.
 *    - `drainQueue` enforces a `stepLimit`, trimming the ready queue if the caller
 *      only granted a fixed instruction budget for this drain cycle.
 *
 * 4. Execution stage
 *    - Once issued, `preRunProcessing` acts like register read and micro-op
 *      expansion. It materializes or clones the record, gathers persona/context,
 *      and lets the node perform `gatherInputs` and `preProcess` work. The record
 *      is pushed into `recordsInProgress`, analogous to reserving an entry in a
 *      reorder buffer.
 *    - `runInfo.nodeInstance.run` is the functional unit executing the node. Calls
 *      are concurrent: each ready node is wrapped in a promise and placed in
 *      `this.plan.processing`. `Promise.race` waits for the first completion so
 *      the scheduler can immediately recompute dependencies, just like a CPU
 *      waking up on functional-unit interrupts.
 *
 * 5. Completion, retirement, and write-back
 *    - `postProcessProcessing` validates that the node reported a legal terminal
 *      state, promotes the record to completed/failed/pending, and updates the
 *      database via RecordHistory. Successful completions clear the
 *      waitForUpdateBeforeReattempting scoreboard bit; pending results set it so
 *      we do not spin on the same instruction until external input arrives.
 *    - `nodeInstance.postProcess` is invoked before the record is considered
 *      retired, allowing nodes to emit side effects (audio updates, messages,
 *      etc.) while we still have execution context at hand.
 *    - Once committed, the record leaves `recordsInProgress`, and upstream nodes
 *      become eligible when the next planning pass observes the new completed
 *      output.
 *
 * 6. Control-flow resolution
 *    - After populating the ready queue, `performPostProcessAndFlowControl`
 *      builds a `RecordGraph`, which marks consumption edges and detects
 *      flow-control nodes whose entire subtrees have completed (loops, conditionals).
 *    - `processFlowControlSubtree` walks the flow-control tree bottom-up,
 *      mirroring how a CPU resolves branches once all dependent instructions have
 *      retired. It clones or rewires records as needed, re-inserts the updated
 *      flow-control record into the ready queue, and marks ancestor records as
 *      unconsumed so downstream nodes rescan with the new control decision.
 *
 * 7. Stall conditions and safeguards
 *    - Cancellation (`wasCancelled`) exits the drain loop immediately, like a
 *      processor flush.
 *    - Missing node instances, deleted producers, or signature mismatches cause
 *      records to be soft-deleted to avoid executing instructions with undefined
 *      operands.
 *    - Long-latency nodes (LLMs, external services) simply occupy the processing
 *      queue until their promises resolve; lighter-weight nodes retire quickly,
 *      letting the scheduler immediately replan.
 *    - Errors propagate through `onStateMachineError` and the promise chain so
 *      that a single faulty unit does not deadlock the entire pipeline.
 *
 */
import { Config } from "@src/backend/config";
import { exportRecordsAsMessageList } from '@src/backend/messageHistory';
import { RecordHistory } from './recordHistory';
import { imageGeneratorNode } from './nodeTypes/imageGeneratorNode.js';
import { sttNode } from './nodeTypes/sttNode.js';
import { ttsNode } from './nodeTypes/ttsNode.js';
import { audioPlaybackNode } from './nodeTypes/audioPlaybackNode.js';
import { llmNode } from './/nodeTypes/llmNode.js';
import { llmDataNode } from './nodeTypes/llmDataNode';
import { fileStoreNode } from './nodeTypes/fileStoreNode.js';
import { codeBlockNode } from './nodeTypes/codeBlockNode';
import { scenarioNode } from './nodeTypes/scenarioNode';
import { startNode } from './nodeTypes/startNode';
import { staticTextNode } from './nodeTypes/staticTextNode';
import { delayNode } from './nodeTypes/delayNode';
import { randomNumberNode } from './nodeTypes/randomNumber.js';
import { externalTextInput } from './nodeTypes/externalTextInput.js';
import { externalMultiInput } from './nodeTypes/externalMultiInput';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getNodePersonaDetails } from '@src/common/personainfo';
import { forLoopNode } from './nodeTypes/forLoopNode';
import { whileLoopNode } from './nodeTypes/whileLoopNode';
import { ifThenElseNode } from './nodeTypes/ifThenElseNode';
import { arrayIndexNode } from './nodeTypes/arrayIndexNode.js';
import { arrayIteratorNode } from './nodeTypes/arrayIteratorNode.js';
import { v4 as uuidv4 } from 'uuid';
import { RecordGraph } from '@src/common/recordgraph';
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { BaseError, EnsureCorrectErrorType } from '@src/common/errors';

export const nodeTypeLookupTable = {
    "start": startNode,
    "staticText": staticTextNode,
    "delay": delayNode,
    "externalTextInput": externalTextInput,
    "externalMultiInput": externalMultiInput,
    "imageGenerator": imageGeneratorNode,
    "llm": llmNode,
    "llmData": llmDataNode,
    "randomNumber": randomNumberNode,
    "fileStore": fileStoreNode,
    "codeBlock": codeBlockNode,
    "scenario": scenarioNode,
    "tts": ttsNode,
    "stt": sttNode,
    "audioPlayback": audioPlaybackNode,
    "forLoop": forLoopNode,
    "ifThenElse": ifThenElseNode,
    "whileLoop": whileLoopNode,
    "arrayIndex": arrayIndexNode,
    "arrayIterator": arrayIteratorNode,
};


export class StateMachine {
    constructor(db, session) {
        this.db = db;
        this.session = session;
        this.recordHistory = undefined;
        this.versionInfo = session.versionInfo;
        this.nodeInstances = {};
        this.plan = null;
        this.recordsInProgress = [];
        this.messageList = [];
        this.debugID = "";
    }

    logNode(instanceName, data=null) {
        console.error(this.debugID + ' ' + `#######################################`);
        console.error(this.debugID + ' ' + `############## NODE: ${instanceName}`);
        console.error(this.debugID + ' ' + `#######################################`);
        if (data) {
          console.error(JSON.stringify(data, null, 2));
        }
    }

    
    getNodeByInstanceID(instanceID) {
        // walk the state machine description and find the node with the given instanceID
        for (let j=0; j< this.versionInfo.stateMachineDescription.nodes.length; j++) {
            let node = this.versionInfo.stateMachineDescription.nodes[j];
            if (node.instanceID === instanceID) {
                return node;
            }
        }

        return null;
    }

    async load() {
        this.recordHistory = new RecordHistory(this.db, this.session.sessionID);

        await this.recordHistory.load();

        if (nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription) || nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription.nodes)) {
            // Nothing to do -- brand new version, not edited yet
            return;
        }

        if (!this.versionInfo.stateMachineDescription.nodes || this.versionInfo.stateMachineDescription.nodes.length === 0) {
            // Nothing to do -- brand new version, not edited yet
            return;
        }
        
        // 
        // Walk the state machine description and create instances
        // for each node
        //

        this.nodeInstances = {};

        for (let j=0; j< this.versionInfo.stateMachineDescription.nodes.length; j++) {
            const nodeDescription = this.versionInfo.stateMachineDescription.nodes[j];
            
            if (nodeTypeLookupTable[nodeDescription.nodeType]) {
                let nodeInstance = new nodeTypeLookupTable[nodeDescription.nodeType]({
                    db: this.db, 
                    session: this.session,
                    fullNodeDescription: nodeDescription
                });
                this.nodeInstances[nodeDescription.instanceID] = nodeInstance;
            } else if (!Object.keys(nodeTypeLookupTable).includes(nodeDescription.nodeType)) {
                throw new Error(`Node type ${nodeDescription.nodeType} not found!`);
            }
        }
    }

    getMostRecentRecordConsumingNodeType(recordsForNode, producerInstanceID) {

        if (!recordsForNode || recordsForNode.length == 0) {
            return null;
        }

        // these records are in reverse chronlogical order, so 
        // the first one that isn't deleted is the most recent
        for (let i=recordsForNode.length-1; i>=0; i--) {
            const record = recordsForNode[i];
            if (!record.deleted) {
                if (record.inputs.find(input => input.producerInstanceID === producerInstanceID)) {
                    return record;
                }
            }
        }

        return null;
    }

    getUnconsumedInputsForType(recordsByNodeInstanceID, latestConsumedRecordID, input) {
        const { Constants } = Config;
        const producerInstanceID = input.producerInstanceID;
        let recordsForProducerNode = recordsByNodeInstanceID[producerInstanceID];
        
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + "getUnconsumedInputsForType: producerInstanceID=", producerInstanceID, " record count=", recordsForProducerNode?.length ? recordsForProducerNode?.length : 0, " latestConsumedRecordID=", latestConsumedRecordID);

        if (!recordsForProducerNode || recordsForProducerNode.length == 0) {
            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `    ${producerInstanceID} 0 unconsumed records found`)
            // No previous records, or latest record was consumed
            return [];
        }
        
        if (input.triggers || input.variables) {
            recordsForProducerNode = recordsForProducerNode.filter(record => {
                if (record.deleted || record.state != "completed") {
                    return false;
                }
                // is at least one of the record.eventsEmitted in the triggers list?
                let found = false;
                if (input.triggers && !nullUndefinedOrEmpty(record.eventsEmitted)) {
                    record.eventsEmitted.forEach(event => {
                            input.triggers.forEach(trigger => {
                                if (trigger.producerEvent == event) {
                                    found = true;
                                }
                            });
                    });
                }
                if (input.variables && !nullUndefinedOrEmpty(record.output)) {
                    const keys = Object.keys(record.output);
                    keys.forEach(key => {                      
                        input.variables.forEach(variable => {
                            if (variable.producerOutput == key) {
                                found = true;
                            }
                        });
                    });
                }
                return found;
            });
        }

        //
        // Work back, ignoring incomplete items, until we find the most recent that's already been consumed
        //

        let allUnconsumed = [];
        for (let i=recordsForProducerNode.length-1; i>=0; i--) {
            const record = recordsForProducerNode[i];
            if (latestConsumedRecordID && (record.recordID == latestConsumedRecordID)) {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `    ${producerInstanceID} latest consumed index = ${i} record=${record.recordID}`)
                break;
            } else if (record.state == "completed") {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `    ${producerInstanceID} unconsumed index = ${i} record=${record.recordID}`)
                allUnconsumed.push(record);
            } else {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `    ${producerInstanceID} ignoring index = ${i} record=${record.recordID} state=${record.state}`)
            }
        }

        return allUnconsumed;
    }

    applyUnconsumedVariableInputsToRunInfo({runInfo, unconsumedInputs, node}) {
        const { Constants } = Config;
        const nodeMetadata = getMetadataForNodeType(node.nodeType)
        for (let k = 0; k < node.inputs.length; k++) {
            let inputType = node.inputs[k];
            
            if (!inputType.variables || inputType.variables.length === 0) {
                // No variables, so we're done
                continue;
            }

            // If we already have an instance of this node type in the inputs that was ALSO a trigger,
            // skip to the next input
            let recordFound = null
            let inputRecord = runInfo.inputs.find(input => input.producerInstanceID === inputType.producerInstanceID);
            let foundExistingInputRecord = false;
            if (inputRecord) {

                //
                // We've arleady included an input record of this type which provided a trigger; find the record so we can grab data from it
                //

                foundExistingInputRecord = true;

                recordFound = this.recordHistory.getRecord(inputRecord.recordID);

                if (!recordFound) {
                    throw new Error(`Could not find record ${inputRecord.recordID} for node ${node.instanceName} in unconsumed inputs`);
                }

            } else {

                //
                // We didn't have a trigger for this input type, so this is a variable-only input.  
                // We need to try and find an unconsumed record of this type
                //
                let unconsumedInputsForType = unconsumedInputs[inputType.producerInstanceID];
                if (unconsumedInputsForType.length == 0) {
                    Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ For node ${node.instanceName} did not an instance of ${inputType.producerInstanceID} producing variables ${inputType.variables.join(',')} @@@@@@@@@@`)
                    if (node.requireAllVariables) {
                        Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `    ...can't run this node`);
                        return false;
                    } else {
                        Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `    ...missing a variable, but requireAllVariables is not set; on to the next variable`);
                        continue;
                    }
                }

                recordFound = unconsumedInputsForType[0];
            }

            if (!recordFound) {
                throw new Error(`Got to a point in applyUnconsumedVariableInputsToRunInfo where we should have a record, but we don't!`);
            }
            
            if (!inputRecord) {
                inputRecord = {
                    producerInstanceID: inputType.producerInstanceID,
                    recordID: recordFound.recordID,
                };
            }

            // Add all variable values to the input record
            for (let j = 0; j < inputType.variables.length; j++) {
                const producerOutput = inputType.variables[j].producerOutput;
                const consumerVariable = inputType.variables[j].consumerVariable;
                const isCompositeVariable = nodeMetadata.AllowedVariableOverrides?.[consumerVariable]?.mediaType === "composite";
                let variableValue = recordFound.output[producerOutput];
                if (!inputRecord.values) {
                    inputRecord.values = {};
                }
                if (typeof inputRecord.values[consumerVariable] === "undefined") {
                    inputRecord.values[consumerVariable] = {};
                }
                if (isCompositeVariable) {
                    inputRecord.values[consumerVariable][producerOutput] = variableValue;
                } else {
                    inputRecord.values[consumerVariable] = variableValue;
                }
            }

            if (!foundExistingInputRecord) {
                runInfo.inputs.push(inputRecord);
            }
        }

        return true;
    }

    generateRunInfoForNode({node, unconsumedInputs}) {
        const { Constants } = Config;

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - Checking inputs for unconsumed records`);
        
        let ranOutOfInputs = false;
        let count=0;
        do {
            let runInfo = {
                nodeInstance: this.nodeInstances[node.instanceID],
                readyTime: new Date(0),
                inputs: [],
            };

            if (!runInfo.nodeInstance) {
                throw new Error(`Node instance not found for node ${node.instanceID}`);
            }

            //
            // Go through all inputs, see if we have one unconsumed input of each type
            //

            const nodeInputArry = node.inputs;

            let foundAllRequiredTriggers = true;
            let foundAnyTriggers = false;
            // If we require all event triggers, we need to find the next unconsumed input for each type
            for (let k = 0; k < nodeInputArry.length; k++) {
                let inputType = nodeInputArry[k];
                
                //
                // First check for triggers. Two possible cases:
                //   1) requireAllEventTriggers -- all must be present
                //   2) !requireAllEventTriggers -- any one of the triggers is sufficient and we only consume one
                //
                
               if (inputType.triggers) {
                    // find an unconsumed input of this node type that has all the required triggers
                    let unconsumedInputsForType = unconsumedInputs[inputType.producerInstanceID];
                    let inputRecordFound = null;
                    let eventsApplied = [];

                    //
                    // Case 1: requireAllEventTriggers -- all must be present
                    //
                    
                    if (node.requireAllEventTriggers || node.requireAllInputs) {
                        Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ For node ${node.instanceName} requireAllEventTriggers @@@@@@@@@@`)

                        //
                        // Usually we'll only need one trigger from a parent node but IN THEORY we could need more than one.
                        // So we'll loop through all the triggers and see if any of the unconsumed inputs have all the triggers
                        //
                        for (let i=0; i<unconsumedInputsForType.length; i++) {
                            let inputRecord = unconsumedInputsForType[i];
                            eventsApplied = [];

                            //
                            // Loop through all the triggers we require for this input type
                            // 
                            let allTriggersFound = true;
                            for (let k=0; k<inputType.triggers.length; k++) {
                                const trigger = inputType.triggers[k];
                                const producerEventName = trigger.producerEvent;

                                if (!inputRecord.eventsEmitted.includes(producerEventName)) {
                                    Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ For record ${inputRecord.recordID} did not all the required triggers for ${producerEventName} @@@@@@@@@@`)
                                    allTriggersFound = false;
                                    break;
                                } else {
                                    eventsApplied.push(producerEventName);
                                }
                                 
                            }

                            if (allTriggersFound) {
                                Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ For record ${inputRecord.recordID} found all required triggers @@@@@@@@@@`)
                                inputRecordFound = inputRecord;
                                break;
                            }
                        }

                        if (!inputRecordFound) {
                            Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ Could not find all triggers for node ${node.instanceName} @@@@@@@@@@`)
                            foundAllRequiredTriggers = false;
                            break;
                        }
                    } else {

                        //
                        // Case 2: !requireAllEventTriggers -- any one of the triggers is sufficient
                        //

                        eventsApplied = [];
                        for (let i=0; i<unconsumedInputsForType.length; i++) {
                            let inputRecord = unconsumedInputsForType[i];

                            for (let k=0; k<inputType.triggers.length; k++) {
                                const trigger = inputType.triggers[k];
                                const producerEventName = trigger.producerEvent;
                                if (inputRecord.eventsEmitted.includes(producerEventName)) {
                                    Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ For node ${node.instanceName} FOUND needed 1 trigger and found ${producerEventName} @@@@@@@@@@`)
                                    inputRecordFound = inputRecord;
                                    eventsApplied.push(producerEventName);
                                    break;
                                }
                            }

                            if (inputRecordFound) {
                                break;
                            }
                        }
                    }
                   

                    if (!inputRecordFound) {

                        //
                        // Couldn't find a record with all the triggers we need for this input type
                        //

                        if (node.requireAllEventTriggers || node.requireAllInputs) {

                            //
                            // If we needed all the triggers, we can't run this node yet. Otherwise, keep looping through other
                            // triggers trying to find one
                            // 

                            foundAllRequiredTriggers = false;
                            ranOutOfInputs = true;
                            break;
                        }

                        Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ Could not find all triggers for node ${node.instanceName} so can't run it yet @@@@@@@@@@`)

                    } else {
                        
                        //
                        // Found an input record... continue looking for triggers from 
                        //

                        runInfo.inputs.push({
                            producerInstanceID: inputType.producerInstanceID,
                            recordID: inputRecordFound.recordID,
                            includeHistory: true, // should this be nodeMetadata.nodeAttributes.contextAware ??
                            events: eventsApplied,
                        });
                        foundAnyTriggers = true;
                    }
               }

               //
               // End of triggers for() loop
               //
            }

            if (!foundAllRequiredTriggers || !foundAnyTriggers) {
                ranOutOfInputs = true;
                break;
            }

            //
            // We have trigger(s)... now find the rest of the inputs
            //

            const haveMoreInputs = this.applyUnconsumedVariableInputsToRunInfo({runInfo, unconsumedInputs, node})
            if (!haveMoreInputs) {
                ranOutOfInputs = true;
                break;
            }

            if (!ranOutOfInputs) {

                this.applyMessageHistoryToRunInfo(runInfo);
                
                //
                // Push the new run onto the readyToProcess list
                //
                this.plan.readyToProcess.push(runInfo);
                
                // remove all the consumed inputs from the arrays
                for (let k = 0; k < runInfo.inputs.length; k++) {
                    const input = runInfo.inputs[k];
                    const before = unconsumedInputs[input.producerInstanceID].length;
                    unconsumedInputs[input.producerInstanceID] = unconsumedInputs[input.producerInstanceID].filter(record => record.recordID !== input.recordID);
                    Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `                unconsumedInputs[${input.producerInstanceID} ${before} -> ${unconsumedInputs[input.producerInstanceID].length}`);
                }

                Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ FOUND ALL ${runInfo.inputs.length} inputs for node ${node.instanceName} @@@@@@@@@@`)
            } else {
                Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@@@@@@@@@ Could not find all inputs for ${node.instanceName} @@@@@@@@@@`)
            }

            count++;
            if (count > 1000) {
                return;
            }

        } while (!ranOutOfInputs);
    }

    generateUnconsumedInputsForNode(node, recordsByNodeInstanceID) {
        const { Constants } = Config;

        const recordsForNode = recordsByNodeInstanceID[node.instanceID];

        const inputsArray = node.inputs;

        let unconsumedInputs = {};
        
        for (let k = 0; k < inputsArray.length; k++) {
            let input = inputsArray[k];
            const mostRecentConsumerRecord = recordsForNode ? this.getMostRecentRecordConsumingNodeType(recordsForNode, input.producerInstanceID) : null;
    
            if (mostRecentConsumerRecord) {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - most recent time: ${mostRecentConsumerRecord.completionTime}`);
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - most recent inputs: ${mostRecentConsumerRecord?.inputs.map((input, dex) => `input[${dex}].producerInstanceID=${input.producerInstanceID} .recordID=${input.recordID}`).join(`,`)} `);
            } else {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - no consumer record found -- all inputs are unconsumed.`);
            }

            let lastConsumedInputThisType = mostRecentConsumerRecord?.inputs?.find(consumerIn => consumerIn.producerInstanceID === input.producerInstanceID);
            const mostRecentConsumedID = lastConsumedInputThisType?.recordID;
            const unconsumedInputsForType = this.getUnconsumedInputsForType(recordsByNodeInstanceID, mostRecentConsumedID, input);
            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `   unconsumedInputsForType for node ${node.instanceName} of type ${input.producerInstanceID}: `, unconsumedInputsForType.length);
            unconsumedInputs[input.producerInstanceID] = unconsumedInputsForType;
        }

        return unconsumedInputs;
    }

    async processNode(node, recordsByNodeInstanceID) {
        const { Constants } = Config;
        if (node.nodeType === "start" || node.isSourceNode || !node.inputs || node.inputs.length === 0) {
            Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `Node ${node.instanceID} is either a start or source node, or it has no inputs... skipping!`);
            return null;
        }

        const unconsumedInputs = this.generateUnconsumedInputsForNode(node, recordsByNodeInstanceID);

        this.generateRunInfoForNode({ node, unconsumedInputs });
    }
    

    async findReadyToProcess(records, recordsByNodeInstanceID) {
        const { Constants } = Config;

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + "@@@@@@@@ RECALC INPUTS ");
        
        if (records.length === 0) {

            //
            // Special case -- the very first record will be the "Start Node"
            //

            const startNode = this.versionInfo.stateMachineDescription.nodes[0];
            if (startNode.nodeType !== "start") {
                throw new Error("STATE MACHINE: First record is not a start node!");
            }

            Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@ PROCESSING START NODE`);

            const runInfo = {
                nodeInstance: this.nodeInstances[startNode.instanceID],
                readyTime: new Date(0),
                inputs: [],
            };

            // No history to apply to the start node
            
            this.plan.readyToProcess.push(runInfo);

        } else {

            //
            // Algorithm:
            //   1. Loop by each node description
            //      - Skip source nodes and nodes with no inputs
            //   2. Find the most recent record produced by this node -- we'll want to
            //      ignore all input records older than this one since we consume
            //      inputs in chronological order
            //   3. Find the oldest unconsumed record in the "completed" state for each input,
            //      processed meaning it has been completed, but its subtree has not yet been
            //      processed
            //   4. Loop forward through all the unconsumed inputs as long as there is
            //      a complete set of inputs to satisfy the input requirements
            //      
            //


            //
            // First, replay ALL pending records, ensuring they are still valid
            //
            for (let i=0; i<records.length; i++) {
                const record = records[i];

                // If this record is pending and we haven't already attempted it, add it to the plan
                if ((record.state == "failed" || record.state == "waitingForExternalInput") && !this.plan.waitForUpdateBeforeReattempting[record.recordID]) {
                    
                    // Ensure the the nodeInstance still exists, and the record's inputs are correct for this nodeInstance, 
                    // including whether the nodeInstance requires all inputs to be present
                    const nodeInstance = this.nodeInstances[record.nodeInstanceID];


                    if (nodeInstance) {

                        let inputsAreValid = true;
                        const allInputs = nodeInstance.fullNodeDescription.inputs;
                        const recordInputs = record.inputs;
                        // node.requireAllInputs deprecated as of May 2024
                        if (nodeInstance.requireAllEventTriggers || nodeInstance.requireAllInputs) {
                            // Check if all inputs are present, and no inputs that shouldn't be present
                            if (allInputs.length == recordInputs.length) {
                                for (let j=0; j<allInputs.length; j++) {
                                    if (allInputs[j].producerInstanceID !== recordInputs[j].producerInstanceID) {
                                        inputsAreValid = false;
                                        break;
                                    }
                                }
                            } else {
                                inputsAreValid = false;
                            }
                        } else {
                            // Check that any input is present
                            let found = false;
                            for (let j=0; j<allInputs.length; j++) {
                                if (allInputs[j].producerInstanceID === recordInputs[0].producerInstanceID) {
                                    found = true;
                                    break;
                                }
                            }
                            inputsAreValid = found;
                        }


                        if (inputsAreValid) {

                            const inputs = record.inputs;
                            const runInfo = {
                                nodeInstance: nodeInstance,
                                readyTime: new Date(0),
                                inputs: inputs,
                                existingRecord: record,
                            };

                            Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@ PUSHING PENDING RECORD FOR NODE ${nodeInstance.fullNodeDescription.instanceName} TO READY QUEUE`);
                            
                            // Reapply the history to the record
                            this.applyMessageHistoryToRunInfo(runInfo);

                            this.plan.readyToProcess.push(runInfo);

                        } else {
                            // Mark record deleted. If the node shows back up, it'll get replayed nayway
                            Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@ DELETING RECORD FOR NODE ${nodeInstance.fullNodeDescription.instanceName} WITH INCOMPATIBLE INPUTS`);
                            this.recordHistory.deleteRecord(record.recordID);
                        }

                    } else {
                        // Didn't find this node instance! Most likely this record was from a node that is now deleted. m
                        // Mark record deleted. If the node shows back up, it'll get replayed nayway
                        Constants.debug.logStateMachine &&  console.error(this.debugID + ' ' + `@@@ DELETING RECORD FOR NODE ${record.nodeInstanceID} THAT NO LONGER EXISTS`);
                        this.recordHistory.deleteRecord(record.recordID);
                    }
                }
            }

            //
            // We will now find the most recent record for each node type.
            // Then, for each input, any record newer than the most recent
            // consumed record must be unconsumed.
            //

            

            for (let n=0; n<this.versionInfo.stateMachineDescription.nodes.length; n++) {
                
                const node = this.versionInfo.stateMachineDescription.nodes[n];

                await this.processNode(node, recordsByNodeInstanceID); // will push to readyToProcess
            }
        }



        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + "@@@@@@@@@@@@ END RECALC INPUTS")
    }


    getRecordHistoryForRecord(recordID) {
        if (!recordID) {
            throw new Error('getContextHistoryForRecord: record must be defined');
        }

        let historyParams = {
            includeDeleted: false,
            includeFailed: true, // include failed until they are deleted so we don't spin wheels
            ignoreCompression: false,
            fromAncestorID: recordID,
        };

        const history = this.recordHistory.getFilteredRecords(historyParams);

        return history;
    }

    async processFlowControlSubtree(recordGraph, flowControlGraphNode, recordsByNodeInstanceID) {
        const { Constants } = Config;

        // Any new record should consume all previous leaf nodes, so if any of those sub-branches
        // are deleted, this instance of the "loop" or whatever control flow mechanism is
        // deleted, too
        let leafNodes = [];
        if (flowControlGraphNode.descendants) {
            for (let i=0; i<flowControlGraphNode.descendants.length; i++) {
                const descendantLeafNodes = await this.processFlowControlSubtree(recordGraph, flowControlGraphNode.descendants[i], recordsByNodeInstanceID);
                if (descendantLeafNodes) {
                    leafNodes = [...leafNodes, ...descendantLeafNodes];
                }
            }
        } else {
            leafNodes.push(flowControlGraphNode.record);
        }

        if (!flowControlGraphNode.record) {
            // Nothing to do, just return the leaf nodes
            return leafNodes;
        }

        if (leafNodes.length === 0) {
            // This is the leaf node
            leafNodes.push(flowControlGraphNode.record);
        }

        const nodeAttributes = getMetadataForNodeType(flowControlGraphNode.record.nodeType).nodeAttributes;
        if (!nodeAttributes.flowControl) {
            // Nothing to do on this one
            return leafNodes;
        }

        const isSubtreeStillConsumed = recordGraph.getAttribute(flowControlGraphNode.record.recordID, "subTreeConsumed");


        // Still all consumed?
        if (isSubtreeStillConsumed) {

            const record = flowControlGraphNode.record;

            Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%% PROCESSING FLOW CONTROL NODE ${flowControlGraphNode.record.nodeType} completed with events`, record.eventsEmitted);
            Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%% LEAF NODES: `);
            leafNodes.forEach(leafNode => {
                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `         %% ${leafNode.recordID} ${leafNode.nodeType} completed with events`, leafNode.eventsEmitted);
            });

            const nodeInstance = this.nodeInstances[record.nodeInstanceID];

            Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `     %%%%%%% PROCESSING FLOW CONTROL NODE ${flowControlGraphNode.record.recordID} -> Still Consumed: ${isSubtreeStillConsumed} %%%%%%%`);

            let newRecord = this.recordHistory.cloneRecord_static(record);

            let inputs = JSON.parse(JSON.stringify(record.inputs));

            if (!nullUndefinedOrEmpty(leafNodes)) {
                for (let i=0; i<leafNodes.length; i++) {
                    // Each leaf node will be a trigger if it isn't already
                    let thisInput = inputs.find(input => input.producerInstanceID === leafNodes[i].nodeInstanceID);
                    if (!thisInput) {
                        inputs.push({
                            producerInstanceID: leafNodes[i].nodeInstanceID,
                            recordID: leafNodes[i].recordID,
                            includeHistory: true,
                            events: ["completed"]
                        });
                    } else {
                        // replace the existing input with this record ID
                        thisInput.recordID = leafNodes[i].recordID;
                    }
                }
            }

            newRecord.inputs = inputs;

            //
            // UPDATE VARIABLE INPUTS TO BE THE LATEST UNCONSUMED VALUES
            //


            const runInfo = {
                nodeInstance: nodeInstance,
                readyTime: new Date(0),
                inputs: inputs,
                existingRecord: newRecord,
            };
            
            const unconsumedInputs = this.generateUnconsumedInputsForNode(nodeInstance.fullNodeDescription, recordsByNodeInstanceID);

            this.applyUnconsumedVariableInputsToRunInfo({runInfo, unconsumedInputs, node: nodeInstance.fullNodeDescription })

            // splice full record history rather than input-by-input which is required by context-aware nodes
            const fullHistoryForContextProcessing = this.getRecordHistoryForRecord(newRecord.recordID);
            
            await nodeInstance.processExecutionContext({ history: fullHistoryForContextProcessing, record: newRecord });

            const needToProcessFlowControlRecord = await nodeInstance.processFlowControlForThisNode({ record: newRecord });

            if (needToProcessFlowControlRecord) {

                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%% PROCESSING FLOW CONTROL NODE ${nodeInstance.fullNodeDescription.instanceName} %%%%%%%`);
                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%%     PREVIOUS RECORD: `, record);

                this.recordHistory.addRecordWithoutWritingToDB(newRecord);

                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `  %%%% PUSHING PENDING RECORD ${newRecord.recordID} FOR NODE ${nodeInstance.fullNodeDescription.instanceName} TO READY QUEUE`);

                this.plan.readyToProcess.push(runInfo);

                recordGraph.markAncestorsUnconsumed(flowControlGraphNode.record.recordID);
            }
        } else {
            Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `     %%%%%%% SKIPPING FLOW CONTROL NODE ${flowControlGraphNode.record.recordID} -> Still Consumed: ${isSubtreeStillConsumed} %%%%%%%`);
        }

        return leafNodes;
    }

    async performPostProcessAndFlowControl(records, recordsByNodeInstanceID) {
        const { Constants } = Config;

        if (records.length === 0) {
            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + ` 0 records, skiplping performPostProcessAndFlowControl`);
            return;
        }

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%% performPostProcessAndFlowControl %%%`);
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);


        const recordGraph = new RecordGraph(records, this.versionInfo.stateMachineDescription.nodes);

        const flowControlTree =  recordGraph.findFlowControlNodesWithFullTreesAndUnconsumedInputs();

        //recordGraph.print();
    
        /*
                {
                     record: recordEntry.record, // if the record is non-null, it's a flow control node
                     descendants: flowControlNodesInSubtree,
                }
        */

        //
        // Start from leaf nodes and walk up the tree.  If all children are still marked as complete,
        // run the processFlowControl function of the node with up-to-date context (which will collapse
        // the stack down to the latest node). If processFlowControl returns any new records, add them to the
        // records list to run. Then, mark the subtree all the way back to the root as subtree-not-complete.
        // 
        // This covers a case like:
        //   while(true) {  // this is further up the tree, and if the for() is still running, it shouldn't run again
        //     for(...) {
        //       // do stuff
        //     }
        //   }
        //
        // Its then fine to check other nodes within deep branches to see if they can still run.
        //

    
        await this.processFlowControlSubtree(recordGraph, flowControlTree, recordsByNodeInstanceID);

        
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%%%%%%%%%%%%%%%% END %%%%%%%%%%%%%%%%%%`);
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
    }


    getHistoryForInput(nodeInput, runInput) {
        const { Constants } = Config;

        Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%% GETTING HISTORY FOR nodeInput=`, nodeInput, ` runInput=`, runInput);
        let historyParams = {
            includeDeleted: false,
            includeFailed: true, // include failed until they are deleted so we don't spin wheels
            ignoreCompression: false,
            fromAncestorID: runInput.recordID,
        };
        
        if (nodeInput.historyParams) {
            historyParams = {...historyParams, ...nodeInput.historyParams};
        }

        const history = this.recordHistory.getFilteredRecords(historyParams);

        return history;
    }

    applyMessageHistoryToRunInfo(runInfo) {
        
        //const nodeMetadata = getMetadataForNodeType(runInfo.nodeInstance.fullNodeDescription.nodeType);

        // Only do this if we haven't already collected inputs
        if (nullUndefinedOrEmpty(runInfo.existingRecord?.inputs)) {
            const nodeInstance = runInfo.nodeInstance;
            const inputs = nodeInstance.fullNodeDescription.inputs;
            
            if (!inputs || inputs.length === 0) {
                return;
            }
            
            for (let j=0; j < runInfo.inputs.length; j++) {
                const nodeInput = inputs.find(input => input.producerInstanceID === runInfo.inputs[j].producerInstanceID);
                if (nodeInput.includeHistory) {
                    runInfo.inputs[j].history = this.getHistoryForInput(nodeInput, runInfo.inputs[j]);
                }
                
            }
        }
    }

    async createPlan() {
        const { Constants } = Config;

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: UPDATING PLAN');

        if (nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription) || nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription.nodes) |
            this.versionInfo.stateMachineDescription.nodes.length === 0) {
            // Nothing to do -- brand new version, not edited yet
            return;
        }
        
        //
        // Assumes record history is up to date
        //
        if (!this.recordHistory) {
            throw new Error('Tried to plan before record history was initialized!');
        }
        
        //
        // This MUST happen prior to this.recordHistory.load() to prevent a real race condition
        //
        let records = [...this.recordsInProgress];

        await this.recordHistory.load();
        
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `##### StateMachine: LOADED RECORD HISTORY (${records.length} in progress)`);

        if (records.length > 0) {
            Constants.debug.logStateMachine && console.error("Records in progress: \n", records.map((r, index) => `[${index}]: ` + JSON.stringify(r, null, 2)).join('\n'));
        }

        const recordsFromDB = this.recordHistory.getFilteredRecords({includeDeleted: false, includeFailed: true, ignoreCompression: false, includeWaitingForExternalInput: true});

        records = [...recordsFromDB, ...records ];

        // 
        // Due to a REAL race condition where a record is inserted WHILE we wait for the query to come back, we
        // could wind up with a record in the list twice.  So, we'll dedupe the list
        //
        records = records.filter((record, index, self) =>
            index === self.findIndex((t) => (
                t.recordID === record.recordID
            ))
        );

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + "Record count: ", records.length);

        //
        // Records are sorted chronologically by execution time, so we can walk the records
        // from oldest to newest
        //

        //
        // Partition the records by nodeInstanceID, which will avoid an O(n) 
        // search of all records to find records produced by a specific
        // nodeInstanceID
        //

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: PARTITIONING RECORDS BY NODE INSTANCE ID');

        let recordsByNodeInstanceID = {};
        if (records.length > 0) {

            // ordering will remain oldest-first
            for (let i=0; i<records.length; i++) {
                const record = records[i];
                if (record.deleted) {
                    continue;
                }

                if (!recordsByNodeInstanceID[record.nodeInstanceID]) {
                    recordsByNodeInstanceID[record.nodeInstanceID] = [];
                }
                    
                recordsByNodeInstanceID[record.nodeInstanceID].push(record);
            }
        }

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: FIND READY TO PROCESS NODES');


        //
        // Fill "readyToProcess" with nodes that have all inputs ready
        //
        await this.findReadyToProcess(records, recordsByNodeInstanceID);

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: APPLYING MESSAGE HISTORY INPUTS');

        //
        // Post-process nodes after doing "ready to process", so as input we
        // know which nodes still have work to do
        //
        await this.performPostProcessAndFlowControl(records, recordsByNodeInstanceID);
    }

    clearPlan() {
        this.plan = { 
            readyToProcess: [],
            processing: [],
            waitForUpdateBeforeReattempting: {}
        };
        this.recordsInProgress = [];
    }

    
    async preRunProcessing({ runInfo, channel, debuggingTurnedOn, onPreNode }) {
        const { Constants } = Config;

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `##### StateMachine: ${runInfo.nodeInstance.fullNodeDescription.nodeType} PRE-RUN PROCESSING`);

        const nodeInstance = runInfo.nodeInstance;
        const inputs = runInfo.inputs;
        let record = runInfo.existingRecord ?
            runInfo.existingRecord 
        :
            {
                recordID: uuidv4(),
                sessionID: this.session.sessionID,
                versionID: this.session.versionID,
                gameID: this.session.gameID,
                nodeType: nodeInstance.fullNodeDescription.nodeType,
                nodeInstanceID: nodeInstance.fullNodeDescription.instanceID,
                properties: nodeInstance.fullNodeDescription.properties,
                inputs: inputs,
                output: null,
                context: {},
                startTime: new Date(),
                state: "started",
                error: null
            };

        
        //
        // Allow the node to do stuff like pre-report messages to the client
        //
        let additionalParams = {};
        await nodeInstance.gatherInputs({channel, inputs, stateMachine:this, record, additionalParams, debuggingTurnedOn});

        const nodeAttributes = getMetadataForNodeType(record.nodeType).nodeAttributes;
        if (nodeAttributes.contextAware) {

            // splice full record history rather than input-by-input which is required by context-aware nodes
            const fullHistoryForContextProcessing = this.getRecordHistoryForRecord(record.recordID);

            await nodeInstance.processExecutionContext({history: fullHistoryForContextProcessing, record});
        }

        //
        // Inform the calling function
        //
        await onPreNode({ record, runInfo }); // async for now... let's see if that gets us in trouble

        const persona = getNodePersonaDetails(this.versionInfo, nodeInstance.fullNodeDescription);

        record.params = {
            ...nodeInstance.fullNodeDescription.params,
            ...additionalParams,
            persona: persona,
            personaSource: nodeInstance.fullNodeDescription.personaLocation?.source ? nodeInstance.fullNodeDescription.personaLocation.source : "builtin",
        };

        this.recordsInProgress.push(record);

        await nodeInstance.preProcess({channel, inputs, stateMachine:this, record, additionalParams, debuggingTurnedOn});

        return record;
    }


    async postProcessProcessing({ runInfo, record, results, channel, seed, debuggingTurnedOn, onPostNode }) {
        const { Constants } = Config;

        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `##### StateMachine: ${runInfo.nodeInstance.fullNodeDescription.nodeType} POST-RUN PROCESSING`);

        const nodeInstance = runInfo.nodeInstance;

        if (!Constants.validRecordStates.includes(results.state)) {
            throw new Error(`Node ${nodeInstance.fullNodeDescription.instanceName} returned an invalid state: ${results.state}`);
        }

        let finalResults = {...results}
        finalResults.error = EnsureCorrectErrorType(finalResults.error);

        let finalRecord = {
            ...record, 
            ...finalResults,
            state: finalResults.state
        };
       
        if (finalRecord.state != "completed") {
            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `Node of ${nodeInstance.fullNodeDescription.instanceName} didn't complete -- adding to waitForUpdateBeforeReattempting`);
            this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID] = finalRecord;
        } else if (this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID]) {
            delete this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID];
        }
        
        //
        // Allow the node to do stuff like report messages to the client
        //
        await nodeInstance.postProcess({channel, results: finalResults, stateMachine: this, record: finalRecord, debuggingTurnedOn});

        //
        // RECORD THE RESULTS
        //
        await this.recordHistory.insertOrUpdateRecord(finalRecord);

        //
        // Remove the record from the in-progress list
        //
        this.recordsInProgress = this.recordsInProgress.filter(r => r.recordID !== finalRecord.recordID);

        //
        // Report back to the calling function
        //
        await onPostNode({ runInfo, record: finalRecord, results: finalResults });
        
        Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `##### StateMachine: ${runInfo.nodeInstance.fullNodeDescription.nodeType} POST-RUN COMPLETE`);
    }

    async drainQueue({ stepLimit, channel, seed, debuggingTurnedOn, account, wasCancelled, onPreNode, onPostNode, onStateMachineError, debugID }) {
        const { Constants } = Config;

        this.debugID = debugID;

        let pendingPromises = [];

        const keySource = this.versionInfo.alwaysUseBuiltInKeys ? {source: 'builtin'} : { source: 'account', account: account };

        try {

            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: ENTERING DRAIN QUEUE LOOP');

            this.clearPlan();

            let iterations = 0;
            while ((stepLimit == 0 || iterations < stepLimit) && (!wasCancelled || !wasCancelled())) {
                
                await this.createPlan();

                if (this.plan.processing == 0 && this.plan.readyToProcess.length === 0) {
                    Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: NOTHING TO DO RIGHT NOW - QUEUE DRAINED');
                    break;
                }

                if (this.plan.readyToProcess.length > 0) {
                    Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: PLAN HAS ', this.plan.readyToProcess.length, ' NODES READY TO PROCESS');
                    
                    if (stepLimit > 0) {
                        const remainingSteps = stepLimit - iterations;
                        if (this.plan.readyToProcess.length > remainingSteps) {
                            // We have more nodes ready to process than we have steps left, remove items from the plan
                            this.plan.readyToProcess = this.plan.readyToProcess.slice(0, remainingSteps);
                            Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: REDUCED READY TO PROCESS TO ', this.plan.readyToProcess.length, ' NODES DUE TO STEP LIMIT');
                        }
                    }

                    iterations += this.plan.readyToProcess.length;

                    this.plan.readyToProcess.map(runInfo => {
                        const promise = new Promise((resolve, reject) => {
                        
                            this.plan.processing.push(runInfo); // Move to processing list

                            this.logNode(runInfo.nodeInstance.fullNodeDescription.instanceName);

                            this.preRunProcessing({ runInfo, channel, seed, debuggingTurnedOn, wasCancelled, onPreNode })
                                .then(record => {                               

                                        runInfo.nodeInstance.run({
                                            inputs: runInfo.inputs, 
                                            stateMachine: this, 
                                            channel, 
                                            seed,
                                            debuggingTurnedOn,
                                            wasCancelled,
                                            record,
                                            keySource,
                                        })
                                        .then(results => {
                                            
                                            this.postProcessProcessing({ runInfo, results, record, channel, seed, debuggingTurnedOn, wasCancelled, onPostNode })
                                            .then(() => 
                                            {
                                                //
                                                // SUCCESSFUL RESOLUTION HERE
                                                //
                                                this.plan.processing = this.plan.processing.filter(item => item !== runInfo); // Remove from processing
                                                pendingPromises = pendingPromises.filter(p => p !== promise);

                                                resolve(results)
                                            
                                            })
                                            //this.postProcessProcessing
                                            .catch(error => {
                                                onStateMachineError(error);
                                                reject(error);
                                            });
                                        })
                                        //this.preRunProcessing
                                        .catch(error => {

                                            this.plan.processing = this.plan.processing.filter(item => item !== runInfo); // Remove from processing
                                            pendingPromises = pendingPromises.filter(p => p !== promise);    

                                            onStateMachineError(error);
                                            const result = { record: null, error: error };
                                            reject(error);
                                        })
                                })
                                //this.preRunProcessing
                                .catch(error => {
                                    this.plan.processing = this.plan.processing.filter(item => item !== runInfo); // Remove from processing
                                    pendingPromises = pendingPromises.filter(p => p !== promise);
                                    onStateMachineError(error);
                                    const result = { record: null, error: error };
                                    reject(error);
                                });
                        });

                        pendingPromises.push(promise);
                    });

                    this.plan.readyToProcess = []; // Clear the readyToProcess list
                }

                //
                // Use Promise.race() to wait for the first task to complete including its handling
                // Alt:  
                //     await Promise.all(taskPromises); 
                // would wait for all tasks to complete
                //
                if (pendingPromises.length > 0) {
                    await Promise.race(pendingPromises);

                    // All tasks completed, you can now proceed with replanning
                    Constants.debug.logStateMachine && console.error(this.debugID + ' ' + '##### StateMachine: AT LEAST ONE TASK HAS COMPLETED.');
                }
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `##### StateMachine: finished ${iterations} iterations, stepLimit ${stepLimit}   wasCancelled? ${wasCancelled() ? 'true' : 'false'}`);
            }
        } catch (e) {

            onStateMachineError(e);
        }

        // Fully drain the queue before returning flow control to the caller
        await Promise.all(pendingPromises);
    }

    messageFromRecord(record, params = {}) {
        return this.recordHistory.messageFromRecord(this.versionInfo, record, params);
    }

    exportAsMessageList(params = {}) {
        const filteredRecords = this.recordHistory.getFilteredRecords(params);
        return exportRecordsAsMessageList(this.versionInfo, filteredRecords, { ...params, preFiltered: true });
    }

    convertToMessageList(records, params = {}) {
        return exportRecordsAsMessageList(this.versionInfo, records, params);
    }
}
