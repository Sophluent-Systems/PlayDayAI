console.error("INIT: server.mjs");

// env.js needs to be first to load environment variables
import { env } from './env.mjs';
import * as WebSocket from 'ws';
import { listenForTasks } from './src/server/workerThreads/listener.js';
import { Constants } from "@src/common/defaultconfig";
import { doAuthAndValidationToken, validateRequiredPermissions } from '@src/backend/validation.js';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { attachWebSocketToBridge, detachWebSocketFromBridge, getSessionBridge } from './src/server/sessionBridgeManager.js';
import { getAllThreadsForMachine, deleteAllThreadsForMachine, threadSetInactive } from './src/server/threads.js';
import { MongoClient } from 'mongodb';
import { getMachineIdentifier } from './src/server/machineid';
import { StateMachine } from './src/server/stateMachine/stateMachine.js';
import { deleteTasksForThreadID, deleteTasksForSession, enqueueNewTask, notifyServerOnTaskQueued } from '@src/backend/tasks';
import { hasRight } from '@src/backend/accesscontrol.js';
import { getGameSession } from '@src/backend/gamesessions.js';
import { sendSessionCommandIfActive } from '@src/backend/sessionCommands';
import { resolveWebsocketInfo } from '@src/backend/websocket';
import { applyUserInputToPendingRecord } from '@src/backend/userinput';

console.log("INIT: environment");

const machineID = await getMachineIdentifier();

async function initializeConnectionAndSubscribeForTaskUpdates({ db, session, wsChannel, hasViewSourcePermissions }) {
  Constants.debug.logTaskSystem && console.error("initializeConnectionAndSubscribeForTaskUpdates: session=", session.sessionID, " wsChannel=", wsChannel.clientID);

  attachWebSocketToBridge(session.sessionID, wsChannel);

  const wsConnectionCallbacks = {
    onError: (error) => {
      console.error('WebSocket error', error);
      detachWebSocketFromBridge(session.sessionID, wsChannel);
    },
    onClose() {
      console.error('WebSocket closed');
      detachWebSocketFromBridge(session.sessionID, wsChannel);
    }
  }

  wsChannel.requireSynchronization();

  wsChannel.setConnectionCallbacks(wsConnectionCallbacks);

  Constants.debug.logTaskSystem && console.error(`initializeConnectionAndSubscribeForTaskUpdates: Callbacks initialized`);

  //
  // Messages are queuing up... that's good.  Avoids a race condition where a new message
  // is spawned AFTER syncing the history, but BEFORE the proxy is set up.
  //

  const stateMachine = new StateMachine(db, session);
  await stateMachine.load();

  Constants.debug.logTaskSystem && console.error("initializeConnectionAndSubscribeForTaskUpdates: Loaded state machine");
 
  const messages = stateMachine.exportAsMessageList({
    skipDeleted: true,
    sortNewestFirst: false,
    includeDebugInfo: hasViewSourcePermissions,
    includeFailed: true,
    includeWaitingForExternalInput: true,
  });

  Constants.debug.logTaskSystem && console.error("initializeConnectionAndSubscribeForTaskUpdates: Got messages");

  await wsChannel.initializeAndSendMessageHistory(messages);

  Constants.debug.logWebSockets && console.error(`WS: Messages synced`);

  wsChannel.sendCommand("initcomplete", "success");
}

async function clearStaleEntries() {
  const mongoClient = new MongoClient(process.env.MONGODB_URL, {});
  try {
    await mongoClient.connect();
    const db = mongoClient.db("pd");

    // get all threads for this machine
    const threads = await getAllThreadsForMachine(db, machineID);

    Constants.debug.logInit && console.log("Clearing stale threads for this machine: ", threads.map(t => t.threadID));

    if (threads && threads.length > 0) {
      for(let thread of threads) {
        Constants.debug.logInit && console.error("Clearing stale tasks for thread:", thread.threadID);
        await deleteTasksForThreadID(db, thread.threadID);
      }
    }

    await deleteAllThreadsForMachine(db, machineID);
  } catch (err) {
    console.error("Failed to clear stale entries:", err);
  } finally {
    await mongoClient.close(); // Ensure the client is closed in the finally block
  }
}

// handleHalt
async function handleHalt(params) {
  const { db, channel, payload } = params;
  const { sessionID } = payload;

  await deleteTasksForSession(db, sessionID);

  const bridge = getSessionBridge(sessionID);
  bridge.sendCommand("stateMachineCommand", { command: "halt" });

  await channel.sendCommand("statemachinestatusupdate", {state: "completed", result: "halted", sessionID: sessionID});

  return { success: true };
}

