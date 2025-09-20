import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getGameInfoByUrl } from '@src/backend/games.js';
import { 
  initializeNewGameSession, 
  saveGameSession, 
 } from '@src/backend/gamesessions.js';
import { getBestPublishedVersionForGame, getGameVersionDetails } from '@src/backend/gameversions';
import { notifyServerOnTaskQueued } from '@src/backend/tasks';
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


    if (!req.body.gameUrl 
        || req.body.gameUrl.length === 0 
        ) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
    }
    
    //
    // PARAMS LOOK GOOD
    //

    const gameInfo = await getGameInfoByUrl(db, req.body.gameUrl);
    if (!gameInfo) {
        console.log("Couldn't find the game ", req.body.gameUrl);
        res.status(500).json({
          error: {
            message: `${req.body.gameUrl} game could not be found.`,
          }
        });
    }


    const { permissionsError }  = await validateRequiredPermissions(acl, account, 
      [
          {resourceType: "game", resource: gameInfo.gameID, access: "game_play"}
      ]);


      if (permissionsError) {
        res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
        return;
      }

    //
    // WE HAVE AN ACCOUNT FOR THE USER
    //

    //
    // WE HAVE A THE GAME DESCRIPTION
    //

    const canViewSource = await hasRight(acl, account.accountID, {resourceType: "game", resource: gameInfo.gameID, access: ["game_viewSource"]});


    var gameVersion = null;
    if (req.body.versionName) {
      gameVersion = await getGameVersionDetails(db, gameInfo.gameID, req.body.versionName, canViewSource);
    } else {
      gameVersion = await getBestPublishedVersionForGame(db, gameInfo.gameID, gameInfo.primaryVersion, canViewSource);
    }

    if (!gameVersion) {
        console.log("Couldn't find a good published game version for ", req.body.gameUrl);
        res.status(500).json({
          error: {
            message: `${req.body.gameUrl} game version could not be found.`,
          }
        });
        return;
    }

    if (!gameVersion.published && !canViewSource) {
        // Not allowed to play
        console.log("User ", account.accountID, " is not allowed to play ", gameInfo.gameID, " version ", gameVersion.versionName);
        res.status(403).json({
          error: {
            message: `${user.sub} is not allowed to access the service.`,
          }
        });
        return;
     }


    //
    // WE HAVE THE GAME VERSION TO PLAY
    //


    try {
      const session = await initializeNewGameSession(db, gameInfo.gameID, gameVersion.versionID, account.accountID);

      await saveGameSession(db, session, account.accountID);

      var sessionToReturn = {...session};
      
      sessionToReturn.versionInfo = gameVersion;

      res.status(200).json(sessionToReturn);

    } catch(error) {
      console.error("Error starting new game", error);
      res.status(500).json({
      error: {
          message: 'Error starting game',
      },
      });
    }
};
  

export default withApiAuthRequired(handle);