import { withApiAuthRequired } from '@src/backend/auth';
import { addGameVersion, getGameVersionDetails } from '@src/backend/gameversions';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';



export async function insertNewGameVersion(db, gameID, versionName, prototypeVersionName=null) {
  let initialState = {}

  if (prototypeVersionName) {
    initialState = await getGameVersionDetails(db, gameID, prototypeVersionName, true);
    if (!initialState) {
      throw new Error(`Prototype version ${prototypeVersionName} not found.`);
    }
  } 

  initialState = {
    ...initialState,
    published: false,
  }

  return await addGameVersion(db, gameID, versionName, initialState);
}

async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_editMode"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

    //
    // CHECK PARAMS
    //


    if (!req.body.gameID ||
      req.body.gameID.length == 0 ||
      !req.body.versionName ||
      req.body.versionName.length == 0) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }
    
    //
    // GET GAME INFO
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
    // THIS USER IS ALLOWED TO EDIT THIS GAME
    //

   


    try {

      let prototype = null;
      if (req.body.prototypeVersionName) {
        prototype = await getGameVersionDetails(db, req.body.gameID, req.body.prototypeVersionName, true);
        if (!prototype) {
          throw new Error(`Prototype version ${req.body.prototypeVersionName} not found.`);
        }
      }

      const infoToReturn = await addGameVersion(db, req.body.gameID, req.body.versionName, prototype);

      res.status(200).json(infoToReturn);
      
    } catch(error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error creating game version: ${error.message}`);
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