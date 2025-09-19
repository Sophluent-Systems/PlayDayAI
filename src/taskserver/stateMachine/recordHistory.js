import { nullUndefinedOrEmpty } from "@src/common/objects";
import { filterRecords as filterRecordsHelper, messageFromRecord as messageFromRecordHelper, exportRecordsAsMessageList as exportRecordsAsMessageListHelper } from '@src/backend/messageHistory';
import { insertOrUpdateRecord, getAllRecordsForSession } from "@src/backend/records";
import { v4 as uuidv4 } from 'uuid';


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
        return filterRecordsHelper(records, params);
    }

    getFilteredRecords(params = {}) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        return this.filterRecordList_static(this.records, params);
    }

    messageFromRecord(versionInfo, record, params = {}) {
        return messageFromRecordHelper(versionInfo, record, params);
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
        return exportRecordsAsMessageListHelper(versionInfo, records, params);
    }

    exportAsMessageList(versionInfo, params = {}) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }
        const filteredRecords = this.getFilteredRecords(params);
        return exportRecordsAsMessageListHelper(versionInfo, filteredRecords, { ...params, preFiltered: true });
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

