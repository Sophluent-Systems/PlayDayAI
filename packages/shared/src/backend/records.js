import { v4 as uuidv4 } from 'uuid';
import { Config } from "@src/backend/config";
import { COMPAT_generateUpdatesForRecord } from './backcompat';
import { EnsureCorrectErrorType } from '@src/common/errors';

export async function deleteRecordIfInputsDeleted(db, record) {
    const { recordID, inputs } = record;

    if (!inputs || inputs.length == 0) {
        return false;
    }

    let anyInputDeleted = false;
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        // get the record
        const inputRecord = await getRecord(db, input.recordID);
        if (inputRecord?.deleted) {
            anyInputDeleted = true;
            break;
        }
    }

    if (anyInputDeleted) {
        console.error("deleteRecordIfInputsDeleted: Deleting record because input was deleted: ", recordID);
        await deleteRecord(db, recordID);
        return true;
    }

    return false;
}


export async function insertOrUpdateRecord(
    db, 
    record) {

    const { Constants } = Config;
    const { inputs, error, recordID, context, state } = record;
    const now = new Date();

    if (!Constants.validRecordStates.includes(state)) {
        throw new Error(`insertOrUpdateRecord: Invalid record state: ${state}`);
    }

    let finalInputs = [];
    if (inputs) {
      // remove history from each input
      finalInputs = inputs.map((input, index) => {
          let newInput = {...input};
          if (newInput.history) {
            delete newInput.history;
          }
          return newInput;
      });
    }

    let finalError = EnsureCorrectErrorType(error);

    let recordToInsert = {
      ...record,
      recordID: recordID ? recordID : uuidv4(),
      inputs: finalInputs,
      error: finalError ? finalError.export() : null,
      context: context || {},
      engineVersion: Constants.engineVersion,
      lastModifiedTime: now,
    };

    if (recordToInsert.deleted) {
      recordToInsert.deletedAt = recordToInsert.deletedAt ? new Date(recordToInsert.deletedAt) : now;
    } else if (recordToInsert.deletedAt) {
      delete recordToInsert.deletedAt;
    }

    if (recordToInsert.params?.history) {
      delete recordToInsert.params.history;
    }

  try {
    const coll = db.collection('records');
    // insert unless there's an existing record with the same recordID
    await coll.updateOne(
      {recordID: recordToInsert.recordID},
      {$set: recordToInsert},
      {upsert: true}
    );

    if (await deleteRecordIfInputsDeleted(db, recordToInsert)) {
        recordToInsert.deleted = true;
        recordToInsert.deletedAt = recordToInsert.deletedAt ? new Date(recordToInsert.deletedAt) : now;
    }

    return recordToInsert;
  } catch (error) {
      console.error('Error adding new record:', error, recordToInsert);
      throw error;
  } 
}

export async function updateRecord(db, recordID, update, expectedState=null) {
  const coll = db.collection('records');
  const query = {
    "recordID": recordID
  }
  if (expectedState) {
    query.state = expectedState;
  }
  const updateQuery = {
    $set: update
  }
  await coll.updateOne(query, updateQuery, {upsert: false});
}


async function markRecordDeleted(db, recordID) {
  const now = new Date();
  await updateRecord(db, recordID, {deleted: true, deletedAt: now, lastModifiedTime: now});
}


async function applyEngineVersionUpdates(db, record) {
  const { Constants } = Config;

  if (record.engineVersion == record.engineVersion) {
      return record;
  }

  const updates = COMPAT_generateUpdatesForRecord(record);

  console.error(">> Updating record from ", record.engineVersion, " -> ", Constants.engineVersion, " with ", updates);

  updates.engineVersion = Constants.engineVersion;

  await updateRecord(db, record.recordID, updates);

  return {...record, ...updates};
}

export async function getMostRecentRecordOfInstance(db, sessionID, nodeInstanceID) {
    const coll = db.collection('records');
    const query = {
      "sessionID": sessionID,
      "nodeInstanceID": nodeInstanceID
    }
    const options = {
      sort: { completionTime: -1 }
    }
    let result = await coll.findOne(query, options);
    result = await applyEngineVersionUpdates(db, result);
    delete result._id;
    return result;
}

export async function getAllRecordsForSession(db, sessionID, sortNewestFirst=true, pruneFields=true) {
    const coll = db.collection('records');
    let options = {};
    if (pruneFields) {
      options.projection = { recordID: 1, inputs: 1, output: 1, startTime: 1, executionTime: 1, eventsEmitted: 1, completionTime: 1, nodeInstanceID: 1, nodeType: 1, params: 1, context: 1, state: 1, waitingFor: 1, error: 1, deleted: 1, properties: 1, lastModifiedTime: 1, deletedAt: 1 };
    }
    let allRecords = await coll.find(
        {sessionID: sessionID},
        options 
    ).sort({startTime: (sortNewestFirst ? -1 : 1)}).toArray();
    allRecords = await Promise.all(allRecords.map(record => applyEngineVersionUpdates(db, record)));
    // delete _id from all records
    if (allRecords) {
        for (let i = 0; i < allRecords.length; i++) {
            delete allRecords[i]._id;
        }
    }
    return allRecords;
}

