import { enqueueNewTask, notifyServerOnTaskQueued } from '@src/backend/tasks';
import { getGameSession } from '@src/backend/gamesessions';
import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { hasRight } from '@src/backend/accesscontrol';
import { sendSessionCommandIfActive } from '@src/backend/sessionCommands';
import { resolveWebsocketInfo } from '@src/backend/websocket';
import { threadSetInactive } from '../../../../taskserver/src/server/threads.js';

const validRequestTypes = [
  "continuation",
  "halt",
]

async function handle(req, res) {

  const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    console.error("Validation error:", validationError);
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

  const { requestType, sessionID, seed, singleStep, forceReassign } = req.body;

  if (!requestType || !validRequestTypes.includes(requestType) || nullUndefinedOrEmpty(sessionID)) {
      console.error("statemachinerequest Invalid parameters: ", req.body);
      res.status(400).json({ error: { message: 'Invalid parameters' }});
    return;
  }


  // Proceed with the rest of the function as before, replacing HTTP responses with WebSocket messages
  let session = await getGameSession(db, account.accountID, sessionID, false);
  if (sessionID && !session) {
    console.error("Couldn't find session ", sessionID);
    res.status(400).json({ error: { message: `Session ${sessionID} could not be found.` }});
    return;
  }

  const { permissionsError }  = await validateRequiredPermissions(acl, account, 
    [
        {resourceType: "game", resource: session.gameInfo.gameID, access: "game_play"}
    ]);


  if (permissionsError) {
    console.error("Permissions error: ", permissionsError);
    res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
    return;
  }

  if (!session.versionInfo.published) {
      
    const isAllowedAccessToUnpublishedVersions = await hasRight(acl, account.accountID, {resourceType: "game", resource: session.gameInfo.gameID, access: ["game_viewSource"]});

    if (!isAllowedAccessToUnpublishedVersions) {
      console.error("User does not have permission to access unpublished game versions");
      res.status(403).json({ error: { message:`You do not have permission to access this game version.` } });
      return;
    }
  }


  try {
    
    //
    // If input was reported, write a record
    //
    
    let result = {};
    let stateMachineCommand = null;

    let newRecord = null;
    if (requestType == "continuation") {

      stateMachineCommand = "continuation";

    } else if (requestType == "halt") {

      stateMachineCommand = "halt";
    }

    if (stateMachineCommand === "halt") {
      await sendSessionCommandIfActive(
        db,
        sessionID,
        "stateMachineCommand",
        { command: stateMachineCommand }
      );
    }

    if (requestType != "halt") {
      // Always enqueue the task so dormant sessions resume once a worker is available.

      // 
      // Submit task to the task queue
      //

      let taskParams = {
        seed: typeof seed == "number" ? seed : -1,
        singleStep: singleStep
      };

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
          console.error("statemachinerequest.forceReassign", error);
        }
      }

      const newTask = await enqueueNewTask(db, account.accountID, sessionID, requestType, taskParams);

      notifyServerOnTaskQueued();

      result = {
        taskID: newTask.taskID
      };

      if (newRecord) {
        result.record = newRecord;
      }
    }
    
    result.sessionID = sessionID;
    result.websocket = resolveWebsocketInfo();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error processing statemachine request: ", error, "\n", error.stack);
    throw error;
  }
};
  


export default withApiAuthRequired(handle);
