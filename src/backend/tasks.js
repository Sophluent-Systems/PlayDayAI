import { v4 as uuidv4 } from 'uuid';
import { Config } from "@src/backend/config";

export class Task {
    constructor(db, { taskID, queueTime, startTime, completeTime, expirationTime, executionTime, status, sessionID, threadID, machineID, accountID, params }) {
        this.db = db;
        this.taskID = taskID;
        this.queueTime = queueTime;
        this.startTime = startTime;
        this.completeTime = completeTime;
        this.executionTime = executionTime;
        this.expirationTimeout = expirationTime;
        this.status = status;
        this.sessionID = sessionID;
        this.threadID = threadID;
        this.machineID = machineID;
        this.accountID = accountID;
        this.params = params;
    }

    async resetExpirationTime() {
        const coll = this.db.collection('tasks');
        const query = { taskID: this.taskID };
        const update = { $set: { expirationTime: new Date(this.queueTime.getTime() + this.expirationTimeout) } };
        await coll.updateOne(query, update);
    }

    async setComplete() {
        const coll = this.db.collection('tasks');
        const query = { taskID: this.taskID };
        const now = new Date();
        const executionTime = now.getTime() - (new Date(this.startTime)).getTime();
        const update = { $set: { status: 'complete', completeTime: now, executionTime: executionTime } };
        await coll.updateOne(query, update);
    }

    getParams() {
        return {accountID: this.accountID, threadID: this.threadID, machineID: this.machineID, sessionID: this.sessionID, ...this.params, }
    }
}


export async function enqueueNewTask(db, accountID, sessionID, requestType, params, expirationTimeMS=120000) {
    try {
        const coll = db.collection('tasks');

        if (requestType == 'continuation') {
            //
            // Check if there's an existing task for the same session that hasn't
            // completed. Even though this isn't "atomic", it's OK since
            // this means there was a continuation "live" at the time
            // the client requested a new continuation.
            //

            const existingTaskCondition = {
                sessionID: sessionID,
                completeTime: null
            };

            // Check if a matching document exists
            const existingTask = await coll.findOne(existingTaskCondition);
            if (existingTask) {
                return existingTask;
            }
        }

        const newTask = {
            taskID: uuidv4(),
            sessionID: sessionID,
            queueTime: new Date(),
            startTime: null,
            completeTime: null,
            executionTime: null,
            expirationTimeout: expirationTimeMS,
            expirationTime: null,
            status: 'queued',
            threadID: null,
            machineID: null,
            accountID: accountID,
            requestType: requestType,
            params
        }

        await coll.insertOne(newTask);
        return newTask;
    } catch (error) {
        console.error('Error adding task: ', error);
        throw error;
    } 
}

async function claimNewTask(db, sessionID, machineID, threadID) {
    const { Constants } = Config;
    
    try {
        const coll = db.collection('tasks');
        const query = { status: 'queued', sessionID: sessionID };
        const now = new Date();
        // expiration will be reset within a minute to the requested time
        const temporaryExpirationTime = new Date(now.getTime() + Constants.config.taskDefaultExpirationTimeMS);
        const update = { $set: { status: 'processing', machineID, threadID, startTime: now, expirationTime: temporaryExpirationTime } };
        const options = { sort: { queueTime: 1 }, returnOriginal: false };
        const result = await coll.findOneAndUpdate(query, update, options);
        // If we found a task, update it with the expiration time
        if (result) {
            let newTask = new Task(db, result);
            newTask.resetExpirationTime();
            return newTask;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error claiming task: ', error);
        return null;
    } 
}

async function claimExpiredTask(db, sessionID, machineID, threadID) {
    try {
        const coll = db.collection('tasks');
        const now = new Date();
        // if expiration time is set and expired, then set status to expired
        const query = { status: 'processing', expirationTime: { $lt: new Date() }, sessionID: sessionID };
        const update = { $set: { status: 'processing', machineID, threadID, startTime: now } };
        const options = { sort: { queueTime: 1 }, returnOriginal: false };
        const result = await coll.findOneAndUpdate(query, update, options);
        // If we found a task, update it with the expiration time
        if (result) {
            let newTask = new Task(db, result);
            newTask.resetExpirationTime();
            return newTask;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error claiming task: ', error);
        return null;
    } 
}

export async function claimTask(db, sessionID, machineID, threadID) {
    try {
        let task =  await claimExpiredTask(db, sessionID, machineID, threadID);
        if (!task) {
            task = await claimNewTask(db, sessionID, machineID, threadID);
        }
        return task;
    } catch (error) {
        console.error('Error claiming task: ', error);
        throw error;
    } 
}

