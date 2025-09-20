import { v4 as uuidv4 } from 'uuid';
import { Config } from "@src/backend/config";
import { RabbitMQPubSubChannel } from '@src/common/pubsub/rabbitmqpubsub';

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
        const now = new Date();
        const coll = this.db.collection('tasks');
        const query = { taskID: this.taskID };
        const update = { $set: { expirationTime: new Date(now.getTime() + this.expirationTimeout) } };
        await coll.updateOne(query, update);
    }

    async setComplete() {
        const coll = this.db.collection('tasks');
        const query = { taskID: this.taskID };
        await coll.deleteOne(query);
    }

    getParams() {
        return {accountID: this.accountID, threadID: this.threadID, machineID: this.machineID, sessionID: this.sessionID, ...this.params, }
    }
}


export async function enqueueNewTask(db, accountID, sessionID, requestType, params, expirationTimeMS=120000) {
    try {
        const coll = db.collection('tasks');

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

        const now = new Date();
        
        const newTask = {
            sessionID: sessionID,
            taskID: uuidv4(),
            queueTime: now,
            startTime: null,
            completeTime: null,
            executionTime: null,
            expirationTimeout: expirationTimeMS,
            expirationTime: new Date(now.getTime() + expirationTimeMS),
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

export async function notifyServerOnTaskQueued() {
    try {
        //
        // Signal the work queue to process the task; OK to do async
        //
        console.log("Notifying server that there's a new task")

        const taskChannel = new RabbitMQPubSubChannel('taskQueue', 'taskQueue');
        await taskChannel.connect();
  
        taskChannel.sendCommand("newTask", "ready");

    } catch (error) {
        console.error('Error notifying server on task queued: ', error);
        throw error;
    } 
}

export async function deleteTasksForThreadID(db, threadID) {
    try {
        const coll = db.collection('tasks');
        const query = { threadID };
        await coll.deleteMany(query);
    } catch (error) {
        console.error('Error deleting tasks for thread ID: ', error);
        throw error;
    } 
}

export async function deleteTasksForSession(db, sessionID) {
    try {
        const coll = db.collection('tasks');
        const query = { sessionID };
        await coll.deleteMany(query);
    } catch (error) {
        console.error('Error deleting tasks for session: ', error);
        throw error;
    } 
}