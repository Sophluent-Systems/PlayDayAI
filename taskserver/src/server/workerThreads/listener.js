import piscina from './piscinaSetup.js';
import { Constants } from '@src/common/defaultconfig';
import { getMongoDb, closeMongoConnection } from '@src/backend/mongodb.js';
import { threadGetActiveSessionList } from '../threads.js';
import { PrettyDate } from '@src/common/date.js';
import { getSessionBridge } from '../sessionBridgeManager.js';
import { getMachineIdentifier } from '../machineid.js';

let cachedMachineID = null;
let taskChangeStream = null;
let commandChangeStream = null;
let fallbackTimer = null;
let startingStreams = false;

const sessionsProcessing = new Set();
let taskResumeToken = null;
let commandResumeToken = null;
let pollingWarnLogged = false;

function getTaskSchedulerConfig() {
  return Constants.config?.taskScheduler ?? {};
}

async function ensureMachineID() {
  if (!cachedMachineID) {
    cachedMachineID = await getMachineIdentifier();
  }
  return cachedMachineID;
}

async function printActiveThreads(db) {
  if (!Constants.debug.logTaskSystem) {
    return;
  }

  console.log('*********************************************');
  console.log('*************  ACTIVE THREADS  **************');
  console.log('*********************************************');

  try {
    const activeSessions = await threadGetActiveSessionList(db);

    if (activeSessions && activeSessions.length > 0) {
      activeSessions.forEach((session) => {
        console.error(
          `[${session.machineID}:${session.threadID}]  sessionID ${session.sessionID}  status ${session.state}  lastActiveTime ${PrettyDate(session.lastActiveTime)}`
        );
      });
    } else {
      console.log('[No active threads]');
    }
  } catch (error) {
    console.log('Error printing active threads: ', error);
  }

  console.log('*********************************************');
  console.log('*********************************************');
  console.log('*********************************************');
}

async function getSessionsThatNeedWork(db, sessionIDs = null) {
  if (Array.isArray(sessionIDs) && sessionIDs.length > 0) {
    return [...new Set(sessionIDs.filter((id) => typeof id === 'string' && id.length > 0))];
  }

  const currentTime = new Date();

  const pipeline = [
    {
      $match: {
        $and: [
          { status: { $ne: 'complete' } },
          {
            $or: [
              { status: 'queued' },
              { expirationTime: { $lt: currentTime } },
            ],
          },
        ],
      },
    },
    {
      $group: {
        _id: '$sessionID',
      },
    },
    {
      $project: {
        _id: 0,
        sessionID: '$_id',
      },
    },
  ];

  const queryResult = await db.collection('tasks').aggregate(pipeline).toArray();
  const sessionIDArray = queryResult.map((result) => result.sessionID);

  Constants.debug.logTaskSystem &&
    console.error('Query results for sessions with work: ', JSON.stringify(sessionIDArray, null, 2));

  return sessionIDArray;
}

async function processSessionsThatNeedWork({ sessionIDs = null, db: providedDb = null } = {}) {
  const db = providedDb ?? (await getMongoDb('pd'));
  const sessionsWithWork = await getSessionsThatNeedWork(db, sessionIDs);

  if (!sessionsWithWork || sessionsWithWork.length === 0) {
    return;
  }

  for (const sessionID of sessionsWithWork) {
    if (!sessionID || sessionsProcessing.has(sessionID)) {
      continue;
    }

    sessionsProcessing.add(sessionID);
    const bridge = getSessionBridge(sessionID);

    try {
      if (bridge.hasActiveWorker()) {
        Constants.debug.logTaskSystem &&
          console.error(`[listener] Worker already active for session ${sessionID}`);
        continue;
      }

      let workerPort;
      try {
        workerPort = bridge.createWorkerPort();
      } catch (error) {
        console.error(`[listener] Failed to create worker port for session ${sessionID}`, error);
        continue;
      }

      const runPromise = piscina.run({ sessionID, port: workerPort }, { transferList: [workerPort] });
      bridge.notifyWorkerPromise(runPromise);
    } finally {
      sessionsProcessing.delete(sessionID);
    }
  }

  if (!sessionIDs && Constants.debug.logTaskSystem) {
    await printActiveThreads(db);
  }
}

