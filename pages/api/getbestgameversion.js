import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { getGameInfoByID } from '@src/backend/games';
import { getBestPublishedVersionForGame } from '@src/backend/gameversions';



async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions", "service_editMode"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    if (!req.body.gameID ||
      req.body.gameID.length == 0) {
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
    // WE HAVE AN ACCOUNT
    //

    const gameInfo = await getGameInfoByID(db, req.body.gameID);
    if (!gameInfo) {
      res.status(403).json({
        error: {
          message: `Game ID ${gameID} could not be found.`,
        }
      });
      return;
    }

    if (gameInfo.creatorAccountID != account.accountID && !isAdmin) {
      res.status(403).json({
        error: {
          message: `You are not allowed to edit this game.`,
        }
      });
      return;
    }

    //
    // THIS USER IS ALLOWED TO EDIT THIS GAME
    //


    try {
      const version = await getBestPublishedVersionForGame(db, req.body.gameID, null, true)
      res.status(200).json(version);
      
    } catch(error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error listing game versions: ${error.message}`);
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