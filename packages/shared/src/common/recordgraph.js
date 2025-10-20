import { nullUndefinedOrEmpty } from "./objects";
import { Constants } from '@src/common/defaultconfig';

const specialVariableSubtree = "__variables";

export class RecordGraph {
    constructor(records = [], nodes = []) {
        this.inputRecords = records;
        this.nodes = nodes;
        this.recordEntries = {};
        this.nodesByInstanceID = {};
        this.consumersOfNode = {};
        this.startEntry = null;

        this.initialize();
    }

    addRecord(record) {
        this.recordEntries[record.recordID] = {
            record: record,
            parents: [],
            childSubtrees: {},
            attributes: {},
            componentBreadcrumb: Array.isArray(record?.componentBreadcrumb)
                ? [...record.componentBreadcrumb]
                : []
        };

        if (record.nodeInstanceID === "start") {
            this.startEntry = this.recordEntries[record.recordID];
        }
    }

    reset(records = [], nodes = []) {
        this.inputRecords = records;
        if (Array.isArray(nodes) && nodes.length > 0) {
            this.nodes = nodes;
        }
        this.initialize();
    }

    connectRecord(record) {
        const currentRecord = this.recordEntries[record.recordID];
        if (!currentRecord) {
            return;
        }
        if (nullUndefinedOrEmpty(record.inputs)) {
            return;
        }
        for (let i = 0; i < record.inputs.length; i++) {
            const input = record.inputs[i];
            const inputRecord = this.recordEntries[input.recordID];
            if (!inputRecord) {
                const error = new Error(`RecordGraph.connectRecord: input record ${input.recordID} not found for ${record.recordID}`);
                error.code = 'MISSING_PARENT_RECORD';
                throw error;
            }

            if (!nullUndefinedOrEmpty(input.events)) {
                input.events.forEach(event => {
                    if (!inputRecord.childSubtrees[event]) {
                        inputRecord.childSubtrees[event] = [];
                    }
                    if (!inputRecord.childSubtrees[event].includes(currentRecord)) {
                        inputRecord.childSubtrees[event].push(currentRecord);
                    }
                });
            }
            if (!nullUndefinedOrEmpty(input.variables)) {
                if (!inputRecord.childSubtrees[specialVariableSubtree]) {
                    inputRecord.childSubtrees[specialVariableSubtree] = [];
                }
                if (!inputRecord.childSubtrees[specialVariableSubtree].includes(currentRecord)) {
                    inputRecord.childSubtrees[specialVariableSubtree].push(currentRecord);
                }
            }

            currentRecord.parents.push(inputRecord);
        }
    }

    addCompletedRecord(record) {
        if (!record || record.deleted || record.state !== "completed") {
            return;
        }
        if (this.recordEntries[record.recordID]) {
            return;
        }
        this.addRecord(record);
        this.connectRecord(record);
    }

    removeRecord(recordID) {
        const recordEntry = this.recordEntries[recordID];
        if (!recordEntry) {
            return;
        }

        if (recordEntry.parents && recordEntry.parents.length > 0) {
            recordEntry.parents.forEach(parentEntry => {
                Object.keys(parentEntry.childSubtrees).forEach(event => {
                    parentEntry.childSubtrees[event] = parentEntry.childSubtrees[event].filter(child => child.record.recordID !== recordID);
                    if (parentEntry.childSubtrees[event].length === 0) {
                        delete parentEntry.childSubtrees[event];
                    }
                });
            });
        }

        if (recordEntry.childSubtrees) {
            Object.keys(recordEntry.childSubtrees).forEach(event => {
                const childEntries = recordEntry.childSubtrees[event];
                childEntries.forEach(childEntry => {
                    childEntry.parents = childEntry.parents.filter(parent => parent.record.recordID !== recordID);
                });
            });
        }

        delete this.recordEntries[recordID];
        if (this.startEntry && this.startEntry.record.recordID === recordID) {
            this.startEntry = null;
        }
    }

