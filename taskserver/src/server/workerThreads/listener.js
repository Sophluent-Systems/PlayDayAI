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
  
  // Unique sessions with at least one task that is queued or expired
  const pipeline = [
    {
      $match: {
        $and: [
          { status: { $ne: "complete" } }, // Always exclude 'complete' status
          {
            $or: [
              { status: "queued" }, // Include if status is 'queued'
              { expirationTime: { $lt: currentTime } } // Or include if the task has expired
            ]
          }
        ]
      }
    },

    {
      $group: {
        _id: "$sessionID" // Group by sessionID to get unique sessionIDs
      }
    },
    {
      $project: {
        _id: 0, // Exclude the default _id field
        sessionID: "$_id" // Include the sessionID in the output

      }
    }
  ];

  const result = await db.collection('tasks').aggregate(pipeline).toArray();

  console.error("Query results for sessions with work: ", JSON.stringify(result, null, 2));

  return result;
}


async function processSessionsThatNeedWork() {

  const db = await getMongoDb("pd");

  const sessionsWithWork = await getSessionsThatNeedWork(db);

  if (sessionsWithWork && sessionsWithWork.length > 0) {
    for (let i = 0; i < sessionsWithWork.length; i++) {
      const sessionID = sessionsWithWork[i];
      console.error("Found session with pending tasks: ", sessionID);
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