import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { setAccountRoles } from '@src/backend/accesscontrol';
import { lookupAccount } from '@src/backend/accounts';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { updateGameGroupPermissions } from '@src/backend/games';


async function handle(req, res) {
    const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions"]);

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


        let accountID = null;
        if (req.body.accountID) {
          accountID = req.body.accountID;
        } else if (req.body.email) {
          let account = await lookupAccount(db, null, null, req.body.email);
          if (account) {
            accountID = account.accountID;
          } else {
            console.error("account not found")
            res.status(404).json({
              error: {
                message: 'User not found',
              }
            });
            return;
          }
        }

        if (req.body.action == "onetimespecialaction") {

          //await oneTimeSpecialAction(acl);
          res.status(200).json({status: "success"});

        } else if (req.body.action == "setgamerolesforaccount") {

          console.error("setgameroles: req.body.rolesToAdd=", req.body.rolesToAdd, " req.body.rolesToRemove=", req.body.rolesToRemove, " req.body.gameID=", req.body.gameID, " accountID=", accountID);
          if ((!req.body.rolesToAdd && !req.body.rolesToRemove) || !req.body.gameID || !accountID) {
            console.error("Bad parameters");
            res.status(400).json({status: "error", error: new Error("Bad Parameters to setgameroles")});
            return;
          }

          const rolesToAddModifiedToIncludeGameID = req.body.rolesToAdd ? req.body.rolesToAdd.map(role => role + "_" + req.body.gameID) : [];
          const rolesToRemoveModifiedToIncludeGameID = req.body.rolesToRemove ? req.body.rolesToRemove.map(role => role + "_" + req.body.gameID) : [];
          
          const roles = await setAccountRoles(db, acl, accountID, rolesToAddModifiedToIncludeGameID, rolesToRemoveModifiedToIncludeGameID);
          console.error("roles: ", roles);
          res.status(200).json({status: "success", data: roles});

        } else if (req.body.action == "setaccountroles") {


          console.error("setaccountroles: req.body.rolesToAdd=", req.body.rolesToAdd, " req.body.rolesToRemove=", req.body.rolesToRemove);
          if (!req.body.rolesToAdd && !req.body.rolesToRemove) {
            console.error("no roles to add or remove");
            res.status(400).json({status: "error", error: new Error("Bad Parameters to setaccountroles")});
            return;
          }
          
          const roles = await setAccountRoles(db, acl, accountID, req.body.rolesToAdd, req.body.rolesToRemove);
          console.error("roles: ", roles);
          res.status(200).json({status: "success", data: roles});

        } if (req.body.action == "setgamegroupsharingsettings") {
         
          const { gameID, groups } = req.body;
          console.error("setgamegroupsharingsettings: gameID=", gameID, " groups=", groups);
          if (nullUndefinedOrEmpty(gameID) || nullUndefinedOrEmpty(groups) || nullUndefinedOrEmpty(groups.roles)) {
            res.status(400).json({status: "error", error: new Error("Invalid parameters")});
            return;
          }


          // loop through all game roles. If one is not represented here, null it out
          for (let i = 0; i < Constants.gameRoles.length; i++) {
            const role = Constants.gameRoles[i];
            await updateGameGroupPermissions(db, acl, gameID, role, groups.roles[role] || []);
          }

          res.status(200).json({status: "success"});


        } else {

          // bad parameter -- invalid action
          res.status(400).json({status: "error", error: new Error("Invalid action")});
          return;
        }
      } catch (error) {
        console.error("Error: ", error);
        res.status(500).json({ status: "error", error: { message: error } });
      }
};
  

export default withApiAuthRequired(handle);