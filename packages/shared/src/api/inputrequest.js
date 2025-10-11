import { enqueueNewTask, notifyServerOnTaskQueued } from '@src/backend/tasks';
import { getGameSession } from '@src/backend/gamesessions';
import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getOldestPendingRecordForInputTypes, updateRecord } from '@src/backend/records';
import { hasRight } from '@src/backend/accesscontrol';
import { messageFromRecord, getNodeByInstanceID } from '@src/backend/messageHistory';
import { enqueueSessionCommand, getActiveSessionMachine } from '@src/backend/sessionCommands';
import { resolveWebsocketInfo } from '@src/backend/websocket';

const validRequestTypes = [
  "input",
]

const supportedInputTypes = [
  "text",
  "audio",
  "image",
  "video",
]




const handler = withApiAuthRequired(async (req, res) => {
  console.info("inputrequest: received request", {
    method: req.method,
    hasFiles: Boolean(req.files),
    bodyKeys: Object.keys(req.body || {}),
  });
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
    console.info("inputrequest: file payload detected", Object.keys(req.files));
    for (let i=0; i<supportedInputTypes.length; i++) {
      const type = supportedInputTypes[i];
      if (req.files[type] && req.files[type].length > 0) {
          if (!Constants.supportedMimeTypes.includes(req.files[type][0].mimetype)) {
            console.error(`statemachinerequest Invalid parameters -- unsupported MIME type: ${req.files[type][0].mimetype}`);
            res.status(400).json({ error: { message: `Invalid parameter -- unsupported MIME type: ${req.files[type][0].mimetype}` } });
            return;
          }
          const buffer = req.files[type][0].buffer;
          const base64data = buffer ? buffer.toString('base64') : undefined;
          if (!base64data) {
            console.error("inputrequest: missing audio buffer for type", type);
            res.status(400).json({ error: { message: 'Invalid parameter -- missing media buffer' }});
            return;
          }
          mediaTypes[type] = {
            mimeType: req.files[type][0].mimetype,
            data: base64data,
            source: 'base64'
          };
          console.info("inputrequest: captured media attachment", {
            type,
            mimeType: mediaTypes[type].mimeType,
            bytes: buffer?.length ?? 0,
          });
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
    //
    // If input was reported, write a record
    //
    
    let result = {};

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

      const nodeInstance = getNodeByInstanceID(session.versionInfo, nodeInstanceID);

      if (!nodeInstance) {
        console.error("statemachinerequest Invalid parameters -- nodeInstanceID not found: ", nodeInstanceID);
        res.status(400).json({ error: { message: 'Invalid parameter - nodeIntanceID not found' }});
        return;
      }

      console.info("inputrequest: mediaTypes received", mediaTypes);

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
      const updatedUserMessage = messageFromRecord(session.versionInfo, pendingRecord);
      const activeInfo = await getActiveSessionMachine(db, sessionID);
      await enqueueSessionCommand(
        db,
        sessionID,
        'message:full',
        updatedUserMessage,
        { target: 'client', machineID: activeInfo?.machineID ?? null }
      );

    }

    if (requestType != "halt") {
      // Always enqueue a task so an idle or restarted worker will resume the session.

      // 
      // Submit task to the task queue
      //

      let taskParams = {
        seed: typeof seed == "number" ? seed : -1,
        singleStep: isSingleStepRequest
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

    result.sessionID = sessionID;
    result.websocket = resolveWebsocketInfo();

    res.status(200).json(result);
    return;
  } catch (error) {
    console.error("Error processing input request: ", error);
    res.status(500).json({ error: { message: 'Error processing input request', detail: error?.message }});
    return;
  }

});

export default handler;
