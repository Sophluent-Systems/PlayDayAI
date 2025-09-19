import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';

import { replaceAppVersion } from '@src/backend/gameversions';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin} = await doAuthAndValidation('POST', req, res, ["service_editMode", "service_modifyGlobalPermissions"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    

    //
    // THE USER ALLOWED TO EDIT?
    //


    if (!req.body.gameID ||
      !req.body.gameID.length ||
      !req.body.versionName ||
       req.body.versionName.length == 0 ||
       !req.body.updatedFields) {
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


    try {
      const newVersionInfo = await replaceAppVersion(
          db, 
          req.body.gameID, 
          req.body.versionName,
          req.body.updatedFields
          );
      res.status(200).json(newVersionInfo);
      
    } catch(error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error updating version: ${error.message}`);
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