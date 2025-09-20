import piscina from './piscinaSetup.js';
import { RabbitMQPubSubChannel } from '@src/common/pubsub/rabbitmqpubsub.js';
import { Constants } from "@src/common/defaultconfig";
import { getMongoDb } from '@src/backend/mongodb.js';
import { threadGetActiveSessionList } from '../threads.js';
import { PrettyDate } from '@src/common/date.js';
import { enqueueNewTask } from '@src/backend/tasks';


async function printActiveThreads(db) {

  console.log("*********************************************")
  console.log("*************  ACTIVE THREADS  **************")
  console.log("*********************************************")

  try {
    const activeSessions = await threadGetActiveSessionList(db);


    if (activeSessions && activeSessions.length > 0) {
      activeSessions.map((session) => {
        console.error(`[${session.machineID}:${session.threadID}]  sessionID ${session.sessionID}  status ${session.state}  lastActiveTime ${PrettyDate(session.lastActiveTime)}`);
      });
    } else {
      console.log("[No active threads]");
    }
    
  }
  catch (error) {
    console.log("Error printing active threads: ", error);
  }

  console.log("*********************************************")
  console.log("*********************************************")
  console.log("*********************************************")
}


async function getSessionsThatNeedWork(db) {
  const currentTime = new Date();
  
  // First, delete expired tasks
  await db.collection('tasks').deleteMany({
    status: 'queued',
    expirationTime: { $lt: currentTime }
  });

  // Get all test runs that need work using an aggregation pipeline
  const pipeline = [
    {
      $lookup: {
        from: 'tasks',
        localField: 'sessionID', 
        foreignField: 'sessionID',
        as: 'associatedTasks'
      }
    },
    // just match them no matter what if the sessionID matches
    {
      $match: {
        sessionID: { $exists: true }
      }
    },
    {
      $project: {
        sessionID: 1,  
        associatedTasks: 1,
        state: 1
      }
    }
  ];

  const sessions = await db.collection('sessions').aggregate(pipeline).toArray();

  let sessionsThatNeedWork = [];
  let createTaskPromises = [];

  // Create new tasks for test runs that need them
   sessions.forEach(run => {
      if (run.state !== 'completed' && run.state !== 'halted') { 
        const associatedTask = run.associatedTasks[0];
        
        if (!associatedTask || associatedTask.status === 'complete' || (associatedTask.status === 'queued' && (associatedTask.expirationTime <= currentTime))) {
          console.log("Creating new task for sessionID: ", run.sessionID);
          sessionsThatNeedWork.push(run.sessionID);
          createTaskPromises.push(enqueueNewTask({ db, sessionID: run.sessionID }));
        } else if (associatedTask && associatedTask.status == 'queued' && (associatedTask.expirationTime > currentTime)) {
          console.log("Found session with pending task: ", run.sessionID);
          sessionsThatNeedWork.push(run.sessionID);
        }
      }
   });

  await Promise.all(createTaskPromises);

  if (sessionsThatNeedWork.length > 0) {
    console.log("Found sessions that need work: ", sessionsThatNeedWork);
  }

  return sessionsThatNeedWork;
}


async function processSessionsThatNeedWork() {

  const db = await getMongoDb("sensei");

  const sessionsWithWork = await getSessionsThatNeedWork(db);

  if (sessionsWithWork && sessionsWithWork.length > 0) {
    for (let i = 0; i < sessionsWithWork.length; i++) {
      const sessionID = sessionsWithWork[i];
      console.log("Found session with pending tasks: ", sessionID);
      piscina.run({ sessionID });
    }
  }

  printActiveThreads(db);
}

export async function listenForTasks() {

  Constants.debug.logTaskSystem && console.log("listenForTasks: Connecting to RabbitMQ");

  const channel = new RabbitMQPubSubChannel('taskQueue', 'taskQueue');
  let retrying = false;

  channel.setConnectionCallbacks({
    onError: (error) => {
      console.error('Main taskQueue channel experienced an error:', error);
      channel.close();
      if (!retrying) {
        retrying = true;
        console.error("Reconnecting to RabbitMQ");
        // On failure try again in 30 seconds
        setTimeout(listenForTasks, 30000);
      }
    },
    onClosed: () => {
      console.error('Main taskQueue channel closed');
      channel.close();
      if (!retrying) {
        retrying = true;
        console.error("Reconnecting to RabbitMQ");
        // On failure try again in 30 seconds
        setTimeout(listenForTasks, 30000);
      }
    },
  });
  
  channel.connect().then(() => {

    const handlers = {
      "newTask": (command, payload) => {
        console.log("Received new task command: ", payload);
        processSessionsThatNeedWork();
      }
    };
    channel.subscribe(handlers);   
  
    processSessionsThatNeedWork();
  
    Constants.debug.logTaskSystem && console.log("listenForTasks: Listening for tasks");
    return true; // Return true to indicate success
  })
  .catch((error) => {
    console.error("Failed to connect to RabbitMQ:", error);
    if (!retrying) {
      retrying = true;
      // On failure try again in 30 seconds
      setTimeout(listenForTasks, 30000);
    }
    return false;
  });
  
}



process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully');
  await piscina.destroy();
  await closeMongoConnection();
});