export async function getRecordsForSessionSince(db, sessionID, sinceStartTime, pruneFields = true) {
    if (!sinceStartTime) {
        return [];
    }

    const coll = db.collection('records');
    let options = {};
    if (pruneFields) {
        options.projection = { recordID: 1, inputs: 1, output: 1, startTime: 1, executionTime: 1, eventsEmitted: 1, completionTime: 1, nodeInstanceID: 1, nodeType: 1, params: 1, context: 1, state: 1, waitingFor: 1, error: 1, deleted: 1, properties: 1, lastModifiedTime: 1, deletedAt: 1 };
    }

    const sinceDate = sinceStartTime instanceof Date ? sinceStartTime : new Date(sinceStartTime);

    let records = await coll.find(
        {
            sessionID: sessionID,
            $or: [
                { lastModifiedTime: { $gt: sinceDate } },
                { lastModifiedTime: { $exists: false }, startTime: { $gt: sinceDate } },
                { deletedAt: { $gt: sinceDate } }
            ]
        },
        options
    ).sort({ lastModifiedTime: 1, startTime: 1 }).toArray();

    records = await Promise.all(records.map(record => applyEngineVersionUpdates(db, record)));

    if (records) {
        for (let i = 0; i < records.length; i++) {
            delete records[i]._id;
        }
    }

    return records;
}

export async function getIncompleteRecordsForSession(db, sessionID, pruneFields = true) {
    const coll = db.collection('records');
    let options = {};
    if (pruneFields) {
        options.projection = { recordID: 1, inputs: 1, output: 1, startTime: 1, executionTime: 1, eventsEmitted: 1, completionTime: 1, nodeInstanceID: 1, nodeType: 1, params: 1, context: 1, state: 1, waitingFor: 1, error: 1, deleted: 1, properties: 1, lastModifiedTime: 1, deletedAt: 1 };
    }

    let records = await coll.find(
        {
            sessionID: sessionID,
            deleted: { "$ne": true },
            state: { "$ne": "completed" }
        },
        options
    ).sort({ startTime: 1 }).toArray();

    records = await Promise.all(records.map(record => applyEngineVersionUpdates(db, record)));

    if (records) {
        for (let i = 0; i < records.length; i++) {
            delete records[i]._id;
        }
    }

    return records;
}

export async function getRecord(db, recordID) {
    const coll = db.collection('records');
    const query = {
        "recordID": recordID
    }
    let result = await coll.findOne(query);
    if (!result) {
        return null;
    }
    result = await applyEngineVersionUpdates(db, result);
    delete result._id;
    return result;
}

export async function getOldestPendingRecordForInputTypes(db, sessionID, inputTypes) {
  const coll = db.collection('records');
  let query = {
    "sessionID": sessionID,
    "state": "waitingForExternalInput",
    "deleted": { "$ne": true }
  }
  if (inputTypes) {
    // "waitingFor" is an array, use a mongodb query that checks if all of the inputTypes are in the waitingFor array
    query.waitingFor = { "$all": inputTypes };
  }
  const options = {
    sort: { startTime: 1 }
  }
  let result = await coll.findOne(query, options);
  if (!result) {
    return null;
  }
  result = await applyEngineVersionUpdates(db, result);
  delete result._id;
  return result;
}

async function getRecordsDownstreamOfRecord(db, recordID) {
    const coll = db.collection('records');
    const query = {
      "inputs": {
        "$elemMatch": {
          "recordID": recordID
        }
      },
      "deleted": { "$ne": true }
    };
    let result = await coll.find(query).toArray();
    if (!result || result.length == 0) {
      return null;
    }
    result = await Promise.all(result.map(record => applyEngineVersionUpdates(db, record)));
    return result;
}

export async function deleteRecord(db, startingRecordID) {
    console.error("deleteRecord: ", startingRecordID);

    async function collectDownstreamRecords(previousRecords, recordID) {
      let recordIDs = {...previousRecords};
      recordIDs[recordID] = true;

      let downstreamRecords =  await getRecordsDownstreamOfRecord(db, recordID);

      if (downstreamRecords && downstreamRecords.length > 0) {
        for (let i = 0; i < downstreamRecords.length; i++) {
            const downstreamRecordID = downstreamRecords[i].recordID;
            if (!recordIDs[downstreamRecordID]) {
                recordIDs = {...recordIDs, ...await collectDownstreamRecords(recordIDs, downstreamRecordID)};
            }
        }
      }
    
      return recordIDs;
    }

    const recordIDsToDelete = await collectDownstreamRecords({}, startingRecordID);

    const recordIDsDeleted = Object.keys(recordIDsToDelete);
    for (let i = 0; i < recordIDsDeleted.length; i++) {
        await markRecordDeleted(db, recordIDsDeleted[i]);
    }
    console.error("Records downstream of record: ", startingRecordID, " are: ", JSON.stringify(recordIDsDeleted, null, 2));

    return recordIDsDeleted;
}
