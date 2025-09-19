import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getGameVersionList } from '@src/backend/gameversions';

import { getGameInfoByUrl } from '@src/backend/games';
import { hasRight } from '@src/backend/accesscontrol';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_basicAccess"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    //
    // WE HAVE AN ACCOUNT
    //

    if ((!req.body.gameID ||
      req.body.gameID.length == 0) &&
      (!req.body.gameUrl ||
        req.body.gameUrl.length == 0)) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }
    
    let gameID = req.body.gameID;
    if (!gameID && req.body.gameUrl) {
      const gameInfo = await getGameInfoByUrl(db, req.body.gameUrl);
      if (!gameInfo) {
        console.log("Couldn't find the game ", req.body.gameUrl);
        res.status(403).json({
          error: {
            message: `Game ID ${gameID} could not be found.`,
          }
        });
        return;
      }
      gameID = gameInfo.gameID;
    }


    //
    // PARAMS LOOK GOOD
    //

    const { permissionsError }  = await validateRequiredPermissions(acl, account,
    [
        {resourceType: "game", resource: gameID, access: "game_play"}
    ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }

    const isAllowedAccessToUnpublishedVersions = await hasRight(acl, account.accountID, {resourceType: "game", resource: gameID, access: ["game_viewSource"]});

    //
    // THIS USER IS ALLOWED TO EDIT THIS GAME
    //

    const onlyPublished = req.body.onlyPublished || !isAllowedAccessToUnpublishedVersions;

    //console.log("Listing game versions:")
    //console.log("    isAllowedAccessToUnpublishedVersions: ", isAllowedAccessToUnpublishedVersions);
    //console.log("    req.body.onlyPublished: ", req.body.onlyPublished);
    //console.log("    onlyPublished: ", onlyPublished);

    try {

      const versionList = await getGameVersionList(db, gameID, onlyPublished);
      res.status(200).json(versionList);
      
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