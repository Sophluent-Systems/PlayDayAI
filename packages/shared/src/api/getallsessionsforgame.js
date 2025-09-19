import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { getAllSessionsForGameEditor } from '@src/backend/gamesessions.js';



async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions", "service_editMode"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    if (!req.body.gameID ||
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


    if (typeof req.body.accountID !== 'undefined' && req.body.accountID !== null && req.body.accountID.length > 0) {
      if (req.body.accountID != account.accountID && !isAdmin) {
        res.status(403).json({ error: { message: 'You do not have permission to view sessions for this account.' } });
        return;
      }
    }
    
    //
    // WE HAVE AN ACCOUNT AND THE USER IS AN EDITOR
    //

    const savesList = await getAllSessionsForGameEditor(db, req.body.gameID, req.body.versionID, req.body.accountID, isAdmin);
    res.status(200).json(savesList);
};
  

export default withApiAuthRequired(handle);