import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation, validateRequiredPermissions } from '@src/backend/validation';
import { getGameSession } from '@src/backend/gamesessions.js';

import { getRecord } from '@src/backend/records.js';
import { isArray } from 'lodash';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getNestedObjectProperty } from '@src/common/objects.js';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_editMode", "service_modifyGlobalPermissions"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }


    if (nullUndefinedOrEmpty(req.body.sessionID) ||
      nullUndefinedOrEmpty(req.body.recordID) ||
      nullUndefinedOrEmpty(req.body.field)) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }
    

    let session = await getGameSession(db, account.accountID, req.body.sessionID, true);
    if (!session) {
        console.log("Couldn't find session ", req.body.sessionID);
        res.status(404).json({
          error: {
            message: `Session ${req.body.sessionID} could not be found.`,
          }
        });
        return;
    }

    const { permissionsError }  = await validateRequiredPermissions(acl, account, 
    [
        {resourceType: "game", resource: session.gameID, access: "game_edit"}
    ]);

    if (permissionsError) {
      res.status(permissionsError.status).json({ error: { message: permissionsError.message } });
      return;
    }
    

    //
    // PARAMS LOOK GOOD
    //


    try {

      console.log("getdebuggerresponseinfo: field=", req.body.field)

      const record = await getRecord(db, req.body.recordID);

      let response = getNestedObjectProperty(record, req.body.field);

      console.error("response: ", response);

      res.status(200).json({ value: response });

  } catch (error) {
    console.error('getdebuggerresponseinfo failed: ', error)
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Error gettingdebugger info: ', error);
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