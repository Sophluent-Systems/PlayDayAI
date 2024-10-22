import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { 
  addCode,
  lookupCodes,
  deleteCode,
} from '@src/backend/codes';
import { 
  getAllAccessRequests, 
  accountApproveAccessRequest,
  accountDenyAccessRequest
 } from '@src/backend/accounts';



async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions"]);

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }

    //
    // CHECK PARAMS
    //


    if (!req.body.action ||
      req.body.action.length == 0) {
      res.status(400).json({
        error: {
          message: 'Invalid parameters',
        }
      });
      return;
    }

    

    try {
        console.log("codemanage: req.body.action=", req.body.action);
        if (req.body.action == "generatecode") {

            let optionalParams = {};
            if (req.body.notes) {
              optionalParams.notes = req.body.notes;
            }
            if (req.body.expiration) {
              optionalParams.expiration = req.body.expiration;
            }
            if (req.body.accountID) {
              optionalParams.accountID = req.body.accountID;
            }
            if (!req.body.purpose && (req.body.purpose != "access")) {
              res.status(400).json({
                error: {
                  message: 'Invalid parameters',
                }
              });
              return;
            }

            const newCode = await addCode(db, "role:creator;role:consumer", optionalParams);

            if (req.body.accountID) {
              // If we have an account ID, update the account as having an
              // approved request
              await accountApproveAccessRequest(db, req.body.accountID, newCode.code);
            }

            res.status(200).json({status: "success", code: newCode});
        } else if (req.body.action == "denyaccessrequest") {
            
              if (!req.body.accountID ||
                req.body.accountID.length == 0) {
                res.status(400).json({
                  error: {
                    message: 'Invalid parameters',
                  }
                });
                return;
              }
  
              await accountDenyAccessRequest(db, req.body.accountID);
              res.status(200).json({status: "success"});

        } else if (req.body.action == "lookupcodes") {

            const hideCodes = req.body.revealCodes ? false : true;
            const codes = await lookupCodes(db, hideCodes);
            res.status(200).json({status: "success", codes: codes});

        } else if (req.body.action == "deletecode") {

            if (!req.body.code ||
              req.body.code.length == 0) {
              res.status(400).json({
                error: {
                  message: 'Invalid parameters',
                }
              });
              return;
            }

            await deleteCode(db, req.body.code);
            res.status(200).json({status: "success"});
 
        } else if (req.body.action == "getaccessrequests") {

          const result = await getAllAccessRequests(db, req.body.requestfilter ? req.body.requestfilter : null);
          res.status(200).json(result);
        
      } else {

          // invalid parameters
          res.status(400).json({
            error: {
              message: 'Invalid parameters',
            }
          });
        }
      } catch (error) {
        console.error("Error: ", error);
        res.status(500).json({ status: "error", error: { message: error } });
      }
};
  

export default withApiAuthRequired(handle);