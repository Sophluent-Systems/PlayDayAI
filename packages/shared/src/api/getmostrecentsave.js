import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getMostRecentGameSessionForUser, generateSessionForSendingToClient } from '@src/backend/gamesessions';
import {getGameInfoByID, getGameInfoByUrl} from '@src/backend/games';
import { hasRight } from '@src/backend/accesscontrol';

async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_basicAccess"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
     

    //
    // THE USER ALLOWED TO ACCESS THE BACKEND
    //

    if ((!req.body.gameUrl || req.body.gameUrl.length === 0) && 
        (!req.body.gameID || req.body.gameID.length === 0)) {
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


    let gameID = req.body.gameID;
    if (!gameID && req.body.gameUrl) {
      gameInfo = await getGameInfoByUrl(db, req.body.gameUrl);
      if (!gameInfo) {
        res.status(403).json({
          error: {
            message: `Game ID ${gameID} could not be found.`,
          }
        });
        return;
      }
      gameID = gameInfo.gameID;
    }

    const { permissionsError }  = await validateRequiredPermissions(acl, account, 
      [
          {resourceType: "game", resource: gameID, access: "game_play"}
      ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }

    const canViewSource = await hasRight(acl, account.accountID, {resourceType: "game", resource: gameID, access: ["game_viewSource"]});


    let session = await getMostRecentGameSessionForUser(db, account.accountID, gameID, req.body.versionName, canViewSource);
    
    if (!session) {
      res.status(200).json({session: null});
      return;
    }

    //
    // WE HAVE THE SESSION
    //

    const hasEditrights = await hasRight(acl, account.accountID, {resourceType: "game", resource: gameID, access: ["game_edit"]});

    var clientSession = generateSessionForSendingToClient(session, hasEditrights);
    res.status(200).json({session: clientSession});
};


export default withApiAuthRequired(handle);