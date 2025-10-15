import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getGameSession } from '@src/backend/gamesessions';
import { getGameInfoByID } from '@src/backend/games';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getRecord, deleteRecord } from '@src/backend/records';
import { hasRight } from '@src/backend/accesscontrol';
import { enqueueNewTask, notifyServerOnTaskQueued } from '@src/backend/tasks';
import { enqueueSessionCommand, getActiveSessionMachine, sendSessionCommandIfActive } from '@src/backend/sessionCommands';
import { resolveWebsocketInfo } from '@src/backend/websocket';

async function handle(req, res) {
  const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

  const { sessionID, startingRecordID, singleStep } = req.body;

    if (nullUndefinedOrEmpty(sessionID) ||
      nullUndefinedOrEmpty(startingRecordID)) {
        console.log("Delete message -> Invalid parameters: ", sessionID, " ", startingRecordID);
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }
    
    //
    // PARAMS LOOK GOOD
    //

    var session = await getGameSession(db, account.accountID, sessionID, false);
    if (sessionID) {
        if (!session) {
            console.log("Couldn't find session ", sessionID);
            res.status(404).json({
              error: {
                message: `Session ${sessionID} could not be found.`,
              }
            });
            return;
        }
    } 
  
    //
    // WE HAVE A GAME SESSION
    //

    
    const { permissionsError }  = await validateRequiredPermissions(acl, account, 
    [
        {resourceType: "game", resource: session.gameInfo.gameID, access: "game_play"}
    ]);
    
    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }


    const hasEditrights = await hasRight(acl, account.accountID, {resourceType: "game", resource: session.gameID, access: ["game_edit"]});


    const gameInfo = await getGameInfoByID(db, session.gameID);
    if (!gameInfo) {
      res.status(403).json({
        error: {
          message: `Game ID ${gameID} could not be found.`,
        }
      });
      return;
    }


    try {
      let seed = -1;

      //
      // Validate the request
      //   - if the item is already deleted, invalid parameters
      //   - if the item didn't fail, the user needs to have edit rights
      //
      const record = await getRecord(db, startingRecordID);

      if (!record) {
        console.error("retryrecord: Couldn't find record ", startingRecordID);
        res.status(404).json({
          error: {
            message: `Record ${startingRecordID} could not be found.`,
          }
        });
        return;
      }

      if (record.deleted) {
        console.log("retryrecord: Record already deleted ", startingRecordID);
        res.status(400).json({
          error: {
            message: `Record ${startingRecordID} has already been deleted.`,
          }
        });
        return;
      }

      if (!record.error && !hasEditrights) {
        console.log("retryrecord: User does not have edit rights to retry successful record ", startingRecordID);
        res.status(403).json({
          error: {
            message: `You need edit rights to do that.`,
          }
        });
        return;
      }

      if (typeof record.context?.seed == 'number') {
        seed = record.context.seed;
      }

      const recordIDsDeleted = await deleteRecord(db, startingRecordID);

      console.error("recordIDsDeleted: ", recordIDsDeleted);

      if (recordIDsDeleted && recordIDsDeleted.length > 0) {
        const activeInfo = await getActiveSessionMachine(db, sessionID);
        await enqueueSessionCommand(
          db,
          sessionID,
          'message:delete',
          { recordIDsDeleted },
          { target: 'client', machineID: activeInfo?.machineID ?? null }
        );
      }

      //
      // Submit task to the task queue to kick off processing, using
      // the same seed as the original task
      //
      let taskParams = {
        seed: seed,
        singleStep: (typeof singleStep != 'undefined') ? singleStep : false,
      };

      const newTask = await enqueueNewTask(db, account.accountID, sessionID, "continuation", taskParams);
      
      await notifyServerOnTaskQueued();

      await sendSessionCommandIfActive(
        db,
        sessionID,
        'stateMachineCommand',
        { command: 'continuation' }
      );

      res.status(200).json({
        status: "success",
        sessionID,
        taskID: newTask?.taskID ?? null,
        websocket: resolveWebsocketInfo(),
        recordIDsDeleted: recordIDsDeleted ?? [],
      });
      
    } catch(error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error deleting messages: ${error} ${error.stack}`);
        res.status(500).json({
          error: {
            message: 'An error occurred during your request.',
          }
        });
        return;
      }
    }
};
  

export default withApiAuthRequired(handle);
