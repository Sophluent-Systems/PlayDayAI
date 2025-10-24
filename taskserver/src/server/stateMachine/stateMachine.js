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
import { customComponentNode } from './nodeTypes/customComponentNode.js';
import { v4 as uuidv4 } from 'uuid';
import { RecordGraph } from '@src/common/recordgraph';
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { BaseError, EnsureCorrectErrorType } from '@src/common/errors';
import { CustomComponentRegistry } from './customComponentRegistry';
import { getMostRecentRecordOfInstance } from '@src/backend/records';

const COMPONENT_INPUT_PREFIX = "__component_input__";

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
    "customComponent": customComponentNode,
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
        this.customComponentRegistry = null;
        this.componentInstances = new Map();
        this.plan = {
            readyToProcess: [],
            processing: [],
            waitForUpdateBeforeReattempting: {},
            blockedNodes: new Map(),
        };
        this.lastRecordStateLog = new Map();
        this.ensureRuntimeNodeRegistry();
        this.refreshCustomComponentRegistry();
    }

    refreshCustomComponentRegistry() {
        const { Constants } = Config;
        const maxDepth = Constants?.customComponents?.maxNestingDepth;
        this.customComponentRegistry = new CustomComponentRegistry({
            maxNestingDepth: maxDepth,
        });
        this.customComponentRegistry.hydrateFromVersionInfo(this.versionInfo);
        const personalLibrary = this.session?.customComponents;
        if (Array.isArray(personalLibrary)) {
            this.customComponentRegistry.registerMany(personalLibrary, { skipDepthCheck: true });
        }
        const componentLibraries = this.session?.componentLibraries;
        if (componentLibraries && typeof componentLibraries === "object") {
            Object.values(componentLibraries).forEach((definitions) => {
                this.customComponentRegistry.registerMany(definitions, { skipDepthCheck: true });
            });
        }
        this.componentInstances = new Map();
        return this.customComponentRegistry;
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

    ensureRuntimeNodeRegistry() {
        if (!this.versionInfo) {
            return {};
        }
        const existing = this.versionInfo.stateMachineRuntimeNodes;
        if (existing && typeof existing === 'object' && !(existing instanceof Map)) {
            return existing;
        }
        const initialValue = existing instanceof Map
            ? Object.fromEntries(existing.entries())
            : (existing && typeof existing === 'object') ? { ...existing } : {};
        if (existing) {
            try {
                delete this.versionInfo.stateMachineRuntimeNodes;
            } catch (error) {
                // ignore; defineProperty below will overwrite if allowed
            }
        }
        Object.defineProperty(this.versionInfo, 'stateMachineRuntimeNodes', {
            value: initialValue,
            configurable: true,
            enumerable: false,
            writable: true,
        });
        return this.versionInfo.stateMachineRuntimeNodes;
    }

    registerRuntimeNodeDescription(nodeDescription, nodeInstance) {
        if (!nodeDescription || !nodeDescription.instanceID) {
            return;
        }
        const registry = this.ensureRuntimeNodeRegistry();
        try {
            registry[nodeDescription.instanceID] = JSON.parse(JSON.stringify(nodeDescription));
        } catch (error) {
            registry[nodeDescription.instanceID] = { ...nodeDescription };
        }
        if (Array.isArray(this.versionInfo?.stateMachineDescription?.nodes)) {
            const nodes = this.versionInfo.stateMachineDescription.nodes;
            const existingIndex = nodes.findIndex(node => node.instanceID === nodeDescription.instanceID);
            if (existingIndex >= 0) {
                nodes[existingIndex] = nodeDescription;
            } else {
                nodes.push(nodeDescription);
            }
        }
        if (nodeInstance) {
            this.nodeInstances[nodeDescription.instanceID] = nodeInstance;
        }
    }

    getRuntimeNodeDescription(instanceID) {
        if (!instanceID) {
            return null;
        }
        const registry = this.ensureRuntimeNodeRegistry();
        if (!registry) {
            return null;
        }
        if (registry instanceof Map) {
            return registry.get(instanceID) || null;
        }
        return registry[instanceID] || null;
    }

    createNodeInstanceFromDescription(nodeDescription) {
        if (!nodeDescription || !nodeDescription.instanceID || !nodeDescription.nodeType) {
            return null;
        }
        const NodeClass = nodeTypeLookupTable[nodeDescription.nodeType];
        if (!NodeClass) {
            return null;
        }
        try {
            const nodeInstance = new NodeClass({
                db: this.db,
                session: this.session,
                fullNodeDescription: nodeDescription,
                componentRegistry: this.customComponentRegistry,
            });
            return nodeInstance;
        } catch (error) {
            console.error("[StateMachine] Failed to instantiate node instance", {
                nodeType: nodeDescription.nodeType,
                instanceID: nodeDescription.instanceID,
                error: error.message,
            });
            return null;
        }
    }

    ensureNodeInstance(instanceID, { definition = null, record = null } = {}) {
        if (!instanceID) {
            return null;
        }
        if (this.nodeInstances?.[instanceID]) {
            return this.nodeInstances[instanceID];
        }

        let description = definition;
        if (!description) {
            description = this.getNodeByInstanceID(instanceID);
        }
        if (!description) {
            description = this.getRuntimeNodeDescription(instanceID);
        }
        if (!description && record?.context?.resolvedNodeDefinition) {
            description = record.context.resolvedNodeDefinition;
        }
        if (!description) {
            return null;
        }

        const nodeInstance = this.createNodeInstanceFromDescription(description);
        if (nodeInstance) {
            this.nodeInstances[instanceID] = nodeInstance;
            this.registerRuntimeNodeDescription(description, nodeInstance);
        }
        return nodeInstance;
    }

    shouldKeepRuntimeNode(record) {
        if (!record || record.deleted) {
            return false;
        }
        const state = record.state;
        if (state === "waitingForExternalInput" || state === "pending") {
            return true;
        }
        const hasComponentPath = Array.isArray(record?.context?.componentPathSegments) && record.context.componentPathSegments.length > 0;
        if (hasComponentPath) {
            return true;
        }
        return false;
    }

    removeRuntimeNodeByRecord({ recordID, nodeInstanceID }) {
        const registry = this.ensureRuntimeNodeRegistry();
        const reasonDescription = recordID ? `record:${recordID}` : nodeInstanceID ? `instance:${nodeInstanceID}` : 'unknown';
        const removeByInstanceID = (instanceID) => {
            if (!instanceID) {
                return;
            }
            const existing = registry[instanceID];
            if (!existing) {
                return;
            }
            if (!recordID || existing.__resolvedFromRecordID === recordID) {
                delete registry[instanceID];
            }
        };
        if (nodeInstanceID) {
            removeByInstanceID(nodeInstanceID);
            return;
        }
        if (recordID) {
            Object.keys(registry).forEach(instanceID => {
                const entry = registry[instanceID];
                if (entry && entry.__resolvedFromRecordID === recordID) {
                    delete registry[instanceID];
                }
            });
        }
    }

    registerRuntimeNodeFromRecord(record) {
        if (!this.shouldKeepRuntimeNode(record)) {
            this.removeRuntimeNodeByRecord({ recordID: record?.recordID, nodeInstanceID: record?.nodeInstanceID });
            return;
        }
        const definition = record?.context?.resolvedNodeDefinition;
        if (!definition || !definition.instanceID) {
            return;
        }
        const clone = JSON.parse(JSON.stringify(definition));
        clone.__resolvedFromRecordID = record.recordID;
        this.registerRuntimeNodeDescription(clone);
        this.ensureNodeInstance(record.nodeInstanceID, { definition: clone, record });
    }

    rebuildRuntimeNodeRegistryFromRecords(records) {
        const registry = this.ensureRuntimeNodeRegistry();
        Object.keys(registry).forEach(key => {
            delete registry[key];
        });
        if (!Array.isArray(records)) {
            return;
        }
        records.forEach(record => this.registerRuntimeNodeFromRecord(record));
    }

    updateRuntimeNodeRegistryAfterRecordChanges({ newRecords = [], updatedRecords = [], deletedRecordIDs = [], records = [], fullReload = false } = {}) {
        if (fullReload) {
            this.rebuildRuntimeNodeRegistryFromRecords(records);
            return;
        }
        newRecords.forEach(record => this.registerRuntimeNodeFromRecord(record));
        updatedRecords.forEach(record => this.registerRuntimeNodeFromRecord(record));
        deletedRecordIDs.forEach(recordID => {
            this.removeRuntimeNodeByRecord({ recordID });
        });
    }

    getComponentDefinitionForInstance(instanceID) {
        if (!instanceID) {
            return null;
        }
        if (this.componentInstances.has(instanceID)) {
            return this.componentInstances.get(instanceID);
        }
        const nodes = this.versionInfo?.stateMachineDescription?.nodes || [];
        const node = nodes.find(entry => entry.instanceID === instanceID);
        if (!node || node.nodeType !== "customComponent") {
            return null;
        }
        const definition = this.customComponentRegistry?.resolve(node?.params?.componentID);
        if (definition) {
            this.componentInstances.set(instanceID, definition);
        }
        return definition || null;
    }

    async executeCustomComponentNode({
        nodeInstance,
        definition,
        record,
        inputs,
        channel,
        debuggingTurnedOn,
        seed,
        wasCancelled,
        keySource,
    }) {
        if (this.recordHistory && typeof this.recordHistory.load === "function") {
            try {
                const historyLoad = await this.recordHistory.load({ incremental: false });
                if (historyLoad) {
                    this.processRecordHistoryLoadResult(historyLoad);
                }
            } catch (error) {
                console.error("[CustomComponent] Failed to refresh record history before execution", error);
            }
        }

        if (!definition || !Array.isArray(definition.nodes)) {
            throw new Error("Custom Component definition is missing nodes.");
        }

        const componentName = definition.name || nodeInstance?.fullNodeDescription?.instanceName || "Custom Component";
        const componentID = definition.componentID || nodeInstance?.fullNodeDescription?.params?.componentID;

        const componentInstanceSegment =
            nodeInstance?.fullNodeDescription?.originalInstanceID
            || nodeInstance?.fullNodeDescription?.instanceID
            || componentID
            || `component-${Date.now()}`;

        let parentPathSegments = Array.isArray(record?.context?.componentPathSegments)
            ? [...record.context.componentPathSegments]
            : [];
        if (parentPathSegments.length > 0) {
            const lastSegment = parentPathSegments[parentPathSegments.length - 1];
            if (lastSegment === componentInstanceSegment) {
                parentPathSegments = parentPathSegments.slice(0, -1);
            }
        }
        const componentPathSegments = [
            ...parentPathSegments,
            `${componentInstanceSegment}`,
        ];

        let parentNamePath = Array.isArray(record?.context?.componentNamePath)
            ? [...record.context.componentNamePath]
            : [];
        if (parentNamePath.length > 0) {
            const lastName = parentNamePath[parentNamePath.length - 1];
            if (lastName === componentName) {
                parentNamePath = parentNamePath.slice(0, -1);
            }
        }
        const componentNamePath = [
            ...parentNamePath,
            componentName,
        ];

        this.logActivity(`[CustomComponent] Executing ${componentName} (${componentID || "unknown"})`);
        const breadcrumbBase = Array.isArray(record?.componentBreadcrumb)
            ? [...record.componentBreadcrumb]
            : [];
        if (componentID) {
            if (breadcrumbBase[breadcrumbBase.length - 1] !== componentID) {
                breadcrumbBase.push(componentID);
            }
        }
        const breadcrumb = breadcrumbBase.filter(Boolean);

        const componentContext = {
            customComponent: {
                componentID,
                instanceID: `${componentInstanceSegment}`,
                name: componentName,
                version: definition?.version || null,
                placeholder: false,
                path: componentPathSegments,
                namePath: componentNamePath,
            },
            componentBreadcrumb: breadcrumb,
            componentPathSegments,
            componentNamePath,
        };

        const componentInputsByHandle = new Map();
        (inputs || []).forEach(input => {
            const eventHandles = Array.isArray(input?.events) ? input.events : [];
            if (input?.values) {
                Object.entries(input.values).forEach(([handle, value]) => {
                    const entry = componentInputsByHandle.get(handle) || { value: undefined, events: [] };
                    entry.value = value;
                    eventHandles.forEach(eventName => {
                        if (!entry.events.includes(eventName)) {
                            entry.events.push(eventName);
                        }
                    });
                    componentInputsByHandle.set(handle, entry);
                });
            }
            eventHandles.forEach(eventName => {
                if (!componentInputsByHandle.has(eventName)) {
                    componentInputsByHandle.set(eventName, { value: undefined, events: [eventName] });
                }
            });
        });
        const componentHandlesDebug = Array.from(componentInputsByHandle.entries()).map(([handle, info]) => ({ handle, events: info?.events, hasValue: typeof info?.value !== "undefined", sourceRuntimeID: info?.sourceRuntimeID }));
        this.logActivity(`[CustomComponentDebug] ${componentName} component handles initialized: ${JSON.stringify(componentHandlesDebug)}`);
        console.error("[CustomComponent] Component input handles initialized", {
            component: componentName,
            handles: componentHandlesDebug,
        });

        const runtimeIdMap = new Map();
        const runtimeNodes = definition.nodes.map(originalNode => {
            const cloned = JSON.parse(JSON.stringify(originalNode));
            const originalInstanceID = cloned.instanceID;
            const runtimeInstanceSegments = [
                ...componentPathSegments,
                `${originalInstanceID}`,
            ];
            const runtimeInstanceID = runtimeInstanceSegments.join('-');
            runtimeIdMap.set(originalInstanceID, runtimeInstanceID);
            cloned.originalInstanceID = originalInstanceID;
            cloned.instanceID = runtimeInstanceID;
            cloned.componentPathSegments = runtimeInstanceSegments;
            cloned.componentNamePath = componentNamePath;
            const baseNodeLabel = cloned.instanceName || this.formatNodeTypeForLog(cloned.nodeType);
            cloned.instanceName = [...componentNamePath, baseNodeLabel].join(' - ');
            cloned.inputs = Array.isArray(cloned.inputs) ? cloned.inputs : [];
            cloned.inputs = cloned.inputs
                .map(input => {
                    const clonedInput = JSON.parse(JSON.stringify(input));
                    if (runtimeIdMap.has(clonedInput.producerInstanceID)) {
                        clonedInput.producerInstanceID = runtimeIdMap.get(clonedInput.producerInstanceID);
                        return clonedInput;
                    }
                    return null;
                })
                .filter(Boolean);
            return cloned;
        });

        const runtimeNodeMap = new Map();
        runtimeNodes.forEach(nodeDescription => runtimeNodeMap.set(nodeDescription.instanceID, nodeDescription));

        const nodeParams = nodeInstance?.fullNodeDescription?.params || {};
        const inputBindings = nodeParams.inputBindings || {};
        const eventBindings = nodeParams.eventBindings || {};

        if (Array.isArray(definition.exposedInputs)) {
            console.error("[CustomComponent] Exposed inputs", {
                component: componentName,
                inputs: definition.exposedInputs,
            });
        } else {
            console.error("[CustomComponent] No exposed inputs on component", {
                component: componentName,
            });
        }

        const componentInputEntries = new Map();
        if (Array.isArray(definition.exposedInputs)) {
            for (const port of definition.exposedInputs) {
                if (!port?.handle) {
                    continue;
                }
                const runtimeID = runtimeIdMap.get(port.nodeInstanceID);
                const entry = componentInputsByHandle.get(port.handle) || { value: undefined, events: [] };
                if (runtimeID) {
                    entry.sourceRuntimeID = runtimeID;
                    this.logActivity(`[CustomComponentDebug] ${componentName} mapped handle ${port.handle} to runtime node ${runtimeID}`);
                    try {
                        const latestRecord = await getMostRecentRecordOfInstance(this.db, this.session.sessionID, runtimeID);
                        if (latestRecord && !latestRecord.deleted) {
                            const emittedEvents = Array.isArray(latestRecord.eventsEmitted) ? latestRecord.eventsEmitted : [];
                            if (emittedEvents.length) {
                                entry.events = Array.from(new Set([...(entry.events || []), ...emittedEvents]));
                            }
                            if (nullUndefinedOrEmpty(entry.value)) {
                                const candidateValue = latestRecord.output?.text?.text
                                    ?? latestRecord.output?.text
                                    ?? latestRecord.output?.result?.text;
                                if (!nullUndefinedOrEmpty(candidateValue)) {
                                    entry.value = candidateValue;
                                }
                            }
                            this.logActivity(`[CustomComponentDebug] ${componentName} primed handle ${port.handle} events=${JSON.stringify(entry.events)} valuePresent=${typeof entry.value !== 'undefined'}`);
                        }
                    } catch (error) {
                        console.error("[CustomComponent] Failed to prime exposed input handle", {
                            component: componentName,
                            handle: port.handle,
                            runtimeID,
                            error: error.message,
                        });
                    }
                }
                componentInputsByHandle.set(port.handle, entry);
            }
        }
        const ensureComponentInputEntry = (targetNode, handle) => {
            const key = `${targetNode.instanceID}:${handle}`;
            const handleEntry = componentInputsByHandle.get(handle) || { value: undefined, events: [] };
            handleEntry.sourceRuntimeID = targetNode.instanceID;
            componentInputsByHandle.set(handle, handleEntry);
            if (componentInputEntries.has(key)) {
                return componentInputEntries.get(key);
            }
            const entry = {
                producerInstanceID: `${COMPONENT_INPUT_PREFIX}:${handle}`,
                includeHistory: false,
                historyParams: {},
                variables: [],
                triggers: [],
            };
            targetNode.inputs.push(entry);
            componentInputEntries.set(key, entry);
            return entry;
        };

        Object.entries(inputBindings).forEach(([handle, binding]) => {
            const targetRuntimeID = runtimeIdMap.get(binding.nodeInstanceID);
            if (!targetRuntimeID) {
                return;
            }
            const targetNode = runtimeNodeMap.get(targetRuntimeID);
            if (!targetNode) {
                return;
            }
            const entry = ensureComponentInputEntry(targetNode, handle);
            entry.variables = entry.variables || [];
            if (!entry.variables.find(variable => variable.consumerVariable === binding.portName && variable.producerOutput === handle)) {
                entry.variables.push({
                    producerOutput: handle,
                    consumerVariable: binding.portName,
                });
            }
        });

        Object.entries(eventBindings).forEach(([handle, binding]) => {
            const targetRuntimeID = runtimeIdMap.get(binding.nodeInstanceID);
            if (!targetRuntimeID) {
                return;
            }
            const targetNode = runtimeNodeMap.get(targetRuntimeID);
            if (!targetNode) {
                return;
            }
            const entry = ensureComponentInputEntry(targetNode, handle);
            entry.triggers = entry.triggers || [];
            if (!entry.triggers.find(trigger => trigger.targetTrigger === binding.portName && trigger.producerEvent === handle)) {
                entry.triggers.push({
                    producerEvent: handle,
                    targetTrigger: binding.portName,
                });
            }
        });

        if (!this.versionInfo.stateMachineDescription) {
            this.versionInfo.stateMachineDescription = {};
        }
        if (!Array.isArray(this.versionInfo.stateMachineDescription.nodes)) {
            this.versionInfo.stateMachineDescription.nodes = [];
        }
        const versionNodes = this.versionInfo.stateMachineDescription.nodes;
        const runtimeNodeIDs = new Set();
        const runtimeNodeInstances = new Map();
        runtimeNodes.forEach(nodeDescription => {
            runtimeNodeIDs.add(nodeDescription.instanceID);
            if (Array.isArray(versionNodes)) {
                const existingIndex = versionNodes.findIndex(node => node.instanceID === nodeDescription.instanceID);
                if (existingIndex >= 0) {
                    versionNodes[existingIndex] = nodeDescription;
                } else {
                    versionNodes.push(nodeDescription);
                }
            }
            const NodeClass = nodeTypeLookupTable[nodeDescription.nodeType];
            if (!NodeClass) {
                throw new Error(`Custom Component "${componentName}" references unknown node type ${nodeDescription.nodeType}.`);
            }
            let nodeInstanceForComponent = this.nodeInstances[nodeDescription.instanceID];
            if (!nodeInstanceForComponent) {
                nodeInstanceForComponent = new NodeClass({
                    db: this.db,
                    session: this.session,
                    fullNodeDescription: nodeDescription,
                    componentRegistry: this.customComponentRegistry,
                });
            } else if (typeof nodeInstanceForComponent.updateFullNodeDescription === "function") {
                try {
                    nodeInstanceForComponent.updateFullNodeDescription(nodeDescription);
                } catch (error) {
                    console.error("[StateMachine] Failed to update runtime node description", {
                        instanceID: nodeDescription.instanceID,
                        nodeType: nodeDescription.nodeType,
                        error: error.message,
                    });
                }
            }
            nodeInstanceForComponent.fullNodeDescription = nodeDescription;
            runtimeNodeInstances.set(nodeDescription.instanceID, nodeInstanceForComponent);
            this.registerRuntimeNodeDescription(nodeDescription, nodeInstanceForComponent);
        });

        const componentInputRecords = new Map();
        const componentInputKeyPrefix = componentPathSegments.join('-');
        const getComponentInputRecord = (handle) => {
            if (componentInputRecords.has(handle)) {
                return componentInputRecords.get(handle);
            }
            const data = componentInputsByHandle.get(handle) || {};
            const recordInput = {
                producerInstanceID: `${COMPONENT_INPUT_PREFIX}:${handle}`,
                recordID: `component-input:${componentInputKeyPrefix}:${handle}`,
                values: { [handle]: data.value },
                events: Array.isArray(data.events) ? [...data.events] : [],
            };
            this.logActivity(`[CustomComponentDebug] ${componentName} creating component record for handle ${handle} events=${JSON.stringify(recordInput.events)} valuePresent=${typeof data.value !== 'undefined'}`);
            componentInputRecords.set(handle, recordInput);
            return recordInput;
        };

        const producedRecords = new Map();
        const componentOutput = nodeInstance.buildEmptyOutputPayload
            ? nodeInstance.buildEmptyOutputPayload(definition)
            : {};
        const componentEvents = new Set();

        const nodeStatus = new Map();
        runtimeNodes.forEach(nodeDescription => nodeStatus.set(nodeDescription.instanceID, "pending"));
        const nodeBlockers = new Map();

        const historicalRecords = Array.isArray(this.recordHistory?.records) ? this.recordHistory.records : [];
        const historicalByNodeInstance = new Map();
        if (historicalRecords.length > 0) {
        historicalRecords.forEach(record => {
            if (!record || record.deleted) {
                this.logActivity(`[CustomComponentDebug] ${componentName} skipping historical record (deleted/null) for ${record?.nodeInstanceID}`);
                console.error("[CustomComponent] Skipping historical record (deleted or null)", {
                    component: componentName,
                    nodeInstance: record?.nodeInstanceID,
                    deleted: record?.deleted,
                });
                return;
            }
            const runtimeInstanceID = record.nodeInstanceID;
            if (!runtimeNodeIDs.has(runtimeInstanceID)) {
                this.logActivity(`[CustomComponentDebug] ${componentName} skipping historical record ${runtimeInstanceID} (not part of runtime set)`);
                console.error("[CustomComponent] Skipping historical record (not part of runtime set)", {
                    component: componentName,
                    nodeInstance: runtimeInstanceID,
                });
                return;
            }
            const recordState = record.state;
            if (recordState !== "completed" && recordState !== "waitingForExternalInput" && recordState !== "pending") {
                this.logActivity(`[CustomComponentDebug] ${componentName} skipping historical record ${runtimeInstanceID} (state ${recordState})`);
                console.error("[CustomComponent] Skipping historical record (unsupported state)", {
                    component: componentName,
                    nodeInstance: runtimeInstanceID,
                    state: recordState,
                });
                return;
            }
            const recordComponentPath = Array.isArray(record?.context?.componentPathSegments)
                ? record.context.componentPathSegments.join('-')
                : null;
            const expectedPath = componentPathSegments.join('-');
            if (recordComponentPath && recordComponentPath !== expectedPath) {
                this.logActivity(`[CustomComponentDebug] ${componentName} skipping historical record ${runtimeInstanceID} (path mismatch ${recordComponentPath} !== ${expectedPath})`);
                console.error("[CustomComponent] Skipping historical record (component path mismatch)", {
                    component: componentName,
                    nodeInstance: runtimeInstanceID,
                    recordPath: recordComponentPath,
                    expectedPath,
                });
                return;
            }
                const existing = historicalByNodeInstance.get(runtimeInstanceID);
                const existingTime = existing?.completionTime ? new Date(existing.completionTime).getTime() : -Infinity;
                const candidateTime = record?.completionTime ? new Date(record.completionTime).getTime() : Date.now();
                if (!existing || candidateTime >= existingTime) {
                    historicalByNodeInstance.set(runtimeInstanceID, record);
                }
            });
        }

        for (const runtimeInstanceID of runtimeNodeIDs) {
            if (historicalByNodeInstance.has(runtimeInstanceID)) {
                continue;
            }
            try {
                const latestRecord = await getMostRecentRecordOfInstance(this.db, this.session.sessionID, runtimeInstanceID);
                if (latestRecord && !latestRecord.deleted) {
                    this.logActivity(`[CustomComponentDebug] ${componentName} fetched latest record for ${runtimeInstanceID} events=${JSON.stringify(latestRecord.eventsEmitted)}`);
                    historicalByNodeInstance.set(runtimeInstanceID, latestRecord);
                }
            } catch (error) {
                console.error("[CustomComponent] Failed to fetch latest record for runtime node", {
                    component: componentName,
                    runtimeInstanceID,
                    error: error.message,
                });
            }
        }

        historicalByNodeInstance.forEach((historicalRecord, runtimeInstanceID) => {
            if (!historicalRecord) {
                return;
            }
            this.logActivity(`[CustomComponentDebug] ${componentName} preloading record for ${runtimeInstanceID} events=${JSON.stringify(historicalRecord.eventsEmitted)}`);
            console.error("[CustomComponent] Preloading runtime record", {
                component: componentName,
                runtimeInstanceID,
                state: historicalRecord.state,
                eventsEmitted: historicalRecord.eventsEmitted,
                componentPath: historicalRecord?.context?.componentPathSegments,
            });
            producedRecords.set(runtimeInstanceID, historicalRecord);
            const state = historicalRecord.state;
            if (state === "completed") {
                nodeStatus.set(runtimeInstanceID, "completed");
            } else {
                nodeStatus.set(runtimeInstanceID, "pending");
            }
            const nodeDescription = runtimeNodeMap.get(runtimeInstanceID);
            if (nodeDescription) {
                const finalRecord = historicalRecord;
                const exposedOutputPorts = Array.isArray(definition.exposedOutputs) ? definition.exposedOutputs : [];
                const exposedEventPorts = Array.isArray(definition.exposedEvents) ? definition.exposedEvents : [];
                exposedOutputPorts.forEach(port => {
                    if ((port.annotations?.direction || "output") !== "output") {
                        return;
                    }
                    const runtimeTargetID = runtimeIdMap.get(port.nodeInstanceID);
                    if (runtimeTargetID === nodeDescription.instanceID) {
                        const value = finalRecord.output?.[port.portName];
                        if (typeof value !== "undefined") {
                            componentOutput[port.handle] = value;
                        }
                    }
                });
                exposedEventPorts.forEach(port => {
                    if ((port.annotations?.direction || "output") !== "output") {
                        return;
                    }
                    const runtimeTargetID = runtimeIdMap.get(port.nodeInstanceID);
                    if (runtimeTargetID === nodeDescription.instanceID) {
                        const eventsEmitted = Array.isArray(finalRecord.eventsEmitted) ? finalRecord.eventsEmitted : [];
                        if (eventsEmitted.includes(port.portName)) {
                            componentEvents.add(port.handle || port.portName);
                        }
                    }
                });
                componentInputsByHandle.forEach((entry, handle) => {
                    if (!entry || entry.sourceRuntimeID !== runtimeInstanceID) {
                        return;
                    }
                    if (Array.isArray(finalRecord.eventsEmitted) && finalRecord.eventsEmitted.length > 0) {
                        const existingEvents = Array.isArray(entry.events) ? entry.events : [];
                        entry.events = Array.from(new Set([...existingEvents, ...finalRecord.eventsEmitted]));
                    }
                    if (nullUndefinedOrEmpty(entry.value)) {
                        const candidateValue = finalRecord.output?.text?.text ?? finalRecord.output?.text ?? finalRecord.output?.result?.text;
                        if (!nullUndefinedOrEmpty(candidateValue)) {
                            entry.value = candidateValue;
                        }
                    }
                    componentInputsByHandle.set(handle, entry);
                    if (componentInputRecords.has(handle)) {
                        const recordInput = componentInputRecords.get(handle);
                        recordInput.values = { [handle]: entry.value };
                        recordInput.events = Array.isArray(entry.events) ? [...entry.events] : [];
                        componentInputRecords.set(handle, recordInput);
                    }
                    this.logActivity(`[CustomComponentDebug] ${componentName} merged handle ${handle} events=${JSON.stringify(entry.events)} valuePresent=${typeof entry.value !== 'undefined'}`);
                    console.error("[CustomComponent] Merged component handle", {
                        component: componentName,
                        handle,
                        events: entry.events,
                        valuePresent: typeof entry.value !== 'undefined',
                        runtimeInstanceID,
                    });
                });
            }
            const mergedSummary = Array.from(componentInputsByHandle.entries()).map(([handle, info]) => ({ handle, events: info?.events, hasValue: typeof info?.value !== 'undefined', sourceRuntimeID: info?.sourceRuntimeID }));
            this.logActivity(`[CustomComponentDebug] ${componentName} handle state after merge: ${JSON.stringify(mergedSummary)}`);
        });

        const getProducerRecord = (producerID) => producedRecords.get(producerID);

        const normalizeEventName = (eventName) => {
            if (typeof eventName !== 'string') {
                return eventName;
            }
            return eventName.startsWith('on_') ? eventName.slice(3) : eventName;
        };

        const matchRequiredEvents = (requiredEvents, availableEvents) => {
            if (!Array.isArray(requiredEvents) || requiredEvents.length === 0) {
                return [];
            }
            const matches = [];
            for (const required of requiredEvents) {
                const normalizedRequired = normalizeEventName(required);
                const match = availableEvents.find((event) => normalizeEventName(event) === normalizedRequired);
                if (!match) {
                    this.logActivity(`[CustomComponentDebug] ${componentName} event match failed: required=${required} available=${JSON.stringify(availableEvents)}`);
                    console.error("[CustomComponent] Event match failed", {
                        component: componentName,
                        required,
                        availableEvents,
                    });
                    return null;
                }
                matches.push(match);
            }
            this.logActivity(`[CustomComponentDebug] ${componentName} matched required events ${JSON.stringify(requiredEvents)} -> ${JSON.stringify(matches)}`);
            console.error("[CustomComponent] Events matched", {
                component: componentName,
                requiredEvents,
                matches,
            });
            return matches;
        };

        const buildRunInputsForNode = (nodeDescription) => {
            const runInputs = [];
            const inputsArray = Array.isArray(nodeDescription.inputs) ? nodeDescription.inputs : [];
            const requiresAllEvents = Boolean(nodeDescription?.requireAllEventTriggers || nodeDescription?.requireAllInputs);
            this.logActivity(`[CustomComponentDebug] ${componentName} building inputs for ${this.formatNodeLabel(nodeDescription)} requiresAllEvents=${requiresAllEvents}`);
            console.error("[CustomComponent] Building inputs for node", {
                component: componentName,
                nodeInstanceID: nodeDescription.instanceID,
                nodeLabel: this.formatNodeLabel(nodeDescription),
                requiresAllEvents,
                inputCount: inputsArray.length,
            });
            for (let i = 0; i < inputsArray.length; i++) {
                const inputEntry = inputsArray[i];
                const isComponentInput = inputEntry.producerInstanceID.startsWith(`${COMPONENT_INPUT_PREFIX}:`);
                const recordInput = {
                    producerInstanceID: inputEntry.producerInstanceID,
                    recordID: null,
                    includeHistory: inputEntry.includeHistory || false,
                    historyParams: inputEntry.historyParams || {},
                    values: {},
                    events: [],
                };

                if (isComponentInput) {
                    const handle = inputEntry.producerInstanceID.slice(COMPONENT_INPUT_PREFIX.length + 1);
                    const componentRecord = getComponentInputRecord(handle);
                    recordInput.recordID = componentRecord.recordID;
                    const data = componentInputsByHandle.get(handle) || {};
                    const availableEvents = componentRecord.events || [];
                    const requiredTriggers = Array.isArray(inputEntry.triggers) ? inputEntry.triggers : [];
                    console.error("[CustomComponent] Evaluating component input handle", {
                        component: componentName,
                        nodeInstanceID: nodeDescription.instanceID,
                        nodeLabel: this.formatNodeLabel(nodeDescription),
                        handle,
                        availableEvents,
                        requiredTriggerCount: requiredTriggers.length,
                        requiresAllEvents,
                    });

                    if (requiredTriggers.length > 0) {
                        const requiredEvents = requiredTriggers.map(trigger => trigger.producerEvent);
                        let matchingEvents = matchRequiredEvents(requiredEvents, availableEvents);
                        if (!matchingEvents && requiresAllEvents) {
                            const sourceRuntimeID = data?.sourceRuntimeID;
                            if (sourceRuntimeID && sourceRuntimeID === nodeDescription.instanceID) {
                                matchingEvents = requiredEvents;
                            } else {
                                return {
                                    ready: false,
                                    reason: {
                                        category: "componentInput",
                                        reason: "missingEvents",
                                        handle,
                                        requiredEvents,
                                        availableEvents,
                                    },
                                };
                            }
                        }
                        if (matchingEvents) {
                            recordInput.events = matchingEvents;
                        }
                    }

                    if (Array.isArray(inputEntry.variables) && inputEntry.variables.length > 0) {
                        inputEntry.variables.forEach(variable => {
                            recordInput.values[variable.consumerVariable] = data.value;
                            console.error("[CustomComponent] Component input variable bound", {
                                component: componentName,
                                nodeInstanceID: nodeDescription.instanceID,
                                handle,
                                consumerVariable: variable.consumerVariable,
                                hasValue: typeof data.value !== "undefined",
                            });
                            this.logActivity(`[CustomComponentDebug] ${componentName} component handle ${handle} bound variable ${variable.consumerVariable} valuePresent=${typeof data.value !== "undefined"}`);
                        });
                    }

                    runInputs.push(recordInput);
                    this.logActivity(`[CustomComponentDebug] ${componentName} component input ready: handle=${handle} events=${JSON.stringify(recordInput.events)} values=${JSON.stringify(Object.keys(recordInput.values || {}))}`);
                    console.error("[CustomComponent] Component input ready", {
                        component: componentName,
                        nodeInstanceID: nodeDescription.instanceID,
                        handle,
                        events: recordInput.events,
                        values: recordInput.values,
                    });
                    continue;
                }

                const producerRecord = getProducerRecord(inputEntry.producerInstanceID);
                if (!producerRecord) {
                    console.error("[CustomComponent] Producer record not ready", {
                        component: componentName,
                        nodeInstanceID: nodeDescription.instanceID,
                        nodeLabel: this.formatNodeLabel(nodeDescription),
                        producerInstanceID: inputEntry.producerInstanceID,
                    });
                    this.logActivity(`[CustomComponentDebug] ${componentName} producer ${inputEntry.producerInstanceID} not ready for ${this.formatNodeLabel(nodeDescription)}`);
                    return {
                        ready: false,
                        reason: {
                            category: "internalDependency",
                            reason: "producerNotReady",
                            producerInstanceID: inputEntry.producerInstanceID,
                        },
                    };
                }
                recordInput.recordID = producerRecord.recordID;

                const producerEvents = Array.isArray(producerRecord.eventsEmitted) ? producerRecord.eventsEmitted : [];
                const requiredTriggers = Array.isArray(inputEntry.triggers) ? inputEntry.triggers : [];
                const currentHandleState = Array.from(componentInputsByHandle.entries()).map(([handle, info]) => ({ handle, events: info?.events, hasValue: typeof info?.value !== 'undefined', sourceRuntimeID: info?.sourceRuntimeID }));
                this.logActivity(`[CustomComponentDebug] ${componentName} evaluating producer ${this.formatNodeLabelByInstanceID(inputEntry.producerInstanceID) || inputEntry.producerInstanceID} with events=${JSON.stringify(producerEvents)} handleState=${JSON.stringify(currentHandleState)}`);
                console.error("[CustomComponent] Evaluating producer events", {
                    component: componentName,
                    nodeInstanceID: nodeDescription.instanceID,
                    nodeLabel: this.formatNodeLabel(nodeDescription),
                    producerInstanceID: inputEntry.producerInstanceID,
                    producerLabel: this.formatNodeLabelByInstanceID(inputEntry.producerInstanceID),
                    producerEvents,
                    requiredTriggerCount: requiredTriggers.length,
                    requiresAllEvents,
                });
                if (requiredTriggers.length > 0) {
                    const requiredEvents = requiredTriggers.map(trigger => trigger.producerEvent);
                    const matchingEvents = matchRequiredEvents(requiredEvents, producerEvents);
                    if (!matchingEvents && requiresAllEvents) {
                        console.error("[CustomComponent] Internal dependency missing events", {
                            component: componentName,
                            nodeInstanceID: nodeDescription.instanceID,
                            nodeLabel: this.formatNodeLabel(nodeDescription),
                            producerInstanceID: inputEntry.producerInstanceID,
                            requiredEvents,
                            availableEvents: producerEvents,
                        });
                        this.logActivity(`[CustomComponentDebug] ${componentName} missing producer events for ${this.formatNodeLabel(nodeDescription)} required=${JSON.stringify(requiredEvents)} available=${JSON.stringify(producerEvents)}`);
                        return {
                            ready: false,
                            reason: {
                                category: "internalDependency",
                                reason: "missingEvents",
                                producerInstanceID: inputEntry.producerInstanceID,
                                requiredEvents,
                                availableEvents: producerEvents,
                            },
                        };
                    }
                    if (matchingEvents) {
                        recordInput.events = matchingEvents;
                        console.error("[CustomComponent] Internal dependency events satisfied", {
                            component: componentName,
                            nodeInstanceID: nodeDescription.instanceID,
                            producerInstanceID: inputEntry.producerInstanceID,
                            events: matchingEvents,
                        });
                        this.logActivity(`[CustomComponentDebug] ${componentName} producer ${inputEntry.producerInstanceID} matched events ${JSON.stringify(matchingEvents)}`);
                    }
                }

                if (Array.isArray(inputEntry.variables) && inputEntry.variables.length > 0) {
                    inputEntry.variables.forEach(variable => {
                        recordInput.values[variable.consumerVariable] = producerRecord.output?.[variable.producerOutput];
                        console.error("[CustomComponent] Internal dependency variable bound", {
                            component: componentName,
                            nodeInstanceID: nodeDescription.instanceID,
                            producerInstanceID: inputEntry.producerInstanceID,
                            consumerVariable: variable.consumerVariable,
                            producerOutput: variable.producerOutput,
                            hasValue: typeof producerRecord.output?.[variable.producerOutput] !== "undefined",
                        });
                        this.logActivity(`[CustomComponentDebug] ${componentName} producer ${inputEntry.producerInstanceID} bound variable ${variable.consumerVariable} valuePresent=${typeof producerRecord.output?.[variable.producerOutput] !== "undefined"}`);
                    });
                }

                runInputs.push(recordInput);
                    this.logActivity(`[CustomComponentDebug] ${componentName} internal input ready: producer=${inputEntry.producerInstanceID} events=${JSON.stringify(recordInput.events)} values=${JSON.stringify(Object.keys(recordInput.values || {}))}`);
                    console.error("[CustomComponent] Internal dependency ready", {
                        component: componentName,
                        nodeInstanceID: nodeDescription.instanceID,
                        nodeLabel: this.formatNodeLabel(nodeDescription),
                        producerInstanceID: inputEntry.producerInstanceID,
                        producerLabel: this.formatNodeLabelByInstanceID(inputEntry.producerInstanceID),
                        events: recordInput.events,
                        values: recordInput.values,
                    });
            }
            this.logActivity(`[CustomComponentDebug] ${componentName} built ${runInputs.length} inputs for ${this.formatNodeLabel(nodeDescription)}`);
            console.error("[CustomComponent] Build inputs result", {
                component: componentName,
                nodeInstanceID: nodeDescription.instanceID,
                nodeLabel: this.formatNodeLabel(nodeDescription),
                inputSummary: runInputs.map(entry => ({
                    producerInstanceID: entry.producerInstanceID,
                    events: entry.events,
                    values: entry.values,
                })),
            });
            return {
                ready: true,
                inputs: runInputs,
            };
        };

        const wasCancelledFn = typeof wasCancelled === "function" ? wasCancelled : null;
        const checkCancellation = () => (wasCancelledFn ? wasCancelledFn() : null);
        const ensureNotCancelled = () => {
            const haltReason = checkCancellation();
            if (haltReason) {
                throw new Error(haltReason);
            }
        };

        const executeNode = async (nodeDescription, nodeInstanceForComponent) => {
            const runInputsResult = buildRunInputsForNode(nodeDescription);
            if (!runInputsResult?.ready) {
                if (runInputsResult?.reason) {
                    const reason = { ...runInputsResult.reason };
                    if (!reason.nodeInstanceID) {
                        reason.nodeInstanceID = nodeDescription.instanceID;
                    }
                    if (Array.isArray(reason.requiredEvents) && Array.isArray(reason.availableEvents)) {
                        reason.missingEvents = reason.requiredEvents.filter(event => !(reason.availableEvents || []).includes(event));
                    }
                    const reasonDetails = [];
                    if (Array.isArray(reason.missingEvents) && reason.missingEvents.length > 0) {
                        reasonDetails.push(`missing events: ${reason.missingEvents.join(', ')}`);
                    }
                    if (Array.isArray(reason.requiredEvents) && reason.requiredEvents.length > 0 && !reasonDetails.length) {
                        reasonDetails.push(`required events: ${reason.requiredEvents.join(', ')}`);
                    }
                    if (reason.producerInstanceID) {
                        reasonDetails.push(`producer: ${this.formatNodeLabelByInstanceID(reason.producerInstanceID) || reason.producerInstanceID}`);
                    }
                    const reasonSummary = reasonDetails.length > 0 ? reasonDetails.join('; ') : JSON.stringify(reason);
                    this.logActivity(`[CustomComponent] ${componentName} blocker: ${this.formatNodeLabel(nodeDescription)} (${reasonSummary})`);
                    nodeBlockers.set(nodeDescription.instanceID, {
                        node: nodeDescription,
                        reason,
                    });
                } else {
                    this.logActivity(`[CustomComponent] ${componentName} blocker: ${this.formatNodeLabel(nodeDescription)} (unknown reason)`);
                }
                return false;
            }
            nodeBlockers.delete(nodeDescription.instanceID);
            const runInputs = runInputsResult.inputs;
            console.error("[CustomComponent] Node ready for execution", {
                component: componentName,
                nodeInstanceID: nodeDescription.instanceID,
                nodeLabel: this.formatNodeLabel(nodeDescription),
                inputCount: runInputs.length,
                inputs: runInputs.map(entry => ({
                    producerInstanceID: entry.producerInstanceID,
                    recordID: entry.recordID,
                    events: entry.events,
                    values: Object.keys(entry.values || {}),
                })),
            });

            ensureNotCancelled();
            const runInfo = {
                nodeInstance: nodeInstanceForComponent,
                readyTime: new Date(),
                inputs: runInputs,
                componentBreadcrumb: breadcrumb,
            };

            const runtimeRecord = await this.preRunProcessing({
                runInfo,
                channel,
                seed,
                debuggingTurnedOn,
                wasCancelled: checkCancellation,
                onPreNode: () => {},
            });

            if (!runtimeRecord.context || typeof runtimeRecord.context !== "object") {
                runtimeRecord.context = {};
            }
            runtimeRecord.context.customComponent = componentContext.customComponent;
            runtimeRecord.context.componentPathSegments = componentContext.componentPathSegments;
            runtimeRecord.context.componentNamePath = componentContext.componentNamePath;
            const serializedNodeDefinition = JSON.parse(JSON.stringify(nodeInstanceForComponent.fullNodeDescription));
            runtimeRecord.context.resolvedNodeDefinition = serializedNodeDefinition;

            ensureNotCancelled();
            const results = await nodeInstanceForComponent.run({
                inputs: runInputs,
                stateMachine: this,
                channel,
                seed,
                debuggingTurnedOn,
                wasCancelled: checkCancellation,
                record: runtimeRecord,
                keySource,
            });

            if (results && typeof results === "object") {
                const existingContext = (results.context && typeof results.context === "object") ? results.context : {};
                results.context = {
                    ...existingContext,
                    customComponent: componentContext.customComponent,
                    componentPathSegments: componentContext.componentPathSegments,
                    componentNamePath: componentContext.componentNamePath,
                    resolvedNodeDefinition: serializedNodeDefinition,
                };
            }

            await this.postProcessProcessing({
                runInfo,
                results,
                record: runtimeRecord,
                channel,
                seed,
                debuggingTurnedOn,
                wasCancelled: checkCancellation,
                onPostNode: () => {},
            });

            const finalRecord = {
                ...runtimeRecord,
                ...results,
                state: results.state,
            };
            producedRecords.set(nodeDescription.instanceID, finalRecord);
            nodeStatus.set(nodeDescription.instanceID, "completed");
            return true;
        };

        const exposedOutputPorts = Array.isArray(definition.exposedOutputs) ? definition.exposedOutputs : [];
        const exposedEventPorts = Array.isArray(definition.exposedEvents) ? definition.exposedEvents : [];

        let componentResult = null;

        try {
            while (true) {
                ensureNotCancelled();
                nodeBlockers.clear();
                const pendingNodes = runtimeNodes.filter(nodeDescription => nodeStatus.get(nodeDescription.instanceID) === "pending");
                if (pendingNodes.length === 0) {
                    break;
                }

                let progressed = false;
                for (let i = 0; i < pendingNodes.length; i++) {
                    const nodeDescription = pendingNodes[i];
                    const nodeInstanceForComponent = runtimeNodeInstances.get(nodeDescription.instanceID);
                    if (!nodeInstanceForComponent) {
                        throw new Error(`Custom Component "${componentName}" could not instantiate node ${nodeDescription.instanceID}.`);
                    }

                    const ran = await executeNode(nodeDescription, nodeInstanceForComponent);
                    if (ran) {
                        progressed = true;
                        const finalRecord = producedRecords.get(nodeDescription.instanceID);
                        if (finalRecord) {
                            exposedOutputPorts.forEach(port => {
                                if ((port.annotations?.direction || "output") !== "output") {
                                    return;
                                }
                                const runtimeTargetID = runtimeIdMap.get(port.nodeInstanceID);
                                if (runtimeTargetID === nodeDescription.instanceID) {
                                    const value = finalRecord.output?.[port.portName];
                                    if (typeof value !== "undefined") {
                                        componentOutput[port.handle] = value;
                                    }
                                }
                            });

                            exposedEventPorts.forEach(port => {
                                if ((port.annotations?.direction || "output") !== "output") {
                                    return;
                                }
                                const runtimeTargetID = runtimeIdMap.get(port.nodeInstanceID);
                                if (runtimeTargetID === nodeDescription.instanceID) {
                                    const eventsEmitted = Array.isArray(finalRecord.eventsEmitted) ? finalRecord.eventsEmitted : [];
                                    if (eventsEmitted.includes(port.portName)) {
                                        componentEvents.add(port.handle || port.portName);
                                    }
                                }
                            });
                        }
                    }
                }

                if (!progressed) {
                    const blockingEntries = Array.from(nodeBlockers.values());
                    const waitingReasons = [];

                    const waitingOnComponentInput = blockingEntries.some(entry => entry?.reason?.category === "componentInput");
                    if (waitingOnComponentInput) {
                    const componentWaits = blockingEntries
                        .filter(entry => entry?.reason?.category === "componentInput")
                        .map(entry => {
                            const { reason } = entry;
                            const handleEntry = reason?.handle ? componentInputsByHandle.get(reason.handle) : null;
                            return {
                                type: "componentInput",
                                nodeInstanceID: entry.node?.instanceID,
                                nodeLabel: this.formatNodeLabel(entry.node),
                                handle: reason.handle,
                                sourceRuntimeID: handleEntry?.sourceRuntimeID || null,
                                missingEvents: Array.isArray(reason.requiredEvents)
                                    ? reason.requiredEvents.filter(event => !(reason.availableEvents || []).includes(event))
                                    : [],
                                requiredEvents: Array.isArray(reason?.requiredEvents) ? reason.requiredEvents : [],
                            };
                        });
                        waitingReasons.push(...componentWaits);
                        if (componentWaits.length > 0) {
                            this.logActivity(`[CustomComponent] ${componentName} stalled waiting on component input handles: ${componentWaits.map(item => item.handle).join(", ")}`);
                        }
                    }

                    const dependencyWaits = blockingEntries
                        .filter(entry => entry?.reason?.category === "internalDependency")
                        .map(entry => {
                            const { reason } = entry;
                            const missingEvents = Array.isArray(reason?.missingEvents)
                                ? reason.missingEvents
                                : Array.isArray(reason?.requiredEvents)
                                    ? reason.requiredEvents.filter(event => !(reason.availableEvents || []).includes(event))
                                    : [];
                            return {
                                type: "internalDependency",
                                nodeInstanceID: entry.node?.instanceID,
                                nodeLabel: this.formatNodeLabel(entry.node),
                                producerInstanceID: reason?.producerInstanceID,
                                missingEvents,
                                requiredEvents: Array.isArray(reason?.requiredEvents) ? reason.requiredEvents : [],
                                availableEvents: Array.isArray(reason?.availableEvents) ? reason.availableEvents : [],
                            };
                        });
                    if (dependencyWaits.length > 0) {
                        dependencyWaits.forEach(wait => {
                            this.logActivity(`[CustomComponent] ${componentName} dependency waiting: ${wait.nodeLabel || this.formatNodeLabelByInstanceID(wait.nodeInstanceID) || wait.nodeInstanceID} missing events ${wait.missingEvents.join(", ")}`);
                        });
                        waitingReasons.push(...dependencyWaits);
                    }

                    const runtimeWaitingStates = Array.from(producedRecords.entries()).filter(([, record]) => {
                        const state = record?.state;
                        return state === "waitingForExternalInput" || state === "pending";
                    });
                    if (runtimeWaitingStates.length > 0) {
                        const internalWaits = runtimeWaitingStates.map(([instanceID, record]) => ({
                            type: "internalNode",
                            nodeInstanceID: instanceID,
                            nodeLabel: this.formatNodeLabelByInstanceID(instanceID),
                            waitingFor: record?.waitingForInput || record?.waitingFor || null,
                            state: record?.state || null,
                            lastEvents: Array.isArray(record?.eventsEmitted) ? record.eventsEmitted : [],
                        }));
                        waitingReasons.push(...internalWaits);
                        this.logActivity(`[CustomComponent] ${componentName} paused; ${internalWaits.length} internal node${internalWaits.length === 1 ? "" : "s"} waiting for external input.`);
                    }

                    if (waitingReasons.length > 0) {
                        const waitingForSet = new Set();
                        waitingReasons.forEach((reason) => {
                            if (Array.isArray(reason?.waitingFor)) {
                                reason.waitingFor.forEach((entry) => {
                                    if (typeof entry === "string" && entry.trim().length > 0) {
                                        waitingForSet.add(entry);
                                    }
                                });
                            }
                        });
                        const params = nodeInstance?.fullNodeDescription?.params || {};
                        if (waitingForSet.size === 0) {
                            const supportedTypes = Array.isArray(params.supportedTypes) ? params.supportedTypes : [];
                            supportedTypes.forEach((type) => {
                                if (typeof type === "string" && type.trim().length > 0) {
                                    waitingForSet.add(type);
                                }
                            });
                        }
                        if (waitingForSet.size === 0) {
                            const supportedModes = Array.isArray(params.supportedModes) ? params.supportedModes : [];
                            supportedModes.forEach((mode) => {
                                if (mode === "text") {
                                    waitingForSet.add("text");
                                }
                                if (mode === "audio" || mode === "stt") {
                                    waitingForSet.add("audio");
                                }
                            });
                        }
                        const waitingFor = Array.from(waitingForSet);
                        componentResult = {
                            state: "waitingForExternalInput",
                            eventsEmitted: Array.from(componentEvents),
                            output: componentOutput,
                            componentBreadcrumb: breadcrumb,
                            context: {
                                ...componentContext,
                                waitReasons: waitingReasons,
                            },
                            waitingFor: waitingFor.length > 0 ? waitingFor : undefined,
                        };
                        break;
                    }

                    throw new Error(`Custom Component "${componentName}" could not make progress; verify exposed port bindings.`);
                }
            }

            if (!componentResult) {
            componentEvents.add("completed");
            let output = componentOutput;
            if (!output || Object.keys(output).length === 0) {
                const defaultMessage = { text: "Custom component completed." };
                output = {
                    result: defaultMessage,
                    text: defaultMessage,
                };
            }

            const eventsEmitted = Array.from(componentEvents);

            componentResult = {
                state: "completed",
                    eventsEmitted,
                    output,
                    componentBreadcrumb: breadcrumb,
                    context: componentContext,
                };
            }
        } finally {
            const shouldPreserveRuntimeNodes = componentResult?.state === "waitingForExternalInput";
            if (!shouldPreserveRuntimeNodes && Array.isArray(this.versionInfo?.stateMachineDescription?.nodes)) {
                const nodesArray = this.versionInfo.stateMachineDescription.nodes;
                for (let i = nodesArray.length - 1; i >= 0; i--) {
                    if (runtimeNodeIDs.has(nodesArray[i].instanceID)) {
                        nodesArray.splice(i, 1);
                    }
                }
            }
            const runtimeRegistry = this.ensureRuntimeNodeRegistry();
            runtimeNodeIDs.forEach((runtimeInstanceID) => {
                const finalRecord = producedRecords.get(runtimeInstanceID);
                const isWaiting = finalRecord?.state === "waitingForExternalInput" || finalRecord?.state === "pending";
                if (shouldPreserveRuntimeNodes || isWaiting) {
                    return;
                }
                delete this.nodeInstances[runtimeInstanceID];
                if (runtimeRegistry && typeof runtimeRegistry === "object") {
                    delete runtimeRegistry[runtimeInstanceID];
                }
            });
        }

        return componentResult;
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
        const nameSegments = Array.isArray(nodeDescription.componentNamePath)
            ? [...nodeDescription.componentNamePath]
            : [];
        const instanceName = nodeDescription.instanceName || nodeDescription.originalInstanceID || nodeDescription.instanceID;
        if (instanceName) {
            nameSegments.push(instanceName);
        }
        const pathLabel = nameSegments.length > 0 ? nameSegments.join(' > ') : null;
        return pathLabel ? `${typeLabel}: ${pathLabel}` : typeLabel;
    }

    formatNodeLabelByInstanceID(instanceID) {
        const instance = this.nodeInstances?.[instanceID];
        let description = instance?.fullNodeDescription;
        if (!description) {
            const runtimeRegistry = this.ensureRuntimeNodeRegistry();
            if (runtimeRegistry && typeof runtimeRegistry === 'object') {
                description = runtimeRegistry[instanceID];
            }
        }
        return this.formatNodeLabel(description);
    }

    formatWaitReason(reason) {
        if (!reason || typeof reason !== 'object') {
            return null;
        }
        const labelFor = (instanceID, fallbackLabel) => {
            if (fallbackLabel) {
                return fallbackLabel;
            }
            const label = this.formatNodeLabelByInstanceID(instanceID);
            return label && label !== 'UNKNOWN NODE' ? label : instanceID;
        };
        switch (reason.type) {
            case "internalNode": {
                const label = labelFor(reason.nodeInstanceID, reason.nodeLabel);
                const tokens = Array.isArray(reason.waitingFor) && reason.waitingFor.length
                    ? `waiting for ${reason.waitingFor.join(', ')}`
                    : reason.state
                        ? `state ${reason.state}`
                        : 'waiting';
                return `${label} (${tokens})`;
            }
            case "componentInput": {
                const parts = [];
                if (reason.handle) {
                    parts.push(`handle "${reason.handle}"`);
                }
                if (Array.isArray(reason.missingEvents) && reason.missingEvents.length > 0) {
                    parts.push(`missing events: ${reason.missingEvents.join(', ')}`);
                }
                const label = labelFor(reason.nodeInstanceID, reason.nodeLabel);
                return `${label} [component input${parts.length ? ` (${parts.join('; ')})` : ''}]`;
            }
            case "internalDependency": {
                const label = labelFor(reason.nodeInstanceID, reason.nodeLabel);
                const details = [];
                if (Array.isArray(reason.missingEvents) && reason.missingEvents.length > 0) {
                    details.push(`missing events: ${reason.missingEvents.join(', ')}`);
                }
                if (reason.producerInstanceID) {
                    details.push(`from ${labelFor(reason.producerInstanceID)}`);
                }
                return `${label}${details.length ? ` (${details.join('; ')})` : ''}`;
            }
            default:
                return JSON.stringify(reason);
        }
    }

    getRecordTimestamp(record) {
        if (!record) {
            return 0;
        }
        const candidates = [
            record.lastModifiedTime,
            record.completionTime,
            record.executionTime,
            record.startTime,
        ];
        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }
            const dateValue = candidate instanceof Date ? candidate : new Date(candidate);
            if (!Number.isNaN(dateValue.getTime())) {
                return dateValue.getTime();
            }
        }
        return 0;
    }

    hasCustomComponentDependencyUpdate(waitRecord, recordsByNodeInstanceID) {
        if (!waitRecord) {
            return false;
        }
        const waitReasons = Array.isArray(waitRecord?.context?.waitReasons)
            ? waitRecord.context.waitReasons
            : [];
        if (waitReasons.length === 0) {
            return false;
        }
        const waitTimestamp = this.getRecordTimestamp(waitRecord);
        const hasUpdatedRecord = (runtimeID, predicate, reasonMeta) => {
            if (!runtimeID) {
                return false;
            }
            const candidateRecords = recordsByNodeInstanceID?.[runtimeID];
            if (!Array.isArray(candidateRecords) || candidateRecords.length === 0) {
                return false;
            }
            return candidateRecords.some(candidate => {
                if (!candidate || candidate.deleted) {
                    return false;
                }
                const candidateTime = this.getRecordTimestamp(candidate);
                if (candidateTime <= waitTimestamp) {
                    return false;
                }
                const predicateResult = predicate(candidate);
                return predicateResult;
            });
        };

        for (const reason of waitReasons) {
            if (!reason || typeof reason !== 'object') {
                continue;
            }
            if (reason.type === "componentInput") {
                const runtimeID = reason.sourceRuntimeID;
                const requiredEvents = Array.isArray(reason.missingEvents) && reason.missingEvents.length > 0
                    ? reason.missingEvents
                    : Array.isArray(reason.requiredEvents)
                        ? reason.requiredEvents
                        : [];
                if (hasUpdatedRecord(runtimeID, candidate => {
                    const events = Array.isArray(candidate.eventsEmitted) ? candidate.eventsEmitted : [];
                    if (requiredEvents.length === 0) {
                        return candidate.state === "completed";
                    }
                    return requiredEvents.every(eventName => events.includes(eventName));
                }, { reason, type: "componentInput" })) {
                    return true;
                }
            } else if (reason.type === "internalDependency") {
                const runtimeID = reason.producerInstanceID;
                const requiredEvents = Array.isArray(reason.missingEvents) && reason.missingEvents.length > 0
                    ? reason.missingEvents
                    : Array.isArray(reason.requiredEvents)
                        ? reason.requiredEvents
                        : [];
                if (hasUpdatedRecord(runtimeID, candidate => {
                    const events = Array.isArray(candidate.eventsEmitted) ? candidate.eventsEmitted : [];
                    if (requiredEvents.length === 0) {
                        return candidate.state === "completed";
                    }
                    return requiredEvents.every(eventName => events.includes(eventName));
                }, { reason, type: "internalDependency" })) {
                    return true;
                }
            }
        }

        return false;
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
        const waitReasons = Array.isArray(record?.context?.waitReasons)
            ? record.context.waitReasons
                .map(reason => this.formatWaitReason(reason))
                .filter(Boolean)
            : [];
        if (waitReasons.length > 0) {
            return waitReasons.join('; ');
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
            if (Array.isArray(nodes) && nodes.length > 0) {
                this.cachedRecordGraph.nodes = nodes;
            }
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
        this.updateRuntimeNodeRegistryAfterRecordChanges({
            newRecords,
            updatedRecords,
            deletedRecordIDs,
            records,
            fullReload
        });
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
        this.refreshCustomComponentRegistry();
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

        for (let j = 0; j < this.versionInfo.stateMachineDescription.nodes.length; j++) {
            const nodeDescription = this.versionInfo.stateMachineDescription.nodes[j];
            const NodeClass = nodeTypeLookupTable[nodeDescription.nodeType];

            if (NodeClass) {
                const isCustomComponent = nodeDescription.nodeType === "customComponent";
                const componentDefinition = isCustomComponent
                    ? this.customComponentRegistry?.resolve(nodeDescription?.params?.componentID)
                    : null;
                const fullNodeDescription = isCustomComponent
                    ? {
                        ...nodeDescription,
                        resolvedComponentDefinition: componentDefinition,
                        componentRegistry: this.customComponentRegistry,
                    }
                    : nodeDescription;
                const nodeInstance = new NodeClass({
                    db: this.db,
                    session: this.session,
                    fullNodeDescription,
                    componentRegistry: this.customComponentRegistry,
                });
                if (isCustomComponent) {
                    this.componentInstances.set(nodeDescription.instanceID, componentDefinition || null);
                    if (typeof nodeInstance.setComponentRegistry === "function") {
                        nodeInstance.setComponentRegistry(this.customComponentRegistry);
                    }
                    if (typeof nodeInstance.setComponentDefinition === "function") {
                        nodeInstance.setComponentDefinition(componentDefinition || null);
                    }
                }
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

    generateRunInfoForNode({ node, unconsumedInputs, recordsByNodeInstanceID }) {
        const consumerLabel = this.formatNodeLabel(node);

        const waitEntries = this.plan?.waitForUpdateBeforeReattempting;
        if (waitEntries) {
            const pendingEntries = Object.entries(waitEntries).filter(([, record]) =>
                record && record.nodeInstanceID === node.instanceID && record.state === "waitingForExternalInput"
            );
            if (pendingEntries.length > 0) {
                const hasNewInput = Object.values(unconsumedInputs || {}).some((list) => Array.isArray(list) && list.length > 0);
                let resumeDueToInternalUpdate = false;
                if (!hasNewInput && node.nodeType === "customComponent") {
                    resumeDueToInternalUpdate = pendingEntries.some(([, waitRecord]) =>
                        this.hasCustomComponentDependencyUpdate(waitRecord, recordsByNodeInstanceID)
                    );
                    if (resumeDueToInternalUpdate) {
                        this.logPlanning(`${consumerLabel} received updated internal dependency; resuming execution.`);
                    }
                }
                if (!hasNewInput && !resumeDueToInternalUpdate) {
                    this.logPlanning(`${consumerLabel} already waiting on external input; skipping new run.`);
                    return;
                }
                const shouldRequeueExisting = resumeDueToInternalUpdate && !hasNewInput;
                const resumeTime = new Date();
                pendingEntries.forEach(([recordID, waitRecord]) => {
                    delete this.plan.waitForUpdateBeforeReattempting[recordID];
                    this.lastRecordStateLog.delete(recordID);
                    if (shouldRequeueExisting) {
                        const nodeInstance = this.nodeInstances[node.instanceID];
                        const clonedInputs = Array.isArray(waitRecord.inputs)
                            ? waitRecord.inputs.map(input => {
                                if (!input) {
                                    return input;
                                }
                                if (typeof structuredClone === "function") {
                                    try {
                                        return structuredClone(input);
                                    } catch (error) {
                                        // fall through to JSON clone
                                    }
                                }
                                try {
                                    return JSON.parse(JSON.stringify(input));
                                } catch (error) {
                                    return { ...input };
                                }
                            })
                            : [];
                        const runInfo = {
                            nodeInstance,
                            readyTime: resumeTime,
                            inputs: clonedInputs,
                            existingRecord: waitRecord,
                        };
                        if (Array.isArray(waitRecord.componentBreadcrumb) && waitRecord.componentBreadcrumb.length > 0) {
                            runInfo.componentBreadcrumb = [...waitRecord.componentBreadcrumb];
                        }
                        this.applyMessageHistoryToRunInfo(runInfo);
                        this.plan.readyToProcess.push(runInfo);
                        this.clearBlockedNode(node.instanceID);
                        this.logPlanning(`${consumerLabel}: re-queued waiting record ${waitRecord.recordID}.`);
                    }
                });
                if (shouldRequeueExisting) {
                    return;
                }
                this.logPlanning(`${consumerLabel} received new input; resuming execution.`);
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

            if (node.nodeType === "customComponent") {
                const definition = this.getComponentDefinitionForInstance(node.instanceID);
                if (definition?.componentID) {
                    runInfo.componentBreadcrumb = [definition.componentID];
                }
            }

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

        this.generateRunInfoForNode({ node, unconsumedInputs, recordsByNodeInstanceID });
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

        if (!Array.isArray(record.componentBreadcrumb)) {
            record.componentBreadcrumb = Array.isArray(runInfo.componentBreadcrumb)
                ? [...runInfo.componentBreadcrumb]
                : [];
        }
        
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
