import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { 
  getGameRightsForUser, 
  getAccountRolesAndBasicPermissions } from '@src/backend/accesscontrol';
import { lookupAccount } from '@src/backend/accounts';
import { Config } from '@src/client/configprovider';
import { getGameInfoByUrl, getAllSharingPermissionsForGame } from '@src/backend/games';


async function handle(req, res) {
    const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ["service_basicAccess"]);

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

    //
    // User must be admin to do this
    //


    try {
      Constants.debug.logPermissions && console.log("action: ", req.body.action, " accountID: ", req.body.accountID, " email: ", req.body.email)

      let accountID = null;
      if (req.body.accountID) {
        accountID = req.body.accountID;
      } else if (req.body.email) {
        let account = await lookupAccount(db, null, null, req.body.email);
        if (account) {
          accountID = account.accountID;
        } else {
          console.log("account not found")
          res.status(404).json({
            error: {
              message: 'User not found',
            }
          });
          return;
        }
      }

      if (req.body.action == "getAccountRolesAndBasicPermissions") {

          let ret = await getAccountRolesAndBasicPermissions(db, acl, accountID);
          res.status(200).json({status: "success", data: ret});

      } else if (req.body.action == "getgamepermissionsforediting") {
          
        let gameID = req.body.gameID;

          if (!gameID) {
            if (req.body.gameUrl) {
              let gameInfo = await getGameInfoByUrl(db, req.body.gameUrl);
              if (!gameInfo) {
                res.status(403).json({
                  error: {
                    message: `Game ID ${gameID} could not be found.`,
                  }
                });
                return;
              }
              gameID = gameInfo.gameID;
            } else {
              res.status(400).json({
                error: {
                  message: 'Invalid parameters',
                }
              });
              return;
            }
          }

          Constants.debug.logPermissions && console.log("getAllSharingPermissionsForGame gameID: ", gameID)
          const ret = await getAllSharingPermissionsForGame(db, acl, gameID );

          res.status(200).json({status: "success", data: ret});

      } else if (req.body.action == "getgamerightsforuser") {
    
          let gameID = req.body.gameID;

          if (!gameID) {
            if (req.body.gameUrl) {
              let gameInfo = await getGameInfoByUrl(db, req.body.gameUrl);
              if (!gameInfo) {
                res.status(403).json({
                  error: {
                    message: `Game ID ${gameID} could not be found.`,
                  }
                });
                return;
              }
              gameID = gameInfo.gameID;
            } else {
              res.status(400).json({
                error: {
                  message: 'Invalid parameters',
                }
              });
              return;
            }
          }

          const ret = await getGameRightsForUser(acl, accountID, gameID );


          res.status(200).json({status: "success", data: ret});

      } else {

        // Invalid parameter
        console.error("Invalid action: ", req.body.action);
        res.status(400).json({
          error: {
            message: 'Invalid parameters',
          }
        });
        return;
      }
    } catch (error) {
      console.error("Error: ", error);
      res.status(500).json({ status: "error", error: { message: error } });
    }
};
  

export default withApiAuthRequired(handle);