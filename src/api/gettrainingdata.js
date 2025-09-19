import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';

import { getLLMTrainingData } from '@src/backend/aiLogging.js';

async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_basicAccess"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
  

    if (!req.body.gameID) {
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
        {resourceType: "game", resource: {gameID: req.body.gameID}, access: "game_viewTrainingData"}
    ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }

    //
    // WE HAVE AN ACCOUNT AND THE USER IS AN EDITOR
    //


    const trainingData = await getLLMTrainingData(db, req.body.gameID, req.body.filters);
    res.status(200).json(trainingData);
};
  

export default withApiAuthRequired(handle);