export async function enqueueSessionCommand(db, sessionID, command, data, options = {}) {
  if (!db) {
    throw new Error('enqueueSessionCommand: db handle is required');
  }
  if (!sessionID) {
    throw new Error('enqueueSessionCommand: sessionID is required');
  }
  if (!command) {
    throw new Error('enqueueSessionCommand: command is required');
  }

  const now = new Date();
  const doc = {
    sessionID,
    command,
    data: data ?? {},
    status: 'pending',
    machineID: options.machineID ?? null,
    target: options.target ?? 'worker',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('sessionCommands').insertOne(doc);
  return doc;
}

export async function getActiveSessionMachine(db, sessionID) {
  if (!db) {
    throw new Error('getActiveSessionMachine: db handle is required');
  }

  const threadsCollection = db.collection('threads');
  const activeThread = await threadsCollection.findOne({ sessionID, status: 'active' });

  if (!activeThread) {
    return null;
  }

  return {
    machineID: activeThread.machineID,
    threadID: activeThread.threadID,
  };
}

export async function sendSessionCommandIfActive(db, sessionID, command, data) {
  if (!db) {
    throw new Error('sendSessionCommandIfActive: db handle is required');
  }

  const active = await getActiveSessionMachine(db, sessionID);

  if (!active) {
    return { queued: false };
  }

  await enqueueSessionCommand(db, sessionID, command, data, { machineID: active.machineID });

  return { queued: true, machineID: active.machineID, threadID: active.threadID };
}
