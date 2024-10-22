import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { deleteGameSession } from '@src/backend/gamesessions.js';



async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ['service_modifyGlobalPermissions']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

    //
    // THE USER ALLOWED TO ACCESS THE BACKEND
    //


    if (!req.body.sessionID
        || req.body.sessionID.length == 0
        ) {
          console.log("Invalid parameters", JSON.stringify(req.body));
          res.status(400).json({ error: { message: 'Invalid parameters' }});
          return;
    }
    
    //
    // PARAMS LOOK GOOD
    //


    //
    // WE HAVE AN ACCOUNT FOR THE USER
    //

    console.log("deleting game session: ", req.body.sessionID);

    const result = await deleteGameSession(db, account.accountID, req.body.sessionID);
    if (!result) {
        res.status(404).json({
            error: {
              message: `Session ${req.body.sessionID} could not be found.`,
            }
          });
          return;
    }

    res.status(200).json({result: true});
};
  

export default withApiAuthRequired(handle);