import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { redeemCode } from '@src/backend/codes';
import { setAccountRoles } from '@src/backend/accesscontrol';


async function handle(req, res) {
    const { validationError, db, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ['service_basicAccess', 'service_guestAccess']);

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }

    //
    // CHECK PARAMS
    //


    if (!req.body.code ||
      req.body.code.length == 0) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }

    
    try {
        console.log("redeeming code: ", req.body.code)
        const codeResult = await redeemCode(db, req.body.code, account.accountID);
        console.log("codeResult: ", codeResult)

        if (!codeResult) {
          res.status(500).json({
            error: {
              message: 'Something went wrong redeeming the code',
            }
          });
          return;
        }

        if (codeResult.status == "success") {
           if (codeResult.code.grants == "role:creator;role:consumer") {
              console.log("Granting access to ", account.accountID, account.email);
              await setAccountRoles(db, acl, account.accountID, /* rolesToAdd */ ["creator", "consumer"], /* rolesToRemove */ ["guest"])
           }
        }

        res.status(200).json({status: codeResult.status});
        
      } catch (error) {
        console.error("Error: ", error);
        res.status(500).json({ status: "error", error: { message: error } });
      }
};
  

export default withApiAuthRequired(handle);
