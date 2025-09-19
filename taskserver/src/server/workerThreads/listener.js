import piscina from './piscinaSetup.js';
import { openPubSubChannel } from '@src/common/pubsub/pubsubapi.js';
import { Constants } from "@src/common/defaultconfig";
import { getMongoClient } from '@src/backend/mongodb.js';
import { threadGetActiveSessionList } from '../threads.js';
import { PrettyDate } from '@src/common/date.js';


async function printActiveThreads(db) {

  console.error("*********************************************")
  console.error("*************  ACTIVE THREADS  **************")
  console.error("*********************************************")

  try {
    const activeSessions = await threadGetActiveSessionList(db);


    if (activeSessions && activeSessions.length > 0) {
      activeSessions.map((session) => {
        console.error(`[${session.machineID}:${session.threadID}]  sessionID ${session.sessionID}  status ${session.status}  lastActiveTime ${PrettyDate(session.lastActiveTime)}`);
      });
    } else {
      console.error("[No active threads]");
    }
    
  }
  catch (error) {
    console.error("Error printing active threads: ", error);
  }

  console.error("*********************************************")
  console.error("*********************************************")
  console.error("*********************************************")
}


async function getSessionsWithPendingTasks(db) {
  const currentTime = new Date(); // Current time for comparing expiration

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

  return result;
}

async function processSessionsThatNeedWork() {
  console.error("Processing sessions that need work.")

  const mongoClient = await getMongoClient();
  const db = mongoClient.db("pd");

  const sessionsWithWork = await getSessionsWithPendingTasks(db);
  console.log("Pending tasks: ", sessionsWithWork);

  if (sessionsWithWork && sessionsWithWork.length > 0) {
    for (let i = 0; i < sessionsWithWork.length; i++) {
      const sessionID = sessionsWithWork[i].sessionID;
      console.log("Found session with pending tasks: ", sessionID);
      piscina.run({ sessionID });
    }
  }

  printActiveThreads(db);
}

async function reconnectToRabbitMQ() {
  console.log("Reconnecting to RabbitMQ");
  await listenForTasks();
}

export async function listenForTasks() {

  try {
 
    const channel = await openPubSubChannel('taskQueue', 'taskQueue');

    channel.setConnectionCallbacks({
      onError: (error) => {
        console.error('Main taskQueue channel experienced an error:', error);
        channel.close();
        channel = null;
        reconnectToRabbitMQ();
      },
      onClosed: () => {
        console.error('Main taskQueue channel closed');
        channel.close();
        channel = null;
        reconnectToRabbitMQ();
      },
    });
    
    const handlers = {
      "newTask": (command, payload) => {
        console.log("Received new task command: ", payload);
        processSessionsThatNeedWork();
      }
    };

    channel.subscribe(handlers);

    Constants.debug.logTaskSystem && console.log("Listening for new tasks.");
    return true; // Return true to indicate success
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error);
    // try again afer 30 seconds
    setTimeout(listenForTasks, 30000);
    return false; // Return false to indicate failure
  }
}



process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully');
  await piscina.destroy();
  await closeMongoConnection();
});