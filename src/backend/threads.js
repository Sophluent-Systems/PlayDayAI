
export async function threadClaimSession(db, sessionID, machineID, threadID, expirationTimeMS=120000) {
    try {
        const coll = db.collection('threads');
        const now = new Date();
        // if expiration time is set and expired, then set status to expired
        let query = { sessionID: sessionID };
        const existingEntry = await coll.findOne(query);

        // If there's an existing entry, ensure the status isn't "active",
        // or the last active time has expired
        if (existingEntry) {
            if (existingEntry.status == 'active') {
                const expirationTime = new Date(existingEntry.lastActiveTime.getTime() + expirationTimeMS);
                if (expirationTime > now) {
                    return false;
                }
            }
        }
        
        query = { sessionID: sessionID, status: { $ne: 'active' }};
        const update = { $set: { status: 'active', sessionID, machineID, threadID, lastActiveTime: now } };
        // upsert if it doesn't exist
        const options = { upsert: true, returnDocument: 'after' };
        const result = await coll.findOneAndUpdate(query, update, options);
        // return true if that succeeded
        if (result && result.threadID == threadID) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('threadClaimSession: Error claiming session: ', error);
        return false;
    } 
}

export async function threadHeartbeat(db, sessionID) {
    try {
        const coll = db.collection('threads');
        const query = { sessionID: sessionID };
        const update = { $set: { lastActiveTime: new Date() } };
        const options = { returnOriginal: false };
        const result = await coll.findOneAndUpdate(query, update, options);
        return result;
    } catch (error) {
        console.error('threadHeartbeat: Error updating thread heartbeat: ', error);

        // Throw it so we bail out of the worker
        throw error;
    } 
}

export async function threadSetInactive(db, sessionID) {
    try {
        const coll = db.collection('threads');
        const query = { sessionID: sessionID };
        // just delete the entry
        const update = { $set: { status: "inactive" } };
        const options = { returnOriginal: false };
        const result = await coll.findOneAndUpdate(query, update, options);
        return result;
    } catch (error) {
        console.error('threadUpdateStatus: Error updating thread status: ', error);

        // Throw it so we bail out of the worker
        throw error;
    } 
}

export async function invalidateAllThreadsForMachine(db, machineID) {
    try {
        const coll = db.collection('threads');
        const query = { machineID: machineID };
        const update = { $set: { status: "inactive" } };
        const options = { returnOriginal: false };
        const result = await coll.updateMany(query, update, options);
        return result;
    } catch (error) {
        console.error('invalidateAllThreadsForMachine: Error updating thread status: ', error);
        return null;
    } 
}

export async function threadGetActiveSessionList(db) {
    try {
        const coll = db.collection('threads');
        const query = { status: 'active' };
        const options = { sort: { lastActiveTime: 1 } };
        const result = await coll.find(query, options).toArray();
        return result;
    } catch (error) {
        console.error('threadGetActiveSessionList: Error getting active sessions: ', error);
        return null;
    } 
}
