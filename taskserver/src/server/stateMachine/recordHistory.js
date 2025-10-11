import { nullUndefinedOrEmpty } from "@src/common/objects";
import { filterRecords as filterRecordsHelper, messageFromRecord as messageFromRecordHelper, exportRecordsAsMessageList as exportRecordsAsMessageListHelper } from '@src/backend/messageHistory';
import { insertOrUpdateRecord, getAllRecordsForSession, getRecordsForSessionSince } from "@src/backend/records";
import { Config } from "@src/backend/config";
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
        this.recordIndexById = new Map();
        this.highWaterMark = null;
        this.incrementalLoadsSinceFull = 0;
    }

    getStateMachineConfig() {
        const { Constants } = Config;
        return Constants?.config?.stateMachine || {};
    }

    getMaxIncrementalSyncsBeforeFullReload() {
        const config = this.getStateMachineConfig();
        const maxSyncs = typeof config.maxIncrementalSyncsBeforeFullReload === 'number' ? config.maxIncrementalSyncsBeforeFullReload : 20;
        return maxSyncs > 0 ? maxSyncs : 20;
    }

    cloneRecord(record) {
        if (typeof structuredClone === 'function') {
            return structuredClone(record);
        }
        return JSON.parse(JSON.stringify(record));
    }

    normalizeTemporalFields(record) {
        const normalized = { ...record };
        if (normalized.startTime && !(normalized.startTime instanceof Date)) {
            normalized.startTime = new Date(normalized.startTime);
        }
        if (normalized.completionTime && normalized.completionTime !== null && !(normalized.completionTime instanceof Date)) {
            normalized.completionTime = new Date(normalized.completionTime);
        }
        if (normalized.executionTime && normalized.executionTime !== null && !(normalized.executionTime instanceof Date)) {
            normalized.executionTime = new Date(normalized.executionTime);
        }
        if (normalized.lastModifiedTime && !(normalized.lastModifiedTime instanceof Date)) {
            normalized.lastModifiedTime = new Date(normalized.lastModifiedTime);
        }
        if (normalized.deletedAt && !(normalized.deletedAt instanceof Date)) {
            normalized.deletedAt = new Date(normalized.deletedAt);
        }
        return normalized;
    }

    updateHighWaterMark(candidate) {
        if (!(candidate instanceof Date) || Number.isNaN(candidate.getTime())) {
            return;
        }
        if (!this.highWaterMark || candidate > this.highWaterMark) {
            this.highWaterMark = candidate;
        }
    }

    getRecordModificationTimestamp(record) {
        if (!record) {
            return null;
        }
        const candidates = [
            record.lastModifiedTime,
            record.deletedAt,
            record.completionTime,
            record.startTime
        ];
        for (let i = 0; i < candidates.length; i++) {
            const value = candidates[i];
            if (!value) {
                continue;
            }
            if (value instanceof Date) {
                if (!Number.isNaN(value.getTime())) {
                    return value;
                }
            } else {
                const coerced = new Date(value);
                if (!Number.isNaN(coerced.getTime())) {
                    return coerced;
                }
            }
        }
        return null;
    }

    rebuildRecordIndex() {
        this.recordIndexById = new Map();
        if (!Array.isArray(this.records)) {
            return;
        }
        let newWaterMark = null;
        for (let i = 0; i < this.records.length; i++) {
            this.recordIndexById.set(this.records[i].recordID, i);
            const candidate = this.getRecordModificationTimestamp(this.records[i]);
            if (candidate && (!newWaterMark || candidate > newWaterMark)) {
                newWaterMark = candidate;
            }
        }
        this.highWaterMark = newWaterMark;
    }

    insertRecordMaintainingOrder(record) {
        if (this.records.length === 0) {
            this.records.push(record);
            this.recordIndexById.set(record.recordID, 0);
            return;
        }

        const startTime = record.startTime instanceof Date ? record.startTime : new Date(record.startTime);
        let insertIndex = this.records.length;
        while (insertIndex > 0) {
            const previousRecord = this.records[insertIndex - 1];
            const previousStartTime = previousRecord?.startTime instanceof Date ? previousRecord.startTime : new Date(previousRecord.startTime);
            if (previousStartTime <= startTime) {
                break;
            }
            insertIndex--;
        }

        this.records.splice(insertIndex, 0, record);

        for (let index = insertIndex; index < this.records.length; index++) {
            this.recordIndexById.set(this.records[index].recordID, index);
        }
    }

    upsertRecordInCache(record) {
        if (this.records === null) {
            this.records = [];
        }

        const clonedRecord = this.normalizeTemporalFields(this.cloneRecord(record));
        const existingIndex = this.recordIndexById.get(clonedRecord.recordID);

        if (typeof existingIndex === 'number') {
            this.records[existingIndex] = clonedRecord;
        } else {
            this.insertRecordMaintainingOrder(clonedRecord);
        }

        const modificationTimestamp = this.getRecordModificationTimestamp(clonedRecord);
        this.updateHighWaterMark(modificationTimestamp);
    }

    removeRecordFromCache(recordID) {
        if (this.records === null) {
            return;
        }

        const existingIndex = this.recordIndexById.get(recordID);
        if (typeof existingIndex !== 'number') {
            return;
        }

        this.records.splice(existingIndex, 1);
        this.rebuildRecordIndex();

        if (this.records.length === 0) {
            this.highWaterMark = null;
        } else {
            let newWaterMark = null;
            for (let i = 0; i < this.records.length; i++) {
                const candidate = this.getRecordModificationTimestamp(this.records[i]);
                if (candidate && (!newWaterMark || candidate > newWaterMark)) {
                    newWaterMark = candidate;
                }
            }
            this.highWaterMark = newWaterMark;
        }
    }

    async getAllRecords_Stateless(sortedNewestFirst=false, pruneFields=true) {
        const records = await getAllRecordsForSession(this.db, this.sessionID, sortedNewestFirst, pruneFields);
        return records;
    }

    async getRecordsSince_Stateless(since, pruneFields=true) {
        if (!since) {
            return [];
        }
        return await getRecordsForSessionSince(this.db, this.sessionID, since, pruneFields);
    }

    async load({ incremental = false } = {}) {
        if (!incremental || this.records === null) {
            const allRecords = await this.getAllRecords_Stateless(false, true);
            this.records = [];
            this.recordIndexById = new Map();
            this.highWaterMark = null;
            allRecords.forEach(record => this.upsertRecordInCache(record));
            this.rebuildRecordIndex();
            this.incrementalLoadsSinceFull = 0;
            return {
                allRecords: this.records,
                delta: {
                    newRecords: [...this.records],
                    updatedRecords: [],
                    deletedRecordIDs: []
                },
                fullReload: true
            };
        }

        const maxIncremental = this.getMaxIncrementalSyncsBeforeFullReload();
        if (this.incrementalLoadsSinceFull >= maxIncremental) {
            return await this.load({ incremental: false });
        }

        const since = this.highWaterMark;

        if (!since) {
            return await this.load({ incremental: false });
        }

        let recordsSince = [];
        try {
            recordsSince = await this.getRecordsSince_Stateless(since, true);
        } catch (error) {
            console.error('RecordHistory.load incremental fetch failed (new records), falling back to full reload:', error);
            return await this.load({ incremental: false });
        }

        const newRecords = [];
        const updatedRecords = [];
        const updatedRecordIDs = new Set();
        const deletedRecordIDSet = new Set();

        recordsSince.forEach(record => {
            const alreadyKnown = this.recordIndexById.has(record.recordID);
            this.upsertRecordInCache(record);
            const cachedIndex = this.recordIndexById.get(record.recordID);
            const cachedRecord = typeof cachedIndex === 'number'
                ? this.records[cachedIndex]
                : this.records.find(candidate => candidate.recordID === record.recordID);

            if (!cachedRecord) {
                return;
            }

            if (alreadyKnown) {
                if (!updatedRecordIDs.has(cachedRecord.recordID)) {
                    updatedRecordIDs.add(cachedRecord.recordID);
                    updatedRecords.push(cachedRecord);
                }
            } else {
                newRecords.push(cachedRecord);
            }

            if (cachedRecord.deleted) {
                deletedRecordIDSet.add(cachedRecord.recordID);
            }
        });

        this.incrementalLoadsSinceFull += 1;

        return {
            allRecords: this.records,
            delta: {
                newRecords,
                updatedRecords,
                deletedRecordIDs: Array.from(deletedRecordIDSet)
            },
            fullReload: false
        };
    }

    addRecordWithoutWritingToDB(record) {
        if (this.records === null) {
            throw new Error('RecordHistory.addRecordWithoutWritingToDB called before records are loaded');
        }

        this.upsertRecordInCache(record);
    }

    async insertOrUpdateRecord(record) {

        //
        // Save the record to the database
        //
        const recordToInsert = {
            ...record,
            sessionID: this.sessionID
        };

        this.upsertRecordInCache(recordToInsert);

        await insertOrUpdateRecord(this.db, recordToInsert);
    }


    getRecord(recordID) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        const index = this.recordIndexById.get(recordID);
        if (typeof index === 'number') {
            return this.records[index];
        }
        return this.records.find((record) => record.recordID === recordID);
    }

    getMostRecentRecordOfInstance(nodeInstanceID) {
        if (this.records === null) {
            throw new Error('RecordHistory.getRecord called before records are loaded');
        }

        for (let i = this.records.length - 1; i >= 0; i--) {
            const record = this.records[i];
            if (record.nodeInstanceID === nodeInstanceID) {
                return record;
            }
        }
        return null;
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

