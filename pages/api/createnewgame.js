import { withApiAuthRequired } from '@src/backend/auth';
import { initGameACLs } from '@src/backend/accesscontrol';
import { createNewGame } from '@src/backend/games.js';
import { doAuthAndValidation } from '@src/backend/validation';

import { insertNewGameVersion } from './addgameversion';



async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions", "service_editMode"]);

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }
    
    //
    // THE USER ALLOWED TO EDIT?
    //


    if (!req.body.gameUrl ||
      req.body.gameUrl.length == 0 ||
      !req.body.title ||
       req.body.title.length == 0) {
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

    //
    // WE HAVE AN ACCOUNT AND THE USER IS ALLOWED
    //

    try {
        const newGameInfo = await createNewGame(db, req.body.gameUrl, req.body.title, account.accountID);

        await initGameACLs(acl, newGameInfo);

        await insertNewGameVersion(db, newGameInfo.gameID, "v1");

        res.status(200).json(newGameInfo);
        
      } catch(error) {
        if (error.response) {
          console.error(error.response.status, error.response.data);
          res.status(error.response.status).json(error.response.data);
        } else {
          console.error(`Error creating game: ${error.message}`);
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