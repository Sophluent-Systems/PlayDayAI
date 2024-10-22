import { enqueueNewTask } from '@src/backend/tasks';
import { openPubSubChannel } from '@src/common/pubsub/pubsubapi';
import { getGameSession } from '@src/backend/gamesessions';
import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import multer from 'multer';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getOldestPendingRecordForInputTypes, updateRecord } from '@src/backend/records';
import { hasRight } from '@src/backend/accesscontrol';
import { StateMachine } from '@src/backend/stateMachine/stateMachine';
import { createRouter } from "next-connect";
import { addBlobToStorage } from '@src/backend/blobstorage';

const validRequestTypes = [
  "input",
]

const supportedInputTypes = [
  "text",
  "audio",
  "image",
  "video",
]


export const config = {
  api: {
    bodyParser: false,
  },
};


const router = createRouter();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10000000, // 10 MB
  },
});

const uploadFields = supportedInputTypes.map(type => ({ name: type, maxCount: 1 }));
const uploadMiddleware = upload.fields(uploadFields);

router.use(uploadMiddleware);

router.post(withApiAuthRequired(async (req, res) => {
  
  const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    console.error("Validation error:", validationError);
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    
  const { sessionID, nodeInstanceID, requestType, text, seed, singleStep } = req.body;

  const isSingleStepRequest = (singleStep && (singleStep != 'false'));

  let mediaTypes = {};

  if (req.files) {
    for (let i=0; i<supportedInputTypes.length; i++) {
      const type = supportedInputTypes[i];
      if (req.files[type] && req.files[type].length > 0) {
          if (!Constants.supportedMimeTypes.includes(req.files[type][0].mimetype)) {
            console.error(`statemachinerequest Invalid parameters -- unsupported MIME type: ${req.files[type][0].mimetype}`);
            res.status(400).json({ error: { message: `Invalid parameter -- unsupported MIME type: ${req.files[type][0].mimetype}` } });
            return;
          }
          const base64data = req.files[type][0].buffer.toString('base64');
          const storageID = await addBlobToStorage(db, base64data, type, req.files[type][0].mimetype, account.accountID, sessionID);
          mediaTypes[type] = {
            mimeType: req.files[type][0].mimetype,
            data: storageID,
            source: 'storage'
          };
      }
    }
  }
  if (text) {  // Assuming `text` is a field for text data
      // If the text field is empty (''), only add it if there are no other media types
      if (Object.keys(mediaTypes).length > 0 || text !== '') {
        mediaTypes.text = {
            mimeType: 'text',
            data: text,
            source: 'text'
        };
      }
  }

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
    const workerChannel = await openPubSubChannel(`session_${sessionID}`, sessionID);

    //
    // If input was reported, write a record
    //
    
    let result = {};
    let stateMachineCommand = null;

    let newRecord = null;
    if (requestType == "input") {

      if (nullUndefinedOrEmpty(nodeInstanceID)) {

        console.error("statemachinerequest Invalid parameters -- missing nodeInstanceID: ", req.body);
        res.status(400).json({ error: { message: 'Invalid parameter - missing nodeIntanceID' }});
        return;
      }

      if (typeof mediaTypes != "object") {
        console.error("statemachinerequest Invalid parameters -- missing mediaTypes: ", req.body);
        res.status(400).json({ error: { message: 'Invalid parameter - missing mediaTypes' }});
        return;
      }

      const stateMachine = new StateMachine( db, session);
      await stateMachine.load();

      const nodeInstance = stateMachine.getNodeByInstanceID(nodeInstanceID);

      if (!nodeInstance) {
        console.error("statemachinerequest Invalid parameters -- nodeInstanceID not found: ", nodeInstanceID);
        res.status(400).json({ error: { message: 'Invalid parameter - nodeIntanceID not found' }});
        return;
      }

      console.error("inputrequest: Media types: ", mediaTypes)

      const inputTypes = Object.keys(mediaTypes);

      inputTypes.forEach((inputType) => {
        if (!supportedInputTypes.includes(inputType)) {
          console.error(`statemachinerequest Invalid parameters -- unsupported input type: ${inputType}`);
          res.status(400).json({ error: { message: `Invalid parameter -- unsupported input type: ${inputType}` }});
          return;
        }
        
        const typeIsSupported = (nodeInstance.nodeType != 'externalTextInput') ? nodeInstance.params.supportedTypes.includes(inputType) : inputType == "text";
        if (!typeIsSupported) {
          console.error(`statemachinerequest Invalid parameter -- input type ${inputType} not supported for node ${nodeInstance.instanceName}`);
          res.status(400).json({ error: { message: `Invalid parameter -- input type ${inputType} not supported for node ${nodeInstance.instanceName}` }});
          return;
        }
      }); 

      let pendingRecord = await getOldestPendingRecordForInputTypes(db, session.sessionID,  inputTypes);
      
      if (!pendingRecord) {
        console.error("statemachinerequest No pending record found for externalTextInput");
        res.status(400).json({ error: { message: 'The system was not expecting new text input from the user' }});
        return;
      }

      if (pendingRecord.state == "completed" || pendingRecord.state == "error") {
        console.error("statemachinerequest Invalid state for pending record: ", pendingRecord.state);
        res.status(400).json({ error: { message: 'Found a pending record, but it had the wrong state' }});
        return;
      }

      let eventsEmitted = ["completed"];

      inputTypes.forEach((inputType) => {
        eventsEmitted.push(`on_${inputType}`);
      });

      let recordUpdate = {
        eventsEmitted: eventsEmitted,
        output: {},
        completionTime: new Date(), 
        pending: false, 
        state: "completed"
      };

      inputTypes.forEach((inputType) => {
        if (inputType == "text") {
          let finalText = mediaTypes[inputType].data;

          const userTokenLimit =  nodeInstance.params.tokenLimit;
        
          // truncate finalTextInput to obey the user token limit
          if (!nullUndefinedOrEmpty(userTokenLimit) && (finalText.length > userTokenLimit)) {
            finalText = finalText.substring(0, userTokenLimit);
          }

          // ["text"]["text"] - one for the output pin, one for the media type
          recordUpdate.output["text"] ={
            "text": finalText
          };

          // text will be the default output

          recordUpdate.output["result"] ={
            "text": finalText
          };

        } else {
          // [inputType][inputType] - one for the output pin, one for the media type
          recordUpdate.output[inputType] = {};
          recordUpdate.output[inputType][inputType] = mediaTypes[inputType];
        }
      });

      // Update the record, ensuring that the record's state is still "pending"
      await updateRecord(db, pendingRecord.recordID, recordUpdate, pendingRecord.state);

      pendingRecord = {...pendingRecord, ...recordUpdate};

      //
      // Send the new user message to any listening websocket listeners
      //
      const updatedUserMessage = stateMachine.messageFromRecord(pendingRecord);
      await workerChannel.sendFullMessage(updatedUserMessage);

      stateMachineCommand = "continuation";

    }

    // First, attempt to send the request to an active worker

    const stateMachineParams = {
      seed: typeof seed == "number" ? seed : -1,
      singleStep: isSingleStepRequest
    }

    // give this command up to 1sec to be acknowledged
    const acknowledgement = await workerChannel.sendCommand("stateMachineCommand", {command: stateMachineCommand}, 500);

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
        singleStep: isSingleStepRequest
      };

      const newTask = await enqueueNewTask(db, account.accountID, sessionID, requestType, taskParams);

      //
      // Signal the work queue to process the task; OK to do async
      //
      const taskChannel = await openPubSubChannel('taskQueue', 'taskQueue');

      taskChannel.sendCommand("newTask", "ready");
      Constants.debug.logTaskSystem && console.error("[next] Sent 'New Task Available' to taskQueue channel.");

      result = {
        taskID: newTask.taskID
      };

      if (newRecord) {
        result.record = newRecord;
      }
    }

    res.status(200).json(result);
    return;
  } catch (error) {
    console.error("Error processing input request: ", error);
    res.status(500).json({ error: { message: 'Error processing input request' }});
    return;
  }

}));

export default router.handler({
  onError: (err, req, res, next) => {
    console.error(err.stack)
    res.status(500).end("Server Error: "+ err.message)
  },
  onNoMatch: (req, res) => {
    res.status(404).end("Not found")
  },
});