    applyDelta({ newRecords = [], updatedRecords = [], deletedRecordIDs = [], records = [] } = {}) {
        let requiresFullRebuild = false;

        try {
            if (Array.isArray(newRecords)) {
                newRecords.forEach(record => {
                    if (!record || record.deleted || record.state !== "completed") {
                        return;
                    }
                    if (this.recordEntries[record.recordID]) {
                        // If the record already exists, treat it as an update
                        requiresFullRebuild = true;
                        return;
                    }
                    this.addCompletedRecord(record);
                });
            }
        } catch (error) {
            Constants.debug.logFlowControl && console.error("RecordGraph.applyDelta: error while adding new record, triggering rebuild", error);
            requiresFullRebuild = true;
        }

        if ((updatedRecords && updatedRecords.length > 0) || (deletedRecordIDs && deletedRecordIDs.length > 0)) {
            requiresFullRebuild = true;
        }

        if (requiresFullRebuild) {
            this.reset(records, this.nodes);
            return;
        }

        if (Array.isArray(records)) {
            this.inputRecords = records;
        }
    }

    initialize() {
        this.recordEntries = {};
        this.nodesByInstanceID = {};
        this.consumersOfNode = {};
        this.startEntry = null;
        // first add a graph entry for each record
        this.inputRecords.forEach(record => {
            if (record.deleted) {
                return;
            }
            if (record.state != "completed") {
                return;
            }
            if (!this.recordEntries[record.recordID]) {
                this.addRecord(record);
            }
        });
        // Now connect all the parents
        this.inputRecords.forEach(record => {
            if (record.deleted) {
                return;
            }
            if (record.state != "completed") {
                return;
            }
            const currentRecord = this.recordEntries[record.recordID];
            if (!nullUndefinedOrEmpty(currentRecord.record.inputs)) {
                for (let i = 0; i < currentRecord.record.inputs.length; i++) {
                    const input = currentRecord.record.inputs[i];
                    
                    let inputRecord = this.recordEntries[input.recordID];
                    if (!inputRecord) {
                        const originalRecord = this.inputRecords.find(r => r.recordID === input.recordID);
                        Constants.debug.logFlowControl && console.error("RecordGraph.initialize: input record not found in graph: ", input);
                        if (originalRecord) {
                            Constants.debug.logFlowControl && console.error("RecordGraph.initialize: input record not found in graph, but exists: ", input.recordID);
                        }
                        throw new Error(`RecordGraph.initialize: input record ${input.recordID} not found, input=` + JSON.stringify(input, null, 2));
                    }

                    if (!nullUndefinedOrEmpty(input.events)) {
                        // This input's event triggered this record to run

                        input.events.forEach(event => {
                            if (!this.recordEntries[input.recordID].childSubtrees[event]) {
                                this.recordEntries[input.recordID].childSubtrees[event] = [];
                            }
                            this.recordEntries[input.recordID].childSubtrees[event].push(currentRecord);
                        });
                    } 
                    if (!nullUndefinedOrEmpty(input.variables)) {
                        // This is a variable-only input
                        if (!this.recordEntries[input.recordID].childSubtrees[specialVariableSubtree]) {
                            this.recordEntries[input.recordID].childSubtrees[specialVariableSubtree] = [];
                        }
                        this.recordEntries[input.recordID].childSubtrees[specialVariableSubtree].push(currentRecord);
                    }

                    // Mark the input record as an input to this record
                    currentRecord.parents.push(inputRecord);
                }
            }
        });

        /*

        "inputs": [
          {
            "producerInstanceID": "start",
            "triggers": [
              {
                "producerEvent": "completed",
                "targetTrigger": "default",
                "includeHistory": false,
                "historyParams": {}
              }
            ],
            "variables": []
          }
        ],
        */
        // rewrite the code below with the format above



        this.nodes.forEach(node => {
            this.nodesByInstanceID[node.instanceID] = node;
            if (!nullUndefinedOrEmpty(node.inputs)) {
                for (let i = 0; i < node.inputs.length; i++) {
                    const input = node.inputs[i];
                    if (!this.consumersOfNode[input.producerInstanceID]) {
                        this.consumersOfNode[input.producerInstanceID] = {};
                    }
                    // Add a consumer by event consumed, adding a single specialVariableSubtree entry
                    // if the consumer consumes one or more variables
                    if (!nullUndefinedOrEmpty(input.triggers)) {
                        input.triggers.forEach(trigger => {
                            if (!this.consumersOfNode[input.producerInstanceID][trigger.producerEvent]) {
                                this.consumersOfNode[input.producerInstanceID][trigger.producerEvent] = [];
                            }
                            this.consumersOfNode[input.producerInstanceID][trigger.producerEvent].push(node);
                        });
                    } 
                    if (!nullUndefinedOrEmpty(input.variables)) {
                        if (!this.consumersOfNode[input.producerInstanceID][specialVariableSubtree]) {
                            this.consumersOfNode[input.producerInstanceID][specialVariableSubtree] = [];
                        }
                        this.consumersOfNode[input.producerInstanceID][specialVariableSubtree].push(node);
                    }
                }
            }
        });

        // If any record has no parents, and it's not the start record, then it's an orphan which isn't allowed
        // so throw an error
        Object.keys(this.recordEntries).forEach(recordID => {
            if (this.recordEntries[recordID].parents.length == 0 && this.recordEntries[recordID].record.nodeInstanceID !== "start") { 
                throw new Error("RecordGraph.initialize: orphan record found: "  + JSON.stringify(this.recordEntries[recordID].record));
            }
        });

        Constants.debug.logFlowControl && console.error("RecordGraph.initialize: recordEntries=", Object.keys(this.recordEntries).length);
    }

