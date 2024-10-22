import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { updateGameInfo } from '@src/backend/games.js';



async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_editMode", "service_modifyGlobalPermissions"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    //
    // THE USER ALLOWED TO EDIT?
    //

    if (!req.body.gameInfo ||
      !req.body.gameInfo.gameID ||
      !req.body.gameInfo.gameID.length) {
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
          {resourceType: "game", resource: req.body.gameInfo.gameID, access: "game_edit"}
      ]);

  if (permissionsError) {
    res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
    return;
  }

    //
    // Only admins can modify featuredIndex
    //

    if (!isAdmin && req.body.gameInfo.featuredIndex) {
      delete req.body.gameInfo.featuredIndex;
    }

    //
    // WE HAVE AN ACCOUNT AND THE USER IS ALLOWED
    //


    try {
      const newGameInfo = await updateGameInfo(db, req.body.gameInfo, account.accountID, isAdmin);
      res.status(200).json(newGameInfo);
      
    } catch(error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error updating game: ${error.message}`);
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