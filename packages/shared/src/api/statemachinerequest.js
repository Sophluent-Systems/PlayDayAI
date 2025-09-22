import { enqueueNewTask, notifyServerOnTaskQueued } from '@src/backend/tasks';
import { getGameSession } from '@src/backend/gamesessions';
import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { hasRight } from '@src/backend/accesscontrol';
import { SessionPubSubChannel } from '@src/common/pubsub/sessionpubsub';

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

  const { requestType, sessionID, seed, singleStep } = req.body;

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
    
    let workerChannel = new SessionPubSubChannel(sessionID);
    await workerChannel.connect();

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

    // First, attempt to send the request to an active worker

    const stateMachineParams = {
      seed: typeof seed == "number" ? seed : -1,
      singleStep: singleStep
    }

    // give this command up to 1sec to be acknowledged
    const acknowledgement = await workerChannel.sendCommand("stateMachineCommand", { command: stateMachineCommand }, { awaitAck: true, timeoutMs: 500 });

    const successfullyNotifiedWorker = acknowledgement && acknowledgement?.acknowledged;
    const processorIsRunning = acknowledgement?.result;
    
  if (successfullyNotifiedWorker && processorIsRunning) {
    console.error("   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
    console.error("   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
    console.error("   ^^ CAUGHT A CASE WHERE WE WOULD HAVE DOUBLE-PROCESSED^^^");
    console.error("   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
    console.error("   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
  }

    if ((!successfullyNotifiedWorker || !processorIsRunning) && requestType != "halt") {

      // 
      // Submit task to the task queue
      //

      let taskParams = {
        seed: typeof seed == "number" ? seed : -1,
        singleStep: singleStep
      };

      const newTask = await enqueueNewTask(db, account.accountID, sessionID, requestType, taskParams);

      notifyServerOnTaskQueued();

      result = {
        taskID: newTask.taskID
      };

      if (newRecord) {
        result.record = newRecord;
      }
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error processing statemachine request: ", error, "\n", error.stack);
    throw error;
  }
};
  


export default withApiAuthRequired(handle);
