// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { updateAccountInfo } from '@src/backend/accounts.js';
import { doAuthAndValidation } from '@src/backend/validation';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_guestAccess", "service_basicAccess"]);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

    //
    // GOT THE USER ACCOUNT
    //

    if (!req.body.account ||
        !req.body.account.accountID ||
        req.body.account.authID != user.sub) {
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

    try {
        const account = await updateAccountInfo(db, user, req.body.account);
        res.status(200).json(account);
    } catch (error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error creating game: ${error.message}`);
        res.status(500).json({
          error: {
            message: 'An error occurred during your request.',
          }
        });
        return;
      }
    }
}

export default withApiAuthRequired(handle);