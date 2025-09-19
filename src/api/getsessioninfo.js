import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { getGameSession, generateSessionForSendingToClient } from '@src/backend/gamesessions.js';
import { hasRight } from '@src/backend/accesscontrol';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_basicAccess"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

    if (!req.body.sessionID ||
      !req.body.sessionID.length || 
      !req.body.gameID ||
      !req.body.gameID.length) {
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

    const session = await getGameSession(db, account.accountID, req.body.sessionID, hasViewSessionPermissions);
    if (!session) {
      res.status(404).json({
        error: {
          message: 'Session not found',
        }
      });
      return;
    }

    //
    // WE HAVE THE SESSION
    //
    

    var clientSession = generateSessionForSendingToClient(session, hasViewSessionPermissions);
    res.status(200).json({session: clientSession});
};
  

export default withApiAuthRequired(handle);