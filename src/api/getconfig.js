import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { getConstants } from '@src/backend/config';

async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin, accessToken } = await doAuthAndValidation('GET', req, res, ['service_basicAccess', 'service_guestAccess']);

    if (validationError) {
      console.error("Validation error in api/getconfig: ", validationError);
      res.status(validationError.status).json({account: account, error: { message: validationError.message } });
      return;
    }
    
    //
    // USER IS ALLOWED
    //

    try {
    
        //
        // THE USER ALLOWED TO ACCESS THE BACKEND
        //

        // Get 'constants.mjs' from the settings DB
        const Constants = await getConstants(db);
        res.status(200).json({ Constants: Constants, error: null});

    } catch (error) {
        
        console.error("Error in api/getconfig: ", error);
        res.status(500).json({ error: { message: error.message } });
    }
}

export default withApiAuthRequired(handle);