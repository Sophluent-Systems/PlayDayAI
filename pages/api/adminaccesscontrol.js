import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { Config } from "@src/backend/config";


async function handle(req, res) {
    const { Constants } = Config;
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
        console.log("adminaccesscontrol: req.body.action=", req.body.action);
        if (req.body.action == "getsiteroleaccess") {

          // For each user role list the site rights
          const promises = Constants.userRoles.map(async (role) => {
            // return a promise
            let resources = await acl.whatResources(role);
            if (!resources) {
              resources = [];
            }

            return {
              role: role,
              resources: resources,
            };
          });

          // Wait for all the promises to resolve
          const access = await Promise.all(promises);
          let siteAccess = {};
          if (Array.isArray(access) && access.length > 0) {
            access.forEach((roleAccess) => {
              const role = roleAccess.role;
              const access = roleAccess.resources['service'];
              siteAccess[role] = access;
            });
          }
          console.log("getsiteroleaccess returning access:", siteAccess);
          res.status(200).json({status: "success", data: siteAccess});

        } else if (req.body.action == "setcoarsesiteroleaccess") {

          if (!req.body.accessMode || !req.body.accessMode.length) {
            res.status(400).json({
              error: {
                message: 'Invalid parameters',
              }
            });
            return;
          }

          const allowedModes = ['invite-only', 'invite-apps', 'open'];
          if (!allowedModes.includes(req.body.accessMode)) {
            res.status(400).json({
              error: {
                message: 'Invalid parameters',
              }
            });
            return;
          }

          try {
            // Set the new mode
            if (req.body.accessMode == 'invite-only') {
              console.log("Setting coarse access to invite-only");
              await acl.allow('guest', 'service', 'service_guestAccess'); 
              await acl.removeAllow('guest', 'service', 'service_editMode');
              await acl.removeAllow('guest', 'service', 'service_basicAccess');
            }


            if (req.body.accessMode == 'invite-apps') {

              console.log("Setting coarse access to invite-apps");
              await acl.allow('guest', 'service', 'service_basicAccess'); 
              await acl.removeAllow('guest', 'service', 'service_editMode');
              await acl.removeAllow('guest', 'service', 'service_guestAccess');
            }


            if (req.body.accessMode == 'open') {
              console.log("Setting coarse access to open");
              await acl.allow('guest', 'service', 'service_basicAccess');
              await acl.allow('guest', 'service', 'service_editMode');
              await acl.removeAllow('guest', 'service', 'service_guestAccess');
            }


          } catch (error) {
            console.error("Error setting coarse access: ", error);
            res.status(500).json({ status: "error", error: { message: error } });
            return;
          }

          res.status(200).json({status: "success"});

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