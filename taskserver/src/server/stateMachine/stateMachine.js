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
 *      consulting the scoreboard-style `consumerInputCursor` map as the "last read"
 *      pointer and falling back to historical scans only when the cursor is empty.
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
import { videoGenerationNode } from './nodeTypes/videoGenerationNode.js';
import { openAiAgentKitNode } from './nodeTypes/openAiAgentKitNode.js';
import { microsoftAgentFrameworkNode } from './nodeTypes/microsoftAgentFrameworkNode.js';
import { uiAutomationNode } from './nodeTypes/uiAutomationNode.js';
import { perplexitySearchNode } from './nodeTypes/perplexitySearchNode.js';
import { adsCampaignInsightsNode } from './nodeTypes/adsCampaignInsightsNode.js';
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
import { modelTrainingNode } from './nodeTypes/modelTrainingNode.js';
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
    "videoGenerator": videoGenerationNode,
    "openAiAgent": openAiAgentKitNode,
    "microsoftAgentFramework": microsoftAgentFrameworkNode,
    "uiAutomation": uiAutomationNode,
    "perplexitySearch": perplexitySearchNode,
    "adsCampaignInsights": adsCampaignInsightsNode,
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
    "modelTraining": modelTrainingNode,
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
        this.consumerInputCursor = {};
        this.historyCache = new Map();
        this.historyCacheOrder = [];
        this.cachedRecordGraph = null;
        this.lastRecordGraphSnapshotSize = 0;
        this.lastRecordHistoryLoadInfo = { fullReload: true, delta: { newRecords: [], updatedRecords: [], deletedRecordIDs: [] } };
        this.aiPriorityNodeTypeSet = null;
        this.plan = {
            readyToProcess: [],
            processing: [],
            waitForUpdateBeforeReattempting: {},
            blockedNodes: new Map(),
        };
        this.lastRecordStateLog = new Map();
    }

    logNode(instanceName, data = null) {
        if (!instanceName) {
            return;
        }
        this.logActivity(`**** PROCESSING: ${instanceName}`);
        if (data) {
            this.logActivity(JSON.stringify(data, null, 2));
        }
    }

    debugLog(flag, ...args) {
        const { Constants } = Config;
        if (!Constants?.debug?.[flag]) {
            return;
        }
        const prefix = this.debugID ? `${this.debugID} ` : '';
        if (args.length === 0) {
            console.error(prefix);
            return;
        }
        if (typeof args[0] === 'string') {
            console.error(prefix + args[0], ...args.slice(1));
        } else {
            console.error(prefix, ...args);
        }
    }

    logActivity(message, ...args) {
        this.debugLog('stateMachine', message, ...args);
    }

    logDependencies(message, ...args) {
        this.debugLog('stateMachineDependencies', message, ...args);
    }

    logQueueDetail(message, ...args) {
        this.debugLog('stateMachineQueue', message, ...args);
    }

    logPlanning(message, ...args) {
        this.debugLog('stateMachinePlanning', message, ...args);
    }

    logInputs(message, ...args) {
        this.debugLog('stateMachineInputs', message, ...args);
    }

    logTriggers(message, ...args) {
        this.debugLog('stateMachineTriggers', message, ...args);
    }

    logRecords(message, ...args) {
        this.debugLog('stateMachineRecords', message, ...args);
    }

    logGraph(message, ...args) {
        this.debugLog('stateMachineGraph', message, ...args);
    }

    logCursor(message, ...args) {
        this.debugLog('stateMachineCursors', message, ...args);
    }

    logHistoryCache(message, ...args) {
        this.debugLog('stateMachineHistoryCache', message, ...args);
    }

    formatNodeTypeForLog(nodeType) {
        if (!nodeType) {
            return 'UNKNOWN';
        }
        const lookup = {
            llm: 'LLM',
            llmData: 'LLM DATA',
            stt: 'STT',
            tts: 'TTS',
            ifThenElse: 'IF/THEN',
            externalTextInput: 'USER INPUT',
            externalMultiInput: 'USER INPUT',
            audioPlayback: 'AUDIO PLAYBACK',
            fileStore: 'FILE STORE',
            codeBlock: 'CODE BLOCK',
            whileLoop: 'WHILE LOOP',
            forLoop: 'FOR LOOP',
            arrayIterator: 'ARRAY ITERATOR',
            arrayIndex: 'ARRAY INDEX',
            randomNumber: 'RANDOM NUMBER',
            imageGenerator: 'IMAGE GENERATOR',
            videoGenerator: 'VIDEO GENERATOR',
            openAiAgent: 'OPENAI AGENT',
            perplexitySearch: 'PERPLEXITY SEARCH',
            adsCampaignInsights: 'ADS CAMPAIGN INSIGHTS',
            scenario: 'SCENARIO',
            start: 'START',
            delay: 'DELAY',
        };
        if (lookup[nodeType]) {
            return lookup[nodeType];
        }
        const spaced = nodeType
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .trim();
        return spaced.length > 0 ? spaced.toUpperCase() : nodeType.toUpperCase();
    }

    formatNodeLabel(nodeDescription) {
        if (!nodeDescription) {
            return 'UNKNOWN NODE';
        }
        const typeLabel = this.formatNodeTypeForLog(nodeDescription.nodeType);
        const instanceName = nodeDescription.instanceName;
        return instanceName ? `${typeLabel} (${instanceName})` : typeLabel;
    }

    formatNodeLabelByInstanceID(instanceID) {
        const instance = this.nodeInstances?.[instanceID];
        return this.formatNodeLabel(instance?.fullNodeDescription);
    }

    formatWaitingToken(token) {
        if (!token || typeof token !== 'string') {
            return 'input';
        }
        const mapping = {
            text: 'text input',
            audio: 'audio',
            image: 'image',
            video: 'video',
            file: 'file',
            confirmation: 'confirmation',
        };
        const lower = token.toLowerCase();
        if (mapping[lower]) {
            return mapping[lower];
        }
        return token.replace(/[_-]/g, ' ');
    }

    describePendingReason(record) {
        if (!record) {
            return 'waiting for external input';
        }
        if (Array.isArray(record.waitingFor) && record.waitingFor.length > 0) {
            const formatted = record.waitingFor.map(token => this.formatWaitingToken(token));
            return `waiting for ${formatted.join(', ')}`;
        }
        if (typeof record.waitingFor === 'string' && record.waitingFor.length > 0) {
            return `waiting for ${this.formatWaitingToken(record.waitingFor)}`;
        }
        if (record.state === 'failed') {
            const errorMessage = record.error?.message || record.error?.toString();
            return errorMessage ? `failed: ${errorMessage}` : 'failed, awaiting retry';
        }
        return 'waiting for external input';
    }

    getStateMachineConfig() {
        const { Constants } = Config;
        return Constants?.config?.stateMachine || {};
    }

    getPriorityNodeTypeSet() {
        if (this.aiPriorityNodeTypeSet) {
            return this.aiPriorityNodeTypeSet;
        }
        const config = this.getStateMachineConfig();
        const defaults = ["llm", "llmData", "imageGenerator", "videoGenerator", "tts", "stt", "audioPlayback"];
        const configured = Array.isArray(config.aiPriorityNodeTypes) ? config.aiPriorityNodeTypes : defaults;
        this.aiPriorityNodeTypeSet = new Set(configured);
        return this.aiPriorityNodeTypeSet;
    }

    noteBlockedNode(instanceID, reason, { hasPartialInputs = false } = {}) {
        if (!instanceID || !reason || !this.plan?.blockedNodes) {
            return;
        }
        const info = this.plan.blockedNodes.get(instanceID) || { reasons: [], hasPartialInputs: false };
        if (!info.reasons.includes(reason)) {
            info.reasons.push(reason);
        }
        info.hasPartialInputs = info.hasPartialInputs || hasPartialInputs;
        this.plan.blockedNodes.set(instanceID, info);
    }

    clearBlockedNode(instanceID) {
        if (!instanceID || !this.plan?.blockedNodes) {
            return;
        }
        this.plan.blockedNodes.delete(instanceID);
    }

    logRecordStateOnce(recordID, state, messageFactory) {
        if (!recordID || typeof state !== 'string') {
            return;
        }
        const lastState = this.lastRecordStateLog.get(recordID);
        if (lastState === state) {
            return;
        }
        const message = typeof messageFactory === 'function' ? messageFactory() : messageFactory;
        if (message) {
            this.logActivity(message);
        }
        this.lastRecordStateLog.set(recordID, state);
    }

    reportDependencySnapshot() {
        const pendingSummaries = [];
        const seenPendingNodes = new Set();
        const waitMap = this.plan?.waitForUpdateBeforeReattempting || {};
        Object.values(waitMap).forEach(record => {
            if (!record || seenPendingNodes.has(record.nodeInstanceID)) {
                return;
            }
            seenPendingNodes.add(record.nodeInstanceID);
            const nodeLabel = this.formatNodeLabelByInstanceID(record.nodeInstanceID) || this.formatNodeTypeForLog(record.nodeType);
            const reason = this.describePendingReason(record);
            pendingSummaries.push(`PENDING: ${nodeLabel} (${reason})`);
        });

        const blockedSummaries = [];
        if (this.plan?.blockedNodes instanceof Map) {
            for (const [instanceID, info] of this.plan.blockedNodes.entries()) {
                if (!info || !Array.isArray(info.reasons) || info.reasons.length === 0) {
                    continue;
                }
                if (!info.hasPartialInputs) {
                    continue;
                }
                const nodeLabel = this.formatNodeLabelByInstanceID(instanceID);
                const reasonText = info.reasons.join('; ');
                blockedSummaries.push(`INCOMPLETE: ${nodeLabel} (${reasonText})`);
            }
        }

        if (pendingSummaries.length === 0 && blockedSummaries.length === 0) {
            this.logDependencies('IDLE: no runnable nodes; state machine is waiting for new events.');
            return;
        }

        pendingSummaries.forEach(summary => this.logDependencies(summary));
        blockedSummaries.forEach(summary => this.logDependencies(summary));
    }

    reconcileWaitMap(records) {
        if (!this.plan?.waitForUpdateBeforeReattempting) {
            return;
        }
        if (!Array.isArray(records) || records.length === 0) {
            this.plan.waitForUpdateBeforeReattempting = { ...this.plan.waitForUpdateBeforeReattempting };
            return;
        }
        const latestByID = new Map();
        for (const record of records) {
            if (record?.recordID) {
                latestByID.set(record.recordID, record);
            }
        }
        const waitMap = this.plan.waitForUpdateBeforeReattempting;
        Object.keys(waitMap).forEach(recordID => {
            const latest = latestByID.get(recordID);
            if (!latest || (latest.state !== 'waitingForExternalInput' && latest.state !== 'failed')) {
                delete waitMap[recordID];
                this.lastRecordStateLog.delete(recordID);
            } else {
                waitMap[recordID] = latest;
            }
        });
    }

    collectBlockedReasonsForNode(node, unconsumedInputs) {
        if (!node || !this.plan?.blockedNodes) {
            return;
        }
        const inputs = Array.isArray(node.inputs) ? node.inputs : [];
        const hasPartialInputs = inputs.some(input => {
            const available = unconsumedInputs?.[input.producerInstanceID] || [];
            return available.length > 0;
        });
        if (!hasPartialInputs) {
            this.plan.blockedNodes.delete(node.instanceID);
            return;
        }
        inputs.forEach(input => {
            const available = unconsumedInputs?.[input.producerInstanceID] || [];
            if (available.length > 0) {
                return;
            }
            const producerLabel = this.formatNodeLabelByInstanceID(input.producerInstanceID);
            if (input.triggers && input.triggers.length > 0) {
                const triggerNames = input.triggers.map(trigger => trigger.producerEvent).join(', ');
                this.noteBlockedNode(node.instanceID, `waiting for event ${triggerNames} from ${producerLabel}`, { hasPartialInputs });
            } else if (input.variables && input.variables.length > 0) {
                const variableNames = input.variables.map(variable => variable.consumerVariable || variable.producerOutput).join(', ');
                this.noteBlockedNode(node.instanceID, `waiting for ${variableNames} from ${producerLabel}`, { hasPartialInputs });
            } else {
                this.noteBlockedNode(node.instanceID, `waiting for ${producerLabel}`, { hasPartialInputs });
            }
        });
    }

    getHistoryCacheLimit() {
        const config = this.getStateMachineConfig();
        const limit = typeof config.historyCacheLimit === 'number' ? config.historyCacheLimit : 200;
        return limit > 0 ? limit : 200;
    }

    clearHistoryCache() {
        this.historyCache.clear();
        this.historyCacheOrder = [];
    }

    makeHistoryCacheKey(recordID, historyParams) {
        return `${recordID}::${JSON.stringify(historyParams || {})}`;
    }

    cloneHistorySnapshot(history) {
        if (!history) {
            return history;
        }
        if (typeof structuredClone === 'function') {
            return structuredClone(history);
        }
        return JSON.parse(JSON.stringify(history));
    }

    getHistoryFromCache(recordID, historyParams) {
        const key = this.makeHistoryCacheKey(recordID, historyParams);
        if (!this.historyCache.has(key)) {
            return null;
        }
        this.historyCacheOrder = this.historyCacheOrder.filter(item => item !== key);
        this.historyCacheOrder.push(key);
        return this.cloneHistorySnapshot(this.historyCache.get(key));
    }

    setHistoryInCache(recordID, historyParams, history) {
        const key = this.makeHistoryCacheKey(recordID, historyParams);
        const clonedHistory = this.cloneHistorySnapshot(history);
        this.historyCache.set(key, clonedHistory);
        this.historyCacheOrder = this.historyCacheOrder.filter(item => item !== key);
        this.historyCacheOrder.push(key);

        const limit = this.getHistoryCacheLimit();
        while (this.historyCacheOrder.length > limit) {
            const oldestKey = this.historyCacheOrder.shift();
            if (oldestKey) {
                this.historyCache.delete(oldestKey);
            }
        }
    }

    invalidateHistoryCacheForRecord(recordID) {
        const prefix = `${recordID}::`;
        const keysToDelete = [];
        this.historyCache.forEach((_, key) => {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        });
        if (keysToDelete.length > 0) {
            keysToDelete.forEach(key => this.historyCache.delete(key));
            this.historyCacheOrder = this.historyCacheOrder.filter(key => !keysToDelete.includes(key));
        }
    }

    invalidateHistoryCacheForRecords(recordIDs = []) {
        if (!Array.isArray(recordIDs) || recordIDs.length === 0) {
            return;
        }
        recordIDs.forEach(recordID => this.invalidateHistoryCacheForRecord(recordID));
    }

    getLastConsumedRecordID(consumerInstanceID, producerInstanceID) {
        return this.consumerInputCursor?.[consumerInstanceID]?.[producerInstanceID];
    }

    updateConsumerCursorWithRecord(record) {
        if (!record || record.deleted || record.state !== "completed" || nullUndefinedOrEmpty(record.inputs)) {
            return;
        }
        const consumerInstanceID = record.nodeInstanceID;
        if (!this.consumerInputCursor[consumerInstanceID]) {
            this.consumerInputCursor[consumerInstanceID] = {};
        }
        record.inputs.forEach(input => {
            if (input?.producerInstanceID && input?.recordID) {
                this.consumerInputCursor[consumerInstanceID][input.producerInstanceID] = input.recordID;
                this.debugLog('logStateMachineCursor', `Cursor update: ${consumerInstanceID} <= ${input.producerInstanceID} now ${input.recordID}`);
            }
        });
    }

    rebuildConsumerCursorFromRecords(records = []) {
        this.consumerInputCursor = {};
        records.forEach(record => this.updateConsumerCursorWithRecord(record));
    }

    hasRecordInProgressWithInputs(nodeInstanceID, candidateInputs = []) {
        if (!nodeInstanceID || !Array.isArray(candidateInputs) || candidateInputs.length === 0) {
            return false;
        }
        const candidateIDs = candidateInputs
            .map(input => (input && input.recordID != null ? String(input.recordID) : null))
            .filter(id => id !== null);
        if (candidateIDs.length === 0) {
            return false;
        }
        return this.recordsInProgress.some(record => {
            if (!record || record.nodeInstanceID !== nodeInstanceID || !Array.isArray(record.inputs)) {
                return false;
            }
            const inFlightIDs = record.inputs
                .map(input => (input && input.recordID != null ? String(input.recordID) : null))
                .filter(id => id !== null);
            if (inFlightIDs.length !== candidateIDs.length) {
                return false;
            }
            const remaining = new Set(inFlightIDs);
            for (let i = 0; i < candidateIDs.length; i++) {
                const id = candidateIDs[i];
                if (!remaining.has(id)) {
                    return false;
                }
                remaining.delete(id);
            }
            return remaining.size === 0;
        });
    }

    rebuildCursorForEdge(consumerInstanceID, producerInstanceID) {
        if (!this.recordHistory || !Array.isArray(this.recordHistory.records)) {
            return;
        }
        for (let i = this.recordHistory.records.length - 1; i >= 0; i--) {
            const record = this.recordHistory.records[i];
            if (record.nodeInstanceID !== consumerInstanceID) {
                continue;
            }
            if (record.deleted || record.state !== "completed" || nullUndefinedOrEmpty(record.inputs)) {
                continue;
            }
            const matchingInput = record.inputs.find(input => input.producerInstanceID === producerInstanceID);
            if (matchingInput) {
                if (!this.consumerInputCursor[consumerInstanceID]) {
                    this.consumerInputCursor[consumerInstanceID] = {};
                }
                this.consumerInputCursor[consumerInstanceID][producerInstanceID] = matchingInput.recordID;
                this.debugLog('logStateMachineCursor', `Cursor rebuild: ${consumerInstanceID} <= ${producerInstanceID} -> ${matchingInput.recordID}`);
                return;
            }
        }
        if (this.consumerInputCursor[consumerInstanceID]) {
            delete this.consumerInputCursor[consumerInstanceID][producerInstanceID];
            if (Object.keys(this.consumerInputCursor[consumerInstanceID]).length === 0) {
                delete this.consumerInputCursor[consumerInstanceID];
            }
        }
        this.debugLog('logStateMachineCursor', `Cursor cleared: ${consumerInstanceID} <= ${producerInstanceID}`);
    }

    handleCursorDeletions(recordIDs = []) {
        if (!Array.isArray(recordIDs) || recordIDs.length === 0) {
            return;
        }
        recordIDs.forEach(deletedRecordID => {
            Object.keys(this.consumerInputCursor).forEach(consumerInstanceID => {
                Object.keys(this.consumerInputCursor[consumerInstanceID]).forEach(producerInstanceID => {
                    if (this.consumerInputCursor[consumerInstanceID][producerInstanceID] === deletedRecordID) {
                        this.rebuildCursorForEdge(consumerInstanceID, producerInstanceID);
                    }
                });
            });

            const deletedRecord = typeof this.recordHistory?.getRecord === 'function'
                ? this.recordHistory.getRecord(deletedRecordID)
                : null;
            if (deletedRecord && Array.isArray(deletedRecord.inputs) && deletedRecord.inputs.length > 0) {
                const consumerInstanceID = deletedRecord.nodeInstanceID;
                deletedRecord.inputs.forEach(input => {
                    const producerInstanceID = input?.producerInstanceID;
                    if (!producerInstanceID) {
                        return;
                    }
                    this.rebuildCursorForEdge(consumerInstanceID, producerInstanceID);
                });
            }
        });
    }

    updateConsumerCursorWithDelta({ newRecords = [], updatedRecords = [], deletedRecordIDs = [] } = {}) {
        newRecords.forEach(record => this.updateConsumerCursorWithRecord(record));
        updatedRecords.forEach(record => this.updateConsumerCursorWithRecord(record));
        this.handleCursorDeletions(deletedRecordIDs);
    }

    ensureRecordGraphInitialized(records, nodes, { forceRebuild = false } = {}) {
        if (forceRebuild || !this.cachedRecordGraph) {
            this.cachedRecordGraph = new RecordGraph(records, nodes);
            this.lastRecordGraphSnapshotSize = Array.isArray(records) ? records.length : 0;
            this.debugLog('logStateMachineFlowGraph', `RecordGraph rebuilt (size=${this.lastRecordGraphSnapshotSize})`);
        }
    }

    updateRecordGraphWithDelta({ newRecords = [], updatedRecords = [], deletedRecordIDs = [] } = {}, records, nodes, { fullReload = false } = {}) {
        if (fullReload || !this.cachedRecordGraph) {
            this.ensureRecordGraphInitialized(records, nodes, { forceRebuild: true });
            return;
        }
        if (typeof this.cachedRecordGraph.applyDelta === 'function') {
            this.cachedRecordGraph.applyDelta({
                newRecords,
                updatedRecords,
                deletedRecordIDs,
                records
            });
            this.debugLog('logStateMachineFlowGraph', `RecordGraph delta applied (new=${newRecords.length}, updated=${updatedRecords.length}, deleted=${deletedRecordIDs.length})`);
        } else {
            this.ensureRecordGraphInitialized(records, nodes, { forceRebuild: true });
        }
    }

    processRecordHistoryLoadResult(loadInfo) {
        if (!loadInfo) {
            return;
        }
        this.lastRecordHistoryLoadInfo = loadInfo;
        const { delta = {}, fullReload } = loadInfo;
        const newRecords = Array.isArray(delta.newRecords) ? delta.newRecords : [];
        const updatedRecords = Array.isArray(delta.updatedRecords) ? delta.updatedRecords : [];
        const deletedRecordIDs = Array.isArray(delta.deletedRecordIDs) ? delta.deletedRecordIDs : [];
        const records = this.recordHistory?.records || [];
        this.updateConsumerCursorWithDelta({ newRecords, updatedRecords, deletedRecordIDs });
        const removedRecordIDs = [
            ...deletedRecordIDs,
            ...updatedRecords
                .filter(record => record && (record.deleted || record.state !== "completed"))
                .map(record => record.recordID)
        ];
        const affectedRecordIDs = [
            ...newRecords.map(record => record.recordID),
            ...updatedRecords.map(record => record.recordID),
            ...removedRecordIDs
        ];
        this.invalidateHistoryCacheForRecords(affectedRecordIDs);
        if (fullReload) {
            this.rebuildConsumerCursorFromRecords(records);
            this.clearHistoryCache();
        }
        const completedNewRecords = newRecords.filter(record => record && !record.deleted && record.state === "completed");
        const completedUpdatedRecords = updatedRecords.filter(record => record && !record.deleted && record.state === "completed");
        const graphDelta = {
            newRecords: completedNewRecords,
            updatedRecords: completedUpdatedRecords,
            deletedRecordIDs: removedRecordIDs
        };
        this.invalidateHistoryCacheForRecords(removedRecordIDs);
        this.updateRecordGraphWithDelta(graphDelta, records, this.versionInfo?.stateMachineDescription?.nodes || [], { fullReload });
        this.debugLog('logStateMachineRecordDelta', `RecordHistory load: fullReload=${fullReload ? 'yes' : 'no'} new=${newRecords.length} updated=${updatedRecords.length} deleted=${deletedRecordIDs.length}`);
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
        this.aiPriorityNodeTypeSet = null;
        this.clearPlan({ preserveWaitMap: false });

        const loadInfo = await this.recordHistory.load({ incremental: false });
        this.processRecordHistoryLoadResult(loadInfo);

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

    applyUnconsumedVariableInputsToRunInfo({ runInfo, unconsumedInputs, node }) {
        const nodeMetadata = getMetadataForNodeType(node.nodeType);
        for (let k = 0; k < node.inputs.length; k++) {
            const inputType = node.inputs[k];

            if (!inputType.variables || inputType.variables.length === 0) {
                continue;
            }

            let recordFound = null;
            let inputRecord = runInfo.inputs.find(input => input.producerInstanceID === inputType.producerInstanceID);
            let foundExistingInputRecord = false;
            if (inputRecord) {
                foundExistingInputRecord = true;
                recordFound = this.recordHistory.getRecord(inputRecord.recordID);
                if (!recordFound) {
                    throw new Error(`Could not find record ${inputRecord.recordID} for node ${node.instanceName} in unconsumed inputs`);
                }
            } else {
                const unconsumedInputsForType = unconsumedInputs[inputType.producerInstanceID] || [];
                if (unconsumedInputsForType.length === 0) {
                    const producerLabel = this.formatNodeLabelByInstanceID(inputType.producerInstanceID);
                    const variableNames = (inputType.variables || []).map(variable => variable.consumerVariable || variable.producerOutput).join(', ');
                    const reason = variableNames
                        ? `waiting for ${variableNames} from ${producerLabel}`
                        : `waiting for output from ${producerLabel}`;
                    if (node.requireAllVariables) {
                        this.logPlanning(`${this.formatNodeLabel(node)} is ${reason}; cannot run until data arrives.`);
                        return { success: false, reason };
                    } else {
                        this.logPlanning(`${this.formatNodeLabel(node)} is ${reason}, but the variable is optional; continuing.`);
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

            for (let j = 0; j < inputType.variables.length; j++) {
                const producerOutput = inputType.variables[j].producerOutput;
                const consumerVariable = inputType.variables[j].consumerVariable;
                const isCompositeVariable = nodeMetadata.AllowedVariableOverrides?.[consumerVariable]?.mediaType === "composite";
                const variableValue = recordFound.output[producerOutput];
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

        return { success: true };
    }

    generateRunInfoForNode({ node, unconsumedInputs }) {
        const consumerLabel = this.formatNodeLabel(node);

        const waitEntries = this.plan?.waitForUpdateBeforeReattempting;
        if (waitEntries) {
            const hasPendingExternalInput = Object.values(waitEntries).some(record =>
                record && record.nodeInstanceID === node.instanceID && record.state === "waitingForExternalInput"
            );
            if (hasPendingExternalInput) {
                this.logPlanning(`${consumerLabel} already waiting on external input; skipping new run.`);
                return;
            }
        }

        this.logPlanning(`Evaluating ${consumerLabel} dependencies.`);
        let ranOutOfInputs = false;
        let producedRuns = 0;
        let count = 0;
        do {
            let runInfo = {
                nodeInstance: this.nodeInstances[node.instanceID],
                readyTime: new Date(0),
                inputs: [],
            };

            if (!runInfo.nodeInstance) {
                throw new Error(`Node instance not found for node ${node.instanceID}`);
            }

            const nodeInputArray = node.inputs;
            let foundAllRequiredTriggers = true;
            let foundAnyTriggers = false;

            for (let k = 0; k < nodeInputArray.length; k++) {
                const inputType = nodeInputArray[k];
                const producerLabel = this.formatNodeLabelByInstanceID(inputType.producerInstanceID);

                if (inputType.triggers) {
                    const triggerNames = inputType.triggers.map(trigger => trigger.producerEvent).join(', ');
                    const unconsumedInputsForType = unconsumedInputs[inputType.producerInstanceID] || [];
                    let inputRecordFound = null;
                    let eventsApplied = [];

                    if (node.requireAllEventTriggers || node.requireAllInputs) {
                        this.logTriggers(`${consumerLabel} requires all events [${triggerNames}] from ${producerLabel}.`);
                        for (let i = 0; i < unconsumedInputsForType.length; i++) {
                            const inputRecord = unconsumedInputsForType[i];
                            eventsApplied = [];
                            let allTriggersFound = true;
                            for (let t = 0; t < inputType.triggers.length; t++) {
                                const producerEventName = inputType.triggers[t].producerEvent;
                                if (!inputRecord.eventsEmitted.includes(producerEventName)) {
                                    this.logTriggers(`Record ${inputRecord.recordID} from ${producerLabel} is missing event ${producerEventName}.`);
                                    allTriggersFound = false;
                                    break;
                                }
                                eventsApplied.push(producerEventName);
                            }
                            if (allTriggersFound) {
                                this.logTriggers(`Record ${inputRecord.recordID} from ${producerLabel} supplies events ${eventsApplied.join(', ')}.`);
                                inputRecordFound = inputRecord;
                                break;
                            }
                        }

                        if (!inputRecordFound) {
                            const reason = triggerNames ? `waiting for event ${triggerNames} from ${producerLabel}` : `waiting for an event from ${producerLabel}`;
                            this.logTriggers(`${consumerLabel} is ${reason}.`);
                            this.noteBlockedNode(node.instanceID, reason, { hasPartialInputs: true });
                            foundAllRequiredTriggers = false;
                            break;
                        }
                    } else {
                        eventsApplied = [];
                        for (let i = 0; i < unconsumedInputsForType.length; i++) {
                            const inputRecord = unconsumedInputsForType[i];
                            for (let t = 0; t < inputType.triggers.length; t++) {
                                const producerEventName = inputType.triggers[t].producerEvent;
                                if (inputRecord.eventsEmitted.includes(producerEventName)) {
                                    this.logTriggers(`${consumerLabel} found event ${producerEventName} from ${producerLabel}.`);
                                    inputRecordFound = inputRecord;
                                    eventsApplied.push(producerEventName);
                                    break;
                                }
                            }
                            if (inputRecordFound) {
                                break;
                            }
                        }
                        if (!inputRecordFound) {
                            const reason = triggerNames ? `waiting for event ${triggerNames} from ${producerLabel}` : `waiting for a trigger from ${producerLabel}`;
                            this.logTriggers(`${consumerLabel} is ${reason}.`);
                            this.noteBlockedNode(node.instanceID, reason, { hasPartialInputs: true });
                            if (node.requireAllEventTriggers || node.requireAllInputs) {
                                foundAllRequiredTriggers = false;
                                ranOutOfInputs = true;
                                break;
                            }
                            continue;
                        }
                    }

                    runInfo.inputs.push({
                        producerInstanceID: inputType.producerInstanceID,
                        recordID: inputRecordFound.recordID,
                        includeHistory: true,
                        events: eventsApplied,
                    });
                    foundAnyTriggers = true;
                }
            }

            if (!foundAllRequiredTriggers || !foundAnyTriggers) {
                ranOutOfInputs = true;
                break;
            }

            const variableInputsResult = this.applyUnconsumedVariableInputsToRunInfo({ runInfo, unconsumedInputs, node });
            if (!variableInputsResult.success) {
                if (variableInputsResult.reason) {
                    this.noteBlockedNode(node.instanceID, variableInputsResult.reason, { hasPartialInputs: true });
                }
                ranOutOfInputs = true;
                break;
            }

            const candidateIDs = runInfo.inputs
                .map(input => (input && input.recordID != null ? String(input.recordID) : null))
                .filter(id => id !== null);
            if (this.hasRecordInProgressWithInputs(node.instanceID, runInfo.inputs)) {
                const reason = candidateIDs.length
                    ? `waiting for in-flight run consuming ${candidateIDs.join(', ')}`
                    : 'waiting for an in-flight run to finish';
                this.logPlanning(`${consumerLabel} is ${reason}.`);
                this.noteBlockedNode(node.instanceID, reason, { hasPartialInputs: true });
                ranOutOfInputs = true;
                break;
            }

            if (!ranOutOfInputs) {
                this.applyMessageHistoryToRunInfo(runInfo);
                this.plan.readyToProcess.push(runInfo);
                this.clearBlockedNode(node.instanceID);
                producedRuns += 1;

                for (let k = 0; k < runInfo.inputs.length; k++) {
                    const input = runInfo.inputs[k];
                    const before = unconsumedInputs[input.producerInstanceID].length;
                    unconsumedInputs[input.producerInstanceID] = unconsumedInputs[input.producerInstanceID].filter(record => record.recordID !== input.recordID);
                    const remaining = unconsumedInputs[input.producerInstanceID].length;
                    this.logPlanning(`${consumerLabel}: consumed record ${input.recordID} from ${this.formatNodeLabelByInstanceID(input.producerInstanceID)} (remaining ${before} -> ${remaining}).`);
                }
                this.logPlanning(`${consumerLabel}: ready with ${runInfo.inputs.length} input(s).`);

                if (!node.requireAllEventTriggers && !node.requireAllInputs) {
                    ranOutOfInputs = true;
                }
            } else {
                this.logPlanning(`${consumerLabel} is waiting for required inputs.`);
            }

            count++;
            if (count > 1000) {
                return;
            }
        } while (!ranOutOfInputs);

        if (producedRuns === 0) {
            this.collectBlockedReasonsForNode(node, unconsumedInputs);
        }
    }

    generateUnconsumedInputsForNode(node, recordsByNodeInstanceID) {
        const { Constants } = Config;

        const recordsForNode = recordsByNodeInstanceID[node.instanceID];

        const inputsArray = node.inputs;

        let unconsumedInputs = {};
        
        for (let k = 0; k < inputsArray.length; k++) {
            let input = inputsArray[k];
            const cursorConsumedRecordID = this.getLastConsumedRecordID(node.instanceID, input.producerInstanceID);
            let mostRecentConsumedID = cursorConsumedRecordID;
            let mostRecentConsumerRecord = null;

            if (!cursorConsumedRecordID && recordsForNode) {
                mostRecentConsumerRecord = this.getMostRecentRecordConsumingNodeType(recordsForNode, input.producerInstanceID);
                mostRecentConsumedID = mostRecentConsumerRecord?.inputs?.find(consumerIn => consumerIn.producerInstanceID === input.producerInstanceID)?.recordID;
            } else if (cursorConsumedRecordID && recordsForNode) {
                mostRecentConsumerRecord = recordsForNode.find(candidate => {
                    if (candidate.state !== "completed" || nullUndefinedOrEmpty(candidate.inputs)) {
                        return false;
                    }
                    return candidate.inputs.some(candidateInput => candidateInput.producerInstanceID === input.producerInstanceID && candidateInput.recordID === cursorConsumedRecordID);
                });
            }

            if (mostRecentConsumerRecord) {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - most recent consumer record ${mostRecentConsumerRecord.recordID} consumed ${input.producerInstanceID} -> ${mostRecentConsumedID}`);
            } else if (cursorConsumedRecordID) {
                this.debugLog('logStateMachineCursor', `[${node.instanceName}] cursor indicates consumption of ${cursorConsumedRecordID} from ${input.producerInstanceID}, but no record matched in history`);
            } else {
                Constants.debug.logStateMachine && console.error(this.debugID + ' ' + `@@@ [${node.instanceName}] - no consumer record found -- all inputs are unconsumed.`);
            }

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
        this.logPlanning('Recomputing nodes that are ready to run.');

        if (records.length === 0) {
            const startNode = this.versionInfo.stateMachineDescription.nodes[0];
            if (startNode.nodeType !== "start") {
                throw new Error("STATE MACHINE: First record is not a start node!");
            }

            this.logPlanning('Seeding plan with the start node.');
            const runInfo = {
                nodeInstance: this.nodeInstances[startNode.instanceID],
                readyTime: new Date(0),
                inputs: [],
            };
            this.plan.readyToProcess.push(runInfo);
            return;
        }

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const isTracked = !!this.plan.waitForUpdateBeforeReattempting[record.recordID];
            if (record.state === "waitingForExternalInput") {
                this.plan.waitForUpdateBeforeReattempting[record.recordID] = record;
                const nodeInstance = this.nodeInstances[record.nodeInstanceID];
                if (nodeInstance) {
                    const reason = this.describePendingReason(record);
                    this.logPlanning(`Waiting for external input before retrying ${this.formatNodeLabel(nodeInstance.fullNodeDescription)}.`);
                    this.noteBlockedNode(nodeInstance.fullNodeDescription.instanceID, reason, { hasPartialInputs: false });
                }
                continue;
            }

            if (record.state === "failed" && !isTracked) {
                const nodeInstance = this.nodeInstances[record.nodeInstanceID];
                if (!nodeInstance) {
                    this.logPlanning(`Removing stale record for deleted node instance ${record.nodeInstanceID}.`);
                    this.recordHistory.deleteRecord(record.recordID);
                    continue;
                }

                let inputsAreValid = true;
                const allInputs = nodeInstance.fullNodeDescription.inputs;
                const recordInputs = record.inputs;
                if (nodeInstance.requireAllEventTriggers || nodeInstance.requireAllInputs) {
                    if (allInputs.length === recordInputs.length) {
                        for (let j = 0; j < allInputs.length; j++) {
                            if (allInputs[j].producerInstanceID !== recordInputs[j].producerInstanceID) {
                                inputsAreValid = false;
                                break;
                            }
                        }
                    } else {
                        inputsAreValid = false;
                    }
                } else if (!allInputs.some(input => input.producerInstanceID === recordInputs[0].producerInstanceID)) {
                    inputsAreValid = false;
                }

                if (inputsAreValid) {
                    const runInfo = {
                        nodeInstance: nodeInstance,
                        readyTime: new Date(0),
                        inputs: record.inputs,
                        existingRecord: record,
                    };
                    this.logPlanning(`Re-queueing pending record for ${this.formatNodeLabel(nodeInstance.fullNodeDescription)}.`);
                    this.applyMessageHistoryToRunInfo(runInfo);
                    this.plan.readyToProcess.push(runInfo);
                } else {
                    this.logPlanning(`Discarding stale record for ${this.formatNodeLabel(nodeInstance.fullNodeDescription)} due to incompatible inputs.`);
                    this.recordHistory.deleteRecord(record.recordID);
                }
            }
        }

        for (let n = 0; n < this.versionInfo.stateMachineDescription.nodes.length; n++) {
            const node = this.versionInfo.stateMachineDescription.nodes[n];
            await this.processNode(node, recordsByNodeInstanceID);
        }

        this.logPlanning('Finished dependency recompute.');
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

        const cachedHistory = this.getHistoryFromCache(recordID, historyParams);
        if (cachedHistory) {
            this.debugLog('logStateMachineHistoryCache', `History cache hit for record ${recordID}`);
            return cachedHistory;
        }

        const history = this.recordHistory.getFilteredRecords(historyParams);
        this.setHistoryInCache(recordID, historyParams, history);
        this.debugLog('logStateMachineHistoryCache', `History cache miss for record ${recordID}, cached new snapshot (size=${history?.length || 0})`);

        return this.cloneHistorySnapshot(history);
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

            const variableSyncResult = this.applyUnconsumedVariableInputsToRunInfo({ runInfo, unconsumedInputs, node: nodeInstance.fullNodeDescription });
            if (!variableSyncResult.success) {
                return;
            }

            // splice full record history rather than input-by-input which is required by context-aware nodes
            const fullHistoryForContextProcessing = this.getRecordHistoryForRecord(newRecord.recordID);
            
            await nodeInstance.processExecutionContext({ history: fullHistoryForContextProcessing, record: newRecord });

            const needToProcessFlowControlRecord = await nodeInstance.processFlowControlForThisNode({ record: newRecord });

            if (needToProcessFlowControlRecord) {

                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%% PROCESSING FLOW CONTROL NODE ${nodeInstance.fullNodeDescription.instanceName} %%%%%%%`);
                Constants.debug.logFlowControl && console.error(this.debugID + ' ' + `%%%%%%%     PREVIOUS RECORD: `, record);

                this.recordHistory.addRecordWithoutWritingToDB(newRecord);
                this.updateRecordGraphWithDelta({ newRecords: [newRecord], updatedRecords: [], deletedRecordIDs: [] }, this.recordHistory.records, this.versionInfo?.stateMachineDescription?.nodes || [], { fullReload: false });

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


        this.ensureRecordGraphInitialized(this.recordHistory.records, this.versionInfo.stateMachineDescription.nodes);
        if (this.cachedRecordGraph) {
            this.cachedRecordGraph.inputRecords = this.recordHistory.records;
        }

        const recordGraph = this.cachedRecordGraph;
        if (!recordGraph) {
            return;
        }

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

        this.logPlanning('Updating execution plan.');

        if (nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription) || nullUndefinedOrEmpty(this.versionInfo.stateMachineDescription.nodes) |
            this.versionInfo.stateMachineDescription.nodes.length === 0) {
            return;
        }

        if (!this.recordHistory) {
            throw new Error('Tried to plan before record history was initialized!');
        }

        if (this.plan?.blockedNodes instanceof Map) {
            this.plan.blockedNodes.clear();
        }

        let records = [...this.recordsInProgress];

        const loadInfo = await this.recordHistory.load({ incremental: true });
        this.processRecordHistoryLoadResult(loadInfo);

        this.logRecords(`Loaded record history (${records.length} in progress).`);
        if (records.length > 0 && Constants.debug?.stateMachineRecords) {
            this.logRecords('In-progress records:');
            records.forEach((record, index) => {
                this.logRecords(`  [${index}] ${record.nodeType || record.nodeInstanceID} ${record.recordID}`);
            });
        }

        const recordsFromDB = this.recordHistory.getFilteredRecords({ includeDeleted: false, includeFailed: true, ignoreCompression: false, includeWaitingForExternalInput: true });
        records = [...recordsFromDB, ...records];

        records = records.filter((record, index, self) =>
            index === self.findIndex((t) => t.recordID === record.recordID)
        );

        records.sort((a, b) => {
            const aDate = a?.startTime instanceof Date ? a.startTime : new Date(a.startTime);
            const bDate = b?.startTime instanceof Date ? b.startTime : new Date(b.startTime);
            const aTime = aDate instanceof Date && !Number.isNaN(aDate.getTime()) ? aDate.getTime() : 0;
            const bTime = bDate instanceof Date && !Number.isNaN(bDate.getTime()) ? bDate.getTime() : 0;
            return aTime - bTime;
        });

        this.reconcileWaitMap(records);

        this.logRecords(`Working set contains ${records.length} record${records.length === 1 ? '' : 's'}.`);

        const recordsByNodeInstanceID = {};
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            if (record.deleted) {
                continue;
            }
            if (!recordsByNodeInstanceID[record.nodeInstanceID]) {
                recordsByNodeInstanceID[record.nodeInstanceID] = [];
            }
            recordsByNodeInstanceID[record.nodeInstanceID].push(record);
        }

        this.logPlanning('Identifying nodes that are ready to run.');
        await this.findReadyToProcess(records, recordsByNodeInstanceID);

        this.logPlanning('Applying message history to candidate nodes.');
        await this.performPostProcessAndFlowControl(records, recordsByNodeInstanceID);
    }

    clearPlan({ preserveWaitMap = false } = {}) {
        const existingWaitMap = preserveWaitMap && this.plan?.waitForUpdateBeforeReattempting
            ? { ...this.plan.waitForUpdateBeforeReattempting }
            : {};
        const existingBlocked = preserveWaitMap && this.plan?.blockedNodes instanceof Map
            ? new Map(this.plan.blockedNodes)
            : new Map();

        this.plan = { 
            readyToProcess: [],
            processing: [],
            waitForUpdateBeforeReattempting: existingWaitMap,
            blockedNodes: existingBlocked,
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

        const nodeInstance = runInfo.nodeInstance;
        const nodeLabel = this.formatNodeLabel(nodeInstance.fullNodeDescription);
        this.logActivity(`Post-processing ${nodeLabel}.`);

        if (!Constants.validRecordStates.includes(results.state)) {
            throw new Error(`Node ${nodeInstance.fullNodeDescription.instanceName} returned an invalid state: ${results.state}`);
        }

        let finalResults = { ...results };
        finalResults.error = EnsureCorrectErrorType(finalResults.error);

        let finalRecord = {
            ...record,
            ...finalResults,
            state: finalResults.state
        };

        if (finalRecord.state !== "completed") {
            this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID] = finalRecord;
        } else if (this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID]) {
            delete this.plan.waitForUpdateBeforeReattempting[finalRecord.recordID];
        }

        await nodeInstance.postProcess({ channel, results: finalResults, stateMachine: this, record: finalRecord, debuggingTurnedOn });

        await this.recordHistory.insertOrUpdateRecord(finalRecord);
        if (finalRecord.state === "completed") {
            this.updateConsumerCursorWithRecord(finalRecord);
        }
        this.invalidateHistoryCacheForRecord(finalRecord.recordID);
        if (!nullUndefinedOrEmpty(finalRecord.inputs)) {
            finalRecord.inputs.forEach(input => {
                if (input?.recordID) {
                    this.invalidateHistoryCacheForRecord(input.recordID);
                }
            });
        }
        const graphDeltaForRecord = { newRecords: [], updatedRecords: [], deletedRecordIDs: [] };
        if (runInfo.existingRecord) {
            if (finalRecord.deleted || finalRecord.state !== "completed") {
                graphDeltaForRecord.deletedRecordIDs.push(finalRecord.recordID);
            } else {
                graphDeltaForRecord.updatedRecords.push(finalRecord);
            }
        } else if (finalRecord.state === "completed" && !finalRecord.deleted) {
            graphDeltaForRecord.newRecords.push(finalRecord);
        }
        if (graphDeltaForRecord.newRecords.length || graphDeltaForRecord.updatedRecords.length || graphDeltaForRecord.deletedRecordIDs.length) {
            this.updateRecordGraphWithDelta(graphDeltaForRecord, this.recordHistory.records, this.versionInfo?.stateMachineDescription?.nodes || [], { fullReload: false });
        }

        this.recordsInProgress = this.recordsInProgress.filter(r => r.recordID !== finalRecord.recordID);

        await onPostNode({ runInfo, record: finalRecord, results: finalResults });

        const stateSummary = finalRecord.state?.toUpperCase() || 'UNKNOWN';
        this.logRecordStateOnce(finalRecord.recordID, finalRecord.state, () => {
            if (finalRecord.state === 'completed') {
                return `Finished ${nodeLabel} -> ${stateSummary}.`;
            }
            return `${nodeLabel} state updated: ${stateSummary}.`;
        });
        if (finalRecord.state === 'completed') {
            this.lastRecordStateLog.delete(finalRecord.recordID);
        }
    }

    async drainQueue({ stepLimit, channel, seed, debuggingTurnedOn, account, wasCancelled, onPreNode, onPostNode, onStateMachineError, debugID }) {
        const { Constants } = Config;

        this.debugID = debugID;
        let pendingPromises = [];
        const keySource = this.versionInfo.alwaysUseBuiltInKeys ? { source: 'builtin' } : { source: 'account', account: account };

        try {
            this.logActivity('Scheduler loop started');
            this.clearPlan({ preserveWaitMap: true });

            let iterations = 0;
            while ((!wasCancelled || !wasCancelled()) && (stepLimit === 0 || iterations < stepLimit || this.plan.processing.length > 0)) {
                await this.createPlan();

                if (this.plan.processing.length === 0 && this.plan.readyToProcess.length === 0) {
                    this.logActivity('No nodes are ready to run; scheduler is idle.');
                    this.reportDependencySnapshot();
                    break;
                }

                if (this.plan.readyToProcess.length > 0) {
                    const readyCount = this.plan.readyToProcess.length;
                    this.logActivity(`Ready to process ${readyCount} node${readyCount === 1 ? '' : 's'}.`);

                    const priorityNodeTypes = this.getPriorityNodeTypeSet();
                    this.plan.readyToProcess.sort((a, b) => {
                        const aType = a.nodeInstance?.fullNodeDescription?.nodeType;
                        const bType = b.nodeInstance?.fullNodeDescription?.nodeType;
                        const aPriority = priorityNodeTypes.has(aType) ? 0 : 1;
                        const bPriority = priorityNodeTypes.has(bType) ? 0 : 1;
                        if (aPriority !== bPriority) {
                            return aPriority - bPriority;
                        }
                        const aReady = a.readyTime instanceof Date ? a.readyTime.getTime() : 0;
                        const bReady = b.readyTime instanceof Date ? b.readyTime.getTime() : 0;
                        if (aReady !== bReady) {
                            return aReady - bReady;
                        }
                        const aName = a.nodeInstance?.fullNodeDescription?.instanceName || '';
                        const bName = b.nodeInstance?.fullNodeDescription?.instanceName || '';
                        return aName.localeCompare(bName);
                    });

                    if (Constants.debug?.stateMachineQueue) {
                        const queueDescription = this.plan.readyToProcess.map(runInfo => {
                            const nodeType = runInfo.nodeInstance?.fullNodeDescription?.nodeType;
                            const instanceName = runInfo.nodeInstance?.fullNodeDescription?.instanceName || 'unnamed';
                            const ready = runInfo.readyTime instanceof Date && !Number.isNaN(runInfo.readyTime.getTime()) ? runInfo.readyTime.toISOString() : 'immediate';
                            const priorityTag = priorityNodeTypes.has(nodeType) ? 'AI' : 'GEN';
                            return `${instanceName}(${nodeType}|${priorityTag}|ready:${ready})`;
                        }).join(', ');
                        this.logQueueDetail(`Ready queue sequence: ${queueDescription}`);
                    }

                    if (stepLimit > 0) {
                        const remainingSteps = Math.max(stepLimit - iterations, 0);
                        if (remainingSteps === 0) {
                            if (this.plan.readyToProcess.length > 0) {
                                this.logActivity('Step limit reached; deferring additional nodes until the next drain cycle.');
                            }
                            this.plan.readyToProcess = [];
                        } else if (this.plan.readyToProcess.length > remainingSteps) {
                            this.plan.readyToProcess = this.plan.readyToProcess.slice(0, remainingSteps);
                            this.logActivity(`Trimmed ready queue to ${this.plan.readyToProcess.length} node${this.plan.readyToProcess.length === 1 ? '' : 's'} to respect the step limit.`);
                        }
                    }

                    iterations += this.plan.readyToProcess.length;

                    for (const runInfo of this.plan.readyToProcess) {
                        const promise = new Promise((resolve, reject) => {
                            this.plan.processing.push(runInfo);
                            const nodeLabel = this.formatNodeLabel(runInfo.nodeInstance.fullNodeDescription);
                            this.logNode(nodeLabel);

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
                                            .then(() => {
                                                this.plan.processing = this.plan.processing.filter(item => item !== runInfo);
                                                pendingPromises = pendingPromises.filter(p => p !== promise);
                                                resolve(results);
                                            })
                                            .catch(error => {
                                                onStateMachineError(error);
                                                reject(error);
                                            });
                                    })
                                    .catch(error => {
                                        this.plan.processing = this.plan.processing.filter(item => item !== runInfo);
                                        pendingPromises = pendingPromises.filter(p => p !== promise);
                                        onStateMachineError(error);
                                        reject(error);
                                    });
                                })
                                .catch(error => {
                                    this.plan.processing = this.plan.processing.filter(item => item !== runInfo);
                                    pendingPromises = pendingPromises.filter(p => p !== promise);
                                    onStateMachineError(error);
                                    reject(error);
                                });
                        });
                        pendingPromises.push(promise);
                    }

                    this.plan.readyToProcess = [];
                }

                if (pendingPromises.length > 0) {
                    await Promise.race(pendingPromises);
                    this.logActivity('At least one node finished; replanning.');
                }
            }

            const cancelled = wasCancelled && wasCancelled();
            this.logActivity(`Scheduler loop finished after ${iterations} dispatch${iterations === 1 ? '' : 'es'}${cancelled ? ' (cancelled)' : ''}.`);
        } catch (e) {
            onStateMachineError(e);
        }

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
