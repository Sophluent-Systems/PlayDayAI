import { nullUndefinedOrEmpty } from "@src/common/objects";
import { insertOrUpdateRecord, getAllRecordsForSession } from "../records";
import { getNodePersonaDetails } from "@src/common/personainfo";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { v4 as uuidv4 } from 'uuid';
import { ImportError } from "@src/common/errors";


//
// The RecordHistory class can be used to load all the records for a single session,
// return a linear list of records from the DAG, and maintain state such as
// inserting new records into the database AND in-memory DAG without re-reading
// the entire database.
//

export class RecordHistory {
    constructor(db, sessionID) {
        this.db = db;
        this.sessionID = sessionID;
        this.records = null;
    }

    async getAllRecords_Stateless(sortedNewestFirst=false, pruneFields=true) {
        const records = await getAllRecordsForSession(this.db, this.sessionID, sortedNewestFirst, pruneFields);
        return records;
    }

    async load() {
        this.records = await this.getAllRecords_Stateless(false, true);
    }

    addRecordWithoutWritingToDB(record) {
        if (this.records === null) {
            throw new Error('RecordHistory.addRecordWithoutWritingToDB called before records are loaded');
        }

        this.records.push(record);
    }

    async insertOrUpdateRecord(record) {

        //
        // Save the record to the database
        //
        const recordToInsert = {
            ...record,
            sessionID: this.sessionID
        };

        this.addRecordWithoutWritingToDB(recordToInsert);

        await insertOrUpdateRecord(this.db, recordToInsert);
    }