    recordHasBeenConsumedByAllConsumers(recordID) {
        let recordEntry = this.recordEntries[recordID];
        const node = this.nodesByInstanceID[recordEntry.record.nodeInstanceID];

        if (!node) {
            // The node may have been deleted
            console.error("Warning: recordHasBeenConsumedByAllConsumers: node not found for recordID=", recordID, " nodeInstanceID=", recordEntry.record.nodeInstanceID);
            return;
        }

        const consumersOfNode = this.consumersOfNode[node.instanceID] || [];

        //
        // See if all events have been consumed
        //
        if (!nullUndefinedOrEmpty(recordEntry.record.eventsEmitted)) {
            for (let i = 0; i < recordEntry.record.eventsEmitted.length; i++) {
                // See if thre are recordEntries in the subtree for each event, and
                // ensure all the consumer records are there
                const event = recordEntry.record.eventsEmitted[i];
                // list of nodes that consume this event
                const consumersOfEvent = consumersOfNode[event];

                // list of recordEntries that consumed this event
                const subtreeForEvent = recordEntry.childSubtrees[event];

                if (!nullUndefinedOrEmpty(consumersOfEvent)) {
                    if (!nullUndefinedOrEmpty(subtreeForEvent)) {
                        for (let j = 0; j < consumersOfEvent.length; j++) {
                            const consumer = consumersOfEvent[j];
                            // Is this consumer in the subtree?
                            if (!subtreeForEvent.find(c => !c.record.deleted && (c.record.state == "completed") && (c.record.nodeInstanceID === consumer.instanceID))) {
                                Constants.debug.logFlowControl && console.error(`   FALSE -> event ${event} not consumed`);
                                return false;
                            }
                        }
                    } else {
                        Constants.debug.logFlowControl && console.error(`   FALSE -> event ${event} not consumed`);
                        return false;
                    }
                    
                    Constants.debug.logFlowControl && console.error(`   TRUE -> All the following events have been consumed: `, recordEntry.record.recordID + "-" + recordEntry.record.eventsEmitted.join(", "));
                }
            }
        }

        //
        // See if all variables have been consumed if any 
        //
        /*
        const consumersOfVariables = consumersOfNode[specialVariableSubtree] || [];
        if (!nullUndefinedOrEmpty(consumersOfVariables)) {
            const subtreeForVariables = recordEntry.childSubtrees[specialVariableSubtree];
            if (nullUndefinedOrEmpty(subtreeForVariables)) {
                Constants.debug.logFlowControl && console.error(`   FALSE -> variables not consumed`);
                return false;
            }
            for (let i = 0; i < consumersOfVariables.length; i++) {
                const consumer = consumersOfVariables[i];
                // Is this consumer in the subtree?
                if (!subtreeForVariables.find(c => !c.record.deleted && (c.record.state == "completed") && (c.record.nodeInstanceID === consumer.instanceID))) {
                    Constants.debug.logFlowControl && console.error(`   FALSE -> variables not consumed`);
                    return false;
                }
            }

            Constants.debug.logFlowControl && console.error(`   TRUE -> All the following variables have been consumed: `, specialVariableSubtree);
        }
        */

        //Constants.debug.logFlowControl && console.error(`   TRUE -> all consumers are consuming this record`);
        return true;
    }