async function handleContinuation(params) {
  const { db, channel, payload, account, acl } = params;
  const { sessionID, singleStep, seed, forceReassign } = payload || {};

  if (!sessionID) {
    await channel.sendCommand("error", { status: 'error', message: 'Continuation request missing sessionID' });
    return { success: false };
  }

  const session = await getGameSession(db, account.accountID, sessionID, false);

  if (!session) {
    await channel.sendCommand("error", { status: 'error', message: `Session ${sessionID} could not be found.` });
    return { success: false };
  }

  const { permissionsError } = await validateRequiredPermissions(acl, account,
    [
      { resourceType: "game", resource: session.gameInfo.gameID, access: "game_play" }
    ]);

  if (permissionsError) {
    await channel.sendCommand("error", { status: 'error', message: permissionsError.message });
    return { success: false };
  }

  if (forceReassign) {
    try {
      await threadSetInactive(db, sessionID);
      await db.collection('tasks').updateMany(
        { sessionID, status: 'processing' },
        {
          $set: {
            status: 'queued',
            machineID: null,
            threadID: null,
            expirationTime: new Date(),
          }
        }
      );
    } catch (error) {
      console.error(`[worker ${machineID}] Failed to force reassign session ${sessionID}`, error);
    }
  }

  await sendSessionCommandIfActive(
    db,
    sessionID,
    "stateMachineCommand",
    { command: "continuation" }
  );

  const taskParams = {
    seed: typeof seed === "number" ? seed : -1,
    singleStep: singleStep === true
  };

  const queuedTask = await enqueueNewTask(db, account.accountID, sessionID, "continuation", taskParams);

  await notifyServerOnTaskQueued();

  await channel.sendCommand("continuationAccepted", {
    sessionID,
    taskID: queuedTask?.taskID ?? null,
    websocket: resolveWebsocketInfo(),
  });

  return { success: true };
}

async function handleUserInput(params) {
  const { db, channel, payload, account, acl } = params;
  const { sessionID, nodeInstanceID, mediaTypes, inputMode } = payload || {};

  if (!sessionID) {
    await channel.sendCommand("userInputError", { status: 'error', message: 'User input request missing sessionID' });
    return { success: false };
  }

  if (!nodeInstanceID) {
    await channel.sendCommand("userInputError", { status: 'error', message: 'User input request missing nodeInstanceID', sessionID });
    return { success: false };
  }

  try {
    const session = await getGameSession(db, account.accountID, sessionID, false);

    if (!session) {
      await channel.sendCommand("userInputError", { status: 'error', message: `Session ${sessionID} could not be found.`, sessionID });
      return { success: false };
    }

    const { permissionsError } = await validateRequiredPermissions(acl, account,
      [
        { resourceType: "game", resource: session.gameInfo.gameID, access: "game_play" }
      ]);

    if (permissionsError) {
      await channel.sendCommand("userInputError", { status: 'error', message: permissionsError.message, sessionID });
      return { success: false };
    }

    if (!session.versionInfo.published) {
      const isAllowedAccessToUnpublishedVersions = await hasRight(acl, account.accountID, { resourceType: "game", resource: session.gameInfo.gameID, access: ["game_viewSource"] });

      if (!isAllowedAccessToUnpublishedVersions) {
        await channel.sendCommand("userInputError", { status: 'error', message: 'You do not have permission to access this game version.', sessionID });
        return { success: false };
      }
    }

    await applyUserInputToPendingRecord({
      db,
      session,
      account,
      nodeInstanceID,
      mediaTypes,
      Constants,
      inputMode,
    });

    await channel.sendCommand("userInputAccepted", { status: 'ok', sessionID, nodeInstanceID, inputMode });

    return { success: true };
  } catch (error) {
    console.error('[ws userInput] failed to process user input', error);
    await channel.sendCommand("userInputError", { status: 'error', message: error.message, sessionID, nodeInstanceID });
    return { success: false };
  }
}