    getRecord(recordID) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        return this.records.find((record) => record.recordID === recordID);
    }

    getMostRecentRecordOfInstance(nodeInstanceID) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        // this works since the records are sorted newest first
        return this.records.find((record) => record.nodeInstanceID === nodeInstanceID);
    }

    getRecordHistoryForAncestor_static(records, ancestorRecord) {
        let history = [];

        // call this function recursively to get the history of the ancestor
        if (ancestorRecord.inputs && ancestorRecord.inputs.length > 0) {
            console.error("    has ", ancestorRecord.inputs.length, " inputs");
            for (let i=0; i<ancestorRecord.inputs.length; i++) {
                const input = ancestorRecord.inputs[i];
                const inputRecord = records.find((record) => record.recordID === input.recordID);
                if (inputRecord) {
                    const thisInputHistory = this.getRecordHistoryForAncestor_static(records, inputRecord);
                    history = [...history, thisInputHistory];
                }
            }
        }

        // ancestor goes last
        history.push(ancestorRecord);
        return history;
    }

    filterRecordList_static(records, params) {

        const { includeDeleted, includeFailed, includeWaitingForExternalInput, ignoreCompression, spanSelectionMode, startingSpan, endingSpan, includedNodes, ancestorsOfTypes, states } = params;
        let filteredRecords = [...records];

        // for now, run a compat filter
        for (let i=0; i<filteredRecords.length; i++) {
            let record = filteredRecords[i];
            filteredRecords[i] = record;
        }
        
        if (states) {
            if (!Array.isArray(states)) {
                throw new Error('states must be an array');
            }

            filteredRecords = filteredRecords.filter((record) => {
                return states.includes(record.state);
            });
        }

        if (ancestorsOfTypes) {

            const ancestorRecord = this.getRecord(fromAncestorID);
            if (!ancestorRecord) {
                throw new Error('fromAncestorID not found: ' + fromAncestorID);
            }

            filteredRecords = this.getRecordHistoryForAncestor_static(records, ancestorRecord);

        } else {
            
            filteredRecords = [...records];
        }

        //
        // Filter the records next, so when any spans are applied,
        // we return the correct # of records
        //

        //
        // Apply the filter
        //

        filteredRecords = filteredRecords.filter((record) => {
            if (record.deleted && !includeDeleted) {
                return false;
            }
            if (record.state == "failed" && !includeFailed) {
                return false;
            }
            if (record.state == "waitingForExternalInput" && !includeWaitingForExternalInput) {
                return false;
            }
            return true;
        });

        if (!nullUndefinedOrEmpty(includedNodes)) {
            if (!Array.isArray(includedNodes)) {
                throw new Error('includedNodes must be an array');
            }
            filteredRecords = filteredRecords.filter((record) => {
                return includedNodes.includes(record.nodeInstanceID);
            });
        }
        

        //
        // Apply the spans
        //

        if (!nullUndefinedOrEmpty(spanSelectionMode) && spanSelectionMode !== 'full') {
            console.error(`APPLYING ${spanSelectionMode} SPAN: `, spanSelectionMode, " startingSpan=", startingSpan, " endingSpan=", endingSpan);
            
            if (spanSelectionMode === 'exclude') {
                if ((startingSpan + endingSpan) >= filteredRecords.length) {
                    // Excludes all the records!
                    return [];
                }

                //
                // First apply ending span, removing the last N records
                //
                if (startingSpan > 0) {
                    filteredRecords.splice(0, startingSpan);
                }

                if (endingSpan > 0) {
                    filteredRecords.splice(-endingSpan, endingSpan);
                }

                console.error("APPLIED EXCLUDE SPAN: final count=", filteredRecords.length);
            } else if (spanSelectionMode === 'include') {

                // if starting + ending span is greater or equal than the number of records,
                // we include all the records
                if ((startingSpan + endingSpan) < filteredRecords.length) {
                    let newArray = [];
                    if (startingSpan > 0) {
                        // add startingSpan from the start of the array
                        newArray = filteredRecords.slice(0, startingSpan);
                    }
                    if (endingSpan > 0) {
                        // add endingSpan from the end of the array
                        newArray = [...newArray, ...filteredRecords.slice(-endingSpan)];
                    }
                    filteredRecords = newArray;
                }
                console.error("APPLIED INCLUDE SPAN: final count=", filteredRecords.length);
            }
        }

        return filteredRecords;
    }

    getFilteredRecords(params = {}) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        return this.filterRecordList_static(this.records, params);
    }

    messageFromRecord(versionInfo, record, params = {}) {
        const nodes = versionInfo.stateMachineDescription.nodes;

        const { includeDebugInfo, appendPersonaIdentity } = params;
        let message = {};
        
        const node = nodes.find((node) => node.instanceID === record.nodeInstanceID);
        if (!node) {
            console.error('RecordHistory.messageFromRecord: node not found for record ', record.recordID, "...ignoring it");
            return null;
        }

        message.executionTime = record.executionTime;
        message.completionTime = record.completionTime;
        message.startTime = record.startTime;
        message.recordID = record.recordID;
        message.nodeInstanceID = record.nodeInstanceID;
        message.state = record.state;

        message.nodeAttributes = getMetadataForNodeType(node.nodeType).nodeAttributes;

        const defaultOutputField = message.nodeAttributes.defaultOutputField;
        const defaultOutput = record.output?.[defaultOutputField];

        message.content = defaultOutput || {};

        // If the content is empty and this is user input,
        // add text indicating what type(s) of input were received
        if (message.nodeAttributes?.userInput && Object.keys(message.content).length === 0) {
            message.content.text = "Input received: ";

            const outputKeys = record.output ? Object.keys(record.output) : [];
            if (outputKeys.length > 0) {
                message.content.text += Object.keys(record.output).join(", ");
            } else {
                message.content.text += "none";
            }
        }

        let persona = null;
        if (!nullUndefinedOrEmpty(node.personaLocation)) {

            persona = getNodePersonaDetails(versionInfo, node);

            message.persona = persona;
            message.personaSource = node.personaLocation.source;
        } else {
            message.persona = null;
            message.personaSource = null;
        }

        if (appendPersonaIdentity) {
            const hasCustomPersona = message.personaSource == "version";
    
            if (hasCustomPersona && persona && !nullUndefinedOrEmpty(message.content["text"])) {
                console.error(`Node [${node.instanceName}] has persona: `, persona.displayName);
                message.content["text"] = `${persona.displayName}: ${message.content["text"]}`;
                console.error("   Appended persona identity to text: ", message.content["text"]);
            }
        }

        if (record.error) {
            if (includeDebugInfo) {
                const errorObject =  ImportError(record.error);
                message.error = errorObject.export();
            } else {
                message.error = { name: record.error.name, message: record.error.message };
            }
        }

        if (includeDebugInfo) {
            message.nodeType = node.nodeType;
            message.nodeInstanceID = node.instanceID;
            message.instanceName = node.instanceName;
            message.hideOutput = node.hideOutput ? true : false;
        }
        
        if (message.nodeAttributes["userInput"]) {
            
            message.role = "user";
        
        } else if (!nullUndefinedOrEmpty(message.content.text)) {
            
            message.role = "assistant";

        } else if (!nullUndefinedOrEmpty(message.content)){

            message.role = Object.keys(message.content)[0];
            
        } else {

            message.role = "assistant";
        }

        return message;
    }

    cloneRecord_static(record) {
        // tell the caller to insert this new record into the queue
        let newRecord = JSON.parse(JSON.stringify(record));
        newRecord.startTime = new Date();
        newRecord.recordID = uuidv4();
        newRecord.state = "new";
        delete newRecord.completionTime;
        delete newRecord.executionTime;
        delete newRecord.error;
        delete newRecord.output;
        delete newRecord.deleted;
        return newRecord;
    }

    exportAsMessageList_static(versionInfo, records, params = {}) {

        const { mediaTypes } = params;

        let filteredRecords = this.filterRecordList_static(records, params);

        let messages = [];
        if (filteredRecords.length > 0) {
            for (let i=0; i<filteredRecords.length; i++) {
                const record = filteredRecords[i];
                const message = this.messageFromRecord(versionInfo, record, params);
                if (message) {
                    messages.push(message);
                }
            }
        }

        if (!nullUndefinedOrEmpty(mediaTypes)) {
            if (!Array.isArray(mediaTypes)) {
                throw new Error('mediaTypes must be an array');
}
            messages = messages.filter((m) => {
                for (let i=0; i<mediaTypes.length; i++) {
                    if (!nullUndefinedOrEmpty(m.content[mediaTypes[i]])) {
                        return true;
                    }
                }
                return false;
            });
        }

        return messages;
    }

    exportAsMessageList(versionInfo, params = {}) {
        
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }
        
        let fileteredRecords = this.getFilteredRecords(params);

        const messages = this.exportAsMessageList_static(versionInfo, fileteredRecords, params);

        return messages;
    }

    async deleteRecord(recordID) {
        const record = this.getRecord(recordID);
        if (!record) {
            throw new Error('RecordHistory.markDeleted: record not found: ' + recordID);
        }

        record.deleted = true;
        await this.insertOrUpdateRecord(record);
    }
};