async function processSessionCommands(providedDb = null) {
  const db = providedDb ?? (await getMongoDb('pd'));
  const machineID = await ensureMachineID();
  const collection = db.collection('sessionCommands');

  const claimableMachineFilter = [
    { machineID: { $exists: false } },
    { machineID: null },
    { machineID },
  ];

  for (let i = 0; i < 10; i++) {
    const claimCandidate = await collection.findOne(
      {
        status: 'pending',
        $or: claimableMachineFilter,
      },
      { sort: { createdAt: 1 } }
    );

    if (!claimCandidate) {
      break;
    }

    const updatedAt = new Date();
    const updateResult = await collection.updateOne(
      {
        _id: claimCandidate._id,
        status: 'pending',
      },
      {
        $set: {
          status: 'processing',
          machineID,
          updatedAt,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      continue;
    }

    const commandDoc = {
      ...claimCandidate,
      status: 'processing',
      machineID,
      updatedAt,
    };
    const bridge = getSessionBridge(commandDoc.sessionID);
    const target = commandDoc.target || 'worker';
    let sent = false;

    if (target === 'client') {
      bridge.sendToClient(commandDoc.command, commandDoc.data);
      sent = true;
    } else {
      sent = bridge.sendCommand(commandDoc.command, commandDoc.data);
    }

    if (sent) {
      await collection.updateOne(
        { _id: commandDoc._id },
        { $set: { status: 'sent', processedAt: new Date(), machineID } }
      );
    } else {
      await collection.updateOne(
        { _id: commandDoc._id },
        {
          $set: {
            status: 'pending',
            machineID: commandDoc.machineID ?? machineID,
            updatedAt: new Date(),
          },
          $inc: { retryCount: 1 },
        }
      );
      break;
    }
  }
}

async function handleTaskChange(change, db) {
  if (change?._id) {
    taskResumeToken = change._id;
  }

  const doc = change?.fullDocument;
  if (!doc || doc.status !== 'queued' || !doc.sessionID) {
    return;
  }

  await processSessionsThatNeedWork({ sessionIDs: [doc.sessionID], db });
}

async function handleCommandChange(change, db) {
  if (change?._id) {
    commandResumeToken = change._id;
  }

  const doc = change?.fullDocument;
  if (!doc || doc.status !== 'pending') {
    return;
  }

  await processSessionCommands(db);
}

async function stopChangeStreams() {
  const streams = [taskChangeStream, commandChangeStream];
  taskChangeStream = null;
  commandChangeStream = null;

  await Promise.all(
    streams
      .filter(Boolean)
      .map(async (stream) => {
        try {
          stream.removeAllListeners();
          await stream.close();
        } catch (error) {
          console.error('[listener] Error closing change stream', error);
        }
      })
  );
}

function stopFallbackPolling() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  pollingWarnLogged = false;
}

function startFallbackPolling() {
  if (fallbackTimer) {
    return;
  }

  const schedulerConfig = getTaskSchedulerConfig();
  const interval = schedulerConfig.pollingIntervalMS ?? 1000;
  if (schedulerConfig.logPolling && !pollingWarnLogged) {
    console.warn('[listener] Falling back to polling every', interval, 'ms');
    pollingWarnLogged = true;
  }

  fallbackTimer = setInterval(async () => {
    try {
      await processSessionsThatNeedWork();
      await processSessionCommands();

      const schedulerConfigInner = getTaskSchedulerConfig();
      const changeStreamsEnabled = schedulerConfigInner.enableChangeStreams !== false;

      if (
        changeStreamsEnabled &&
        !taskChangeStream &&
        !commandChangeStream &&
        !startingStreams
      ) {
        const db = await getMongoDb('pd');
        const started = await startChangeStreams(db);
        if (started) {
          stopFallbackPolling();
        }
      }
    } catch (error) {
      console.error('[listener] Polling loop error', error);
    }
  }, interval);
}

async function handleChangeStreamFailure(source, error) {
  console.error(`[listener] ${source} change stream error`, error);
  await stopChangeStreams();
  startFallbackPolling();
}

async function startChangeStreams(db) {
  const schedulerConfig = getTaskSchedulerConfig();
  const changeStreamsEnabled = schedulerConfig.enableChangeStreams !== false;
  if (!changeStreamsEnabled) {
    return false;
  }

  if (taskChangeStream || commandChangeStream) {
    return true;
  }

  if (startingStreams) {
    return false;
  }

  startingStreams = true;

  try {
    const machineID = await ensureMachineID();

    const tasksCollection = db.collection('tasks');
    const taskWatchOptions = {
      fullDocument: 'updateLookup',
    };
    if (taskResumeToken) {
      taskWatchOptions.resumeAfter = taskResumeToken;
    }
    taskChangeStream = tasksCollection.watch(
      [
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'replace'] },
            'fullDocument.status': 'queued',
          },
        },
      ],
      taskWatchOptions
    );

    taskChangeStream.on('change', (change) => {
      handleTaskChange(change, db).catch((error) => {
        console.error('[listener] Task change handler error', error);
      });
    });
    taskChangeStream.on('error', (error) => handleChangeStreamFailure('tasks', error));
    taskChangeStream.on('close', () => handleChangeStreamFailure('tasks', new Error('Change stream closed')));

    const commandsCollection = db.collection('sessionCommands');
    const commandWatchOptions = {
      fullDocument: 'updateLookup',
    };
    if (commandResumeToken) {
      commandWatchOptions.resumeAfter = commandResumeToken;
    }
    commandChangeStream = commandsCollection.watch(
      [
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'replace'] },
            'fullDocument.status': 'pending',
            $or: [
              { 'fullDocument.machineID': null },
              { 'fullDocument.machineID': machineID },
            ],
          },
        },
      ],
      commandWatchOptions
    );

    commandChangeStream.on('change', (change) => {
      handleCommandChange(change, db).catch((error) => {
        console.error('[listener] Session command handler error', error);
      });
    });
    commandChangeStream.on('error', (error) => handleChangeStreamFailure('sessionCommands', error));
    commandChangeStream.on('close', () =>
      handleChangeStreamFailure('sessionCommands', new Error('Change stream closed')),
    );

    stopFallbackPolling();
    return true;
  } catch (error) {
    console.error('[listener] Failed to start change streams', error);
    await stopChangeStreams();
    return false;
  } finally {
    startingStreams = false;
  }
}

export async function listenForTasks() {
  Constants.debug.logTaskSystem && console.log('listenForTasks: initializing event-driven scheduler');

  const db = await getMongoDb('pd');
  const schedulerConfig = getTaskSchedulerConfig();
  const changeStreamsEnabled = schedulerConfig.enableChangeStreams !== false;

  await processSessionsThatNeedWork({ db });
  await processSessionCommands(db);

  if (!changeStreamsEnabled) {
    if (schedulerConfig.logPolling && !pollingWarnLogged) {
      console.info('[listener] Task scheduler configured for polling mode');
      pollingWarnLogged = true;
    }
    startFallbackPolling();
    return;
  }

  const streamsStarted = await startChangeStreams(db);
  if (!streamsStarted) {
    startFallbackPolling();
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully');
  stopFallbackPolling();
  await stopChangeStreams();
  await piscina.destroy();
  await closeMongoConnection();
});
