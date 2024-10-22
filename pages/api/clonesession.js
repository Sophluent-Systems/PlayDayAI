import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { sessionClone } from '@src/backend/gamesessions.js';



async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_editMode", "service_modifyGlobalPermissions"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    if (!req.body.gameID ||
        !req.body.gameID.length ||
        !req.body.sessionID ||
        !req.body.sessionID.length) {
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



    const { permissionsError }  = await validateRequiredPermissions(acl, account,  
    [
        {resourceType: "game", resource: req.body.gameID, access: "game_edit"}
    ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }

    
    //
    // WE HAVE AN ACCOUNT AND THE USER IS AN EDITOR
    //

    // Copy the requested game session into a new session for the current user account

    const newSessionID = await sessionClone(db, req.body.sessionID, account.accountID, null);
    res.status(200).json({sessionID: newSessionID});
};
  

export default withApiAuthRequired(handle);