export async function startServer() {

    Constants.debug.logInit && console.error("INIT: startServer");
  
    const wsPort = parseInt(process.env.WS_LOCAL_PORT ?? process.env.NEXT_PUBLIC_WS_PORT, 10) || 3005;
  
    const wsHandlers = {
      "halt": handleHalt,
      "continuation": handleContinuation,
      "userInput": handleUserInput,
    };
  
    Constants.debug.logInit && console.error("CLEARING STALE ENTRIES");

    await clearStaleEntries();

    Constants.debug.logInit && console.error("REGISTERING WEBSOCKET ENDPOINTS");

    const wss = new WebSocket.WebSocketServer({ port: wsPort});

    Constants.debug.logInit && console.error("CONFIGURING WEBSOCKET CALLBACKS");
    
    wss.on('connection', function connection(ws) {

      console.error("New WS connection");

      let initialized = false;
      let wsChannel = new WebSocketChannel(null, null, true, true);

      wsChannel.connect({existingConnection: ws});

      const handlers = {
        "command": async (command, message) => {
          try {
            const { accessToken, type, payload } = message;
  
            if (!type) {
              console.error("No message type provided in request: ", message);
              if (ws.readyState === WebSocket.OPEN) {
                await wsChannel.sendCommand("error", "No message type provided");
              }
              return;
            }

            console.error("## New WS command: ", type);

            if (!accessToken) {
              // return no access and close the connection
              await wsChannel.sendCommand("error", "No access token provided");
              if (!initialized) {
                console.error("Closing connection [1]");
                ws.close();
              }
              return;
            }
            
            const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidationToken(accessToken);
  
            if (validationError) {
              console.error("Validation error:", validationError);
              if (validationError.status === 403) {
                await wsChannel.sendCommand("authError", { status: 'authError', message: validationError.message });
              } else {
                await wsChannel.sendCommand("error", { status: 'error', message: validationError.message });
              }
              if (!initialized) {
                console.error("Closing connection [2]");
                ws.close();
              }
              return;
            }

            //
            // SPECIAL CASE - FIRST TIME INITIALIZATION
            // (by this point, authenticated)
            //
                      
            if (type === 'initializeConnection') {

              const { gameID, sessionID } = payload;

              try {
                // Special -- set this late now that we have it
                wsChannel.sessionID = sessionID;

                const hasViewSourcePermissions = await hasRight(acl, account.accountID, {resourceType: "game", resource: gameID, access: "game_viewSource"});

                const session = await getGameSession(db, account.accountID, sessionID, hasViewSourcePermissions);
                if (!session) {
                  console.error(`User ${account.accountID} does not have permission to access this session: ${sessionID}`);
                  await wsChannel.sendCommand("error", `You do not have permission to access this session`);
                  console.error("Closing connection [4]");
                  ws.close();
                  return;
                }

                await initializeConnectionAndSubscribeForTaskUpdates({ db, session, wsChannel, hasViewSourcePermissions });
                  Constants.debug.logWebSockets && console.error(`WS: subscribed for updates`);
                  Constants.debug.logWebSockets && console.error(`WS: sessionStatusUpdate: processing`);
                  await wsChannel.sendCommand("sessionStatusUpdate", {state: "processing", sessionID: sessionID});
              } catch (error) {
                console.error('Error initializing connection:', error);
                await wsChannel.sendCommand("error", `Error initializing connection: ${error}`);
                console.error("Closing connection [5]");
                ws.close();
                return;
              }

              initialized = true;
              return;
            }
              
            if (!initialized) {
              await wsChannel.sendCommand("error", 'Connection not initialized' );
              console.error("Closing connection [3]");
              ws.close();
              return;
            }

            
            const handler = wsHandlers[type];
  
            if (!handler) {
              console.error(`No handler for message type: ${type}`);
              wsChannel.sendCommand("error", { status: 'error', message: `Invalid request type: ${type}` });
            }
  
            Constants.debug.logTaskSystem && console.error('WebSocket message received: type=', type);
  
            const params = { db, user, acl, account, isAdmin, payload, channel: wsChannel };
  
            return await handler(params);
  
          } catch (error) {
            console.error('WebSocket message error:', error);
            wsChannel.sendCommand("error", { status: 'error', message: `Error processing request: ${error}` });
          }
        }
      }

      Constants.debug.logInit && console.error("SUBSRIBING WEBSOCKET HANDLERS");

      wsChannel.subscribe(handlers);


      //
      // Websocket init complete
      //
    });



    Constants.debug.logInit && console.error("Starting task listener");

    listenForTasks()
    .catch((error) => {
      console.error('Task scheduler error:', error);
    });

    Constants.debug.logInit && console.error("Server is listening on port:", wsPort);
}
  
  
// Register global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Unhandled Exception:', error);
  // Consider gracefully shutting down the server/process here
});

// Register global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Handle or log the rejection here
});

try {
  await startServer();
} catch (error) {
  console.error('Server startup error:', error);
  // Consider gracefully shutting down the server/process here
}

Constants.debug.logInit && console.error(" --> Server started <--");
