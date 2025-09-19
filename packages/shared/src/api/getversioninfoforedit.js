import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getGameVersionDetails } from '@src/backend/gameversions';
import { hasRight } from '@src/backend/accesscontrol';
import { getNestedObjectProperty, setNestedObjectProperty, nullUndefinedOrEmpty } from '@src/common/objects';

async function handle(req, res) {
  const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ["service_editMode"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
  
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
    // PARAMS LOOK GOOD
    //


    const { permissionsError }  = await validateRequiredPermissions(acl, account,  
      [
          {resourceType: "game", resource: req.body.gameID, access: "game_viewSource"}
      ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }
    


    const versionDetails = await getGameVersionDetails(db, req.body.gameID, req.body.versionName, true);
    
    const hasEditPermission = await hasRight(acl, account.accountID, {resourceType: "game", resource: req.body.gameID, access: "game_edit"})

    // If we don't have source edit permission, we need to clear some fields
    if (!hasEditPermission) {

      if (versionDetails?.stateMachineDescription?.nodes && versionDetails?.stateMachineDescription?.nodes.length > 0) { 
        for (let i = 0; i < versionDetails.stateMachineDescription.nodes.length; i++) {
          let node = versionDetails.stateMachineDescription.nodes[i];
          Constants.privateVersionFields.forEach(field => {
              if (!nullUndefinedOrEmpty(getNestedObjectProperty(node, field))) {
                setNestedObjectProperty(node, field, "****************");
              }
          });
        }
      }
       
    }

    res.status(200).json(versionDetails);
};
  

export default withApiAuthRequired(handle);