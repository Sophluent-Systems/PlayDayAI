import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { sendEmail, getEmailTemplate, setEmailTemplate } from '@src/backend/email';



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
        console.log("adminemail: req.body.action=", req.body.action);
        if (req.body.action == "getemailtemplate") {

          if (!req.body.templateName ||
            req.body.templateName.length == 0) {
            res.status(400).json({
              error: {
                message: 'Invalid parameters',
              }
            });
            return;
          }

          const template = await getEmailTemplate(db, req.body.templateName);
          res.status(200).json({status: "success", template: template});

        } else if (req.body.action == "setemailtemplate") {

          if (!req.body.templateName ||
            req.body.templateName.length == 0 ||
            !req.body.template ||
            !req.body.template.subject ||
            (!req.body.template.html && !req.body.template.text)) {
            res.status(400).json({
              error: {
                message: 'Invalid parameters',
              }
            });
            return;
          }

          await setEmailTemplate(db, req.body.templateName, req.body.template);
          res.status(200).json({status: "success"});

        } else if (req.body.action == "sendemail") {

          if (!req.body.to ||
            !req.body.subject ||
            (!req.body.html && !req.body.text)) {
            res.status(400).json({
              error: {
                message: 'Invalid parameters',
              }
            });
            return;
          }

          let emailFields = {
            to: req.body.to,
            subject: req.body.subject,
          };
          if (req.body.html) {
            emailFields.html = req.body.html;
          }
          if (req.body.text) {
            emailFields.text = req.body.text;
          }
          await sendEmail(emailFields);
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