    markAllRecordsConsumedByAllConsumers() {

        this.clearAttributeForAllNodes("consumed");

        // Iterate all records by key
        Object.keys(this.recordEntries).forEach(recordID => {
            if (this.recordHasBeenConsumedByAllConsumers(recordID)) {
                this.setAttribute(recordID, "consumed", true);
            }
        });
    }

    findAllMarkedRecordsNotConsumedByAllConsumers() {
            
            let recordsNotConsumedByAllConsumers = [];
    
            Object.keys(this.recordEntries).forEach(recordID => {
                if (!this.getAttribute(recordID, "consumed")) {
                    recordsNotConsumedByAllConsumers.push(recordID);
                }
            });
    
            return recordsNotConsumedByAllConsumers;
    }

    areAllChildrenConsumed(recordID) {

        let recordEntry = this.recordEntries[recordID];

        // Need to mark records for this search to avoid
        // infinite loops

        this.clearAttributeForAllNodes("checkedForAllChildrenConsumed");

        for (let i = 0; i < recordEntry.parents.length; i++) {
            const inputRecord = recordEntry.parents[i];
            if (!this.getAttribute(inputRecord.record.recordID, "consumed")) {
                allChildrenConsumed = false;
                break;
            }
        }

        return allChildrenConsumed;
    }

    findFullyConsumedFlowControlNodesInThisSubtree(recordID) {
                
        let recordEntry = this.recordEntries[recordID];
        
        if (this.getAttribute(recordID, "checkedForEntireSubtreeConsumed")) {
             throw new Error("isSubtreeConsumed shouldn't be called twice for the same recordID");
        }
        
        Constants.debug.logFlowControl && console.error(`%% SUBTREE CHECKING RECORD ${recordID} with ${recordEntry.consumers ? recordEntry.consumers.length : 0 } consumers`);

        this.setAttribute(recordID, "checkedForEntireSubtreeConsumed", true);

        // Call this function recursively for all children
        let subtreeConsumed = this.getAttribute(recordID, "consumed");
        let flowControlNodesInSubtree = [];
        const subtreeKeys = Object.keys(recordEntry.childSubtrees);
        // Create a list of all flow control nodes across all subtrees, and dedupe as we go
        let allChildRecordEntries = [];
        for (let i = 0; i < subtreeKeys.length; i++) {
            const subtree = recordEntry.childSubtrees[subtreeKeys[i]];
            subtree.forEach(subtreeRecordEntry => {
                if (!allChildRecordEntries.includes(subtreeRecordEntry)) {
                    allChildRecordEntries.push(subtreeRecordEntry);
                }
            });
        }
        for (let j = 0; j < allChildRecordEntries.length; j++) {
            const consumingRecord = allChildRecordEntries[j];

            if (!this.getAttribute(consumingRecord.record.recordID, "consumed")) {
                Constants.debug.logFlowControl && console.error(`   %% SUBTREE CHECK - RECORD ${consumingRecord.record.recordID} NOT CONSUMED`);
                subtreeConsumed = false;
            }
            if (!this.getAttribute(consumingRecord.record.recordID, "checkedForEntireSubtreeConsumed")) {
                const flowControlResult = this.findFullyConsumedFlowControlNodesInThisSubtree(consumingRecord.record.recordID);
                if (flowControlResult) {
                    flowControlNodesInSubtree.push(flowControlResult);
                }
            }
            if (!this.getAttribute(consumingRecord.record.recordID, "subTreeConsumed")) {
                Constants.debug.logFlowControl && console.error(`   %% SUBTREE CHECK - RECORD ${consumingRecord.record.recordID} CONSUMED BUT NOT SUBTREE`);
                subtreeConsumed = false;
            }
        }

        Constants.debug.logFlowControl && console.error(`   %% SUBTREE CHECK - RECORD ${recordID} SUBTREE CONSUMED? `, subtreeConsumed ? `YES` : `NO`);
        this.setAttribute(recordID, "subTreeConsumed", subtreeConsumed ? true : false);


        if (subtreeConsumed) {
            // On each new flow control node, add a new layer of indirection
            return {
                    record: recordEntry.record,
                    descendants: flowControlNodesInSubtree,
            };
        } else {
            if (flowControlNodesInSubtree.length == 0) {
                return null;
            } else if (flowControlNodesInSubtree.length == 1) {
                // No need to add a layer of indirection if there's only one node -- pass it through
                return flowControlNodesInSubtree[0];
            } else {
                return {
                    record: null,
                    descendants: flowControlNodesInSubtree || [],
                }
            }
        }
    }

    findFlowControlNodesWithFullTreesAndUnconsumedInputs() {

        this.markAllRecordsConsumedByAllConsumers();

        this.clearAttributeForAllNodes("checkedForEntireSubtreeConsumed");

        if (!this.startEntry) {
            if (this.recordEntries.length > 0) {
                throw new Error("No start node found in record graph");
            } else {
                return [];
            }
        }

        const treeOfFullyConsumedFlowControlNodes = this.findFullyConsumedFlowControlNodesInThisSubtree(this.startEntry.record.recordID);

        return treeOfFullyConsumedFlowControlNodes || { record: null, descendants: [] };
    }

    markAncestorsUnconsumed(recordID) {
        Constants.debug.logFlowControl && console.error(`   %% MARKING ANCESTOR ${recordID} UNCONSUMED`);
        let recordEntry = this.recordEntries[recordID];
        this.setAttribute(recordEntry.record.recordID, "consumed", false);
        this.setAttribute(recordEntry.record.recordID, "subTreeConsumed", false);

        recordEntry.parents.forEach(ancestorRecordEntry => {
            this.markAncestorsUnconsumed(ancestorRecordEntry.record.recordID);
        });
    }

    setAttribute(recordID, key, value) {
        this.recordEntries[recordID].attributes[key] = value;
    }

    getAttribute(recordID, key) {
        return this.recordEntries[recordID].attributes[key];
    }

    clearAttributeForAllNodes(key) {
        Object.keys(this.recordEntries).forEach(recordID => {
            delete this.recordEntries[recordID].attributes[key];
        });
    }

    clearAllAttributes() {
        Object.keys(this.recordEntries).forEach(recordID => {
            this.recordEntries[recordID].attributes = {};
        });
    }

    getComponentBreadcrumb(recordID) {
        const entry = this.recordEntries[recordID];
        if (!entry) {
            return [];
        }
        return Array.isArray(entry.componentBreadcrumb) ? [...entry.componentBreadcrumb] : [];
    }

    setComponentBreadcrumb(recordID, breadcrumb = []) {
        const entry = this.recordEntries[recordID];
        if (!entry) {
            return;
        }
        entry.componentBreadcrumb = Array.isArray(breadcrumb) ? [...breadcrumb] : [];
    }

    printEntry(entry, prefix = "") {
        Constants.debug.logFlowControl && console.error(`${prefix}RecordID: ${entry.record.recordID}`);
        Constants.debug.logFlowControl && console.error(`${prefix}NodeType: ${entry.record.nodeType}`);
        Constants.debug.logFlowControl && console.error(`${prefix}Parents: `, entry.parents?.map(input => input.record.recordID).join(", "));
        Constants.debug.logFlowControl && console.error(`${prefix}Attributes: `, entry.attributes);
        Constants.debug.logFlowControl && console.error(`${prefix}Subtree Count: `, Object.keys(entry.childSubtrees).length);
        const nextPrefix = prefix + "  ";
        Object.keys(entry.childSubtrees).forEach(event => {
            Constants.debug.logFlowControl && console.error(`${prefix}Subtree[${event}]:`);
            entry.childSubtrees[event].forEach(subtree => {
                this.printEntry(subtree, nextPrefix);
            });
        });
    }

    print() {
        Constants.debug.logFlowControl && console.error(`************************* FULL GRAPH START *************************`)
        
        if (this.startEntry) {
            this.printEntry(this.startEntry);
        }

        
        Constants.debug.logFlowControl && console.error("*************************  FULL GRAPH END *************************")
    }
}
