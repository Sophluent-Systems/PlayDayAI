import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { Config } from "@src/backend/config";


async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin, accessToken, Constants } = await doAuthAndValidation('GET', req, res, ['service_basicAccess', 'service_guestAccess']);

    if (validationError) {
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

        res.status(200).json({ account: account, accessToken: accessToken, error: null});

    } catch (error) {
        
        console.error("Error in api/getaccountinfo: ", error);
        res.status(500).json({ error: { message: error.message } });
    }
}

export default withApiAuthRequired(handle);