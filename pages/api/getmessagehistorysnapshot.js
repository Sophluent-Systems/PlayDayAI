import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { hasRight } from '@src/backend/accesscontrol';
import { getGameSession } from '@src/backend/gamesessions';
import { StateMachine } from '@src/backend/stateMachine/stateMachine';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ['service_editMode']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

    if (!req.body.sessionID ||
      !req.body.sessionID.length || 
      !req.body.gameID ||
      !req.body.gameID.length) {
        console.error("getmessagehistorysnapshot: invalid parameters - ", req.body)
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


    const hasViewSessionPermissions = await hasRight(acl, account.accountID, {resourceType: "game", resource: req.body.gameID, access: "game_viewUserSessions"})

    // Proceed with the rest of the function as before, replacing HTTP responses with WebSocket messages
    let session = await getGameSession(db, account.accountID, req.body.sessionID, hasViewSessionPermissions);
    if (!session) {
      console.log("Couldn't find session ", req.body.sessionID);
      res.status(400).json({ error: { message: `Session ${req.body.sessionID} could not be found.` }});
      return;
    }

    const stateMachine = new StateMachine( db, session);
    await stateMachine.load();

    const messages = stateMachine.exportAsMessageList({skipDeleted: true, sortNewestFirst: false, includeDebugInfo: hasViewSessionPermissions});

    if (!messages) {
      console.error("getmessagehistorysnapshot: No message history found")
      res.status(404).json({
        error: {
          message: 'Session not found',
        }
      });
      return;
    }

    //
    // WE HAVE THE MESSAGES
    //
    

    res.status(200).json({messages});
};
  

export default withApiAuthRequired(handle);