// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { lookupAccount } from '@src/backend/accounts';



async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('GET', req, res, ["service_basicAccess", "service_guestAccess"]);    

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }
    
    
    //
    // USER IS ALLOWED
    //


    //
    // THE USER ALLOWED TO ACCESS THE BACKEND
    //

    const { email } = req.query;

    try {
        const accountInfo = await lookupAccount(db, null, null, email);
        const infoToReturn = {
            accountID: accountInfo.accountID,
            email: accountInfo.email,
        }
        res.status(200).json(infoToReturn);

    } catch (error) {
        res.status(404).json({
        error: {
            message: 'Could not find that account',
        },
        });
    }
}

export default withApiAuthRequired(handle);