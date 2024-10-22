import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const createTransporter = async () => {
    try {
        
      const OAuth2 = google.auth.OAuth2;

      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_ACCESS_TOKEN || !process.env.GMAIL_ACCOUNT) {
        throw new Error("Gmail credentials not found - please check your .env file or environment variables");
      }

      const oauth2Client = new OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          "https://developers.google.com/oauthplayground"
        );
 
        oauth2Client.setCredentials({
          refresh_token: process.env.GMAIL_REFRESH_TOKEN,
          access_token: process.env.GMAIL_ACCESS_TOKEN,
        });
 
        const accessToken = await new Promise((resolve, reject) => {
          oauth2Client.getAccessToken((err, token) => {
            if (err) {
              console.error("oauth2Client.getAccessToken ERR: ", err)
              reject();
            }
            resolve(token); 
          });
        });
 
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: process.env.GMAIL_ACCOUNT,
            accessToken,
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          },
        });
        return transporter;
    } catch (err) {
        console.error("createTransporter failed with", err);
        throw err;
    }
  };

export async function sendEmail(mailFields) {

    let transporter = await createTransporter();
    let finalMailFields = {
        from: `"PlayDay.ai" <${process.env.GMAIL_ACCOUNT}>`,
        ...mailFields,
    };
    await transporter.sendMail(finalMailFields);
}

export async function getEmailTemplate(db, templateName) {
  const coll = db.collection('settings');
  const template = await coll.findOne({ setting: "emailtemplate", templateName: templateName });
  if (template) {
    delete template._id;
    return template;
  } else {
    return { to: "", subject: "", text: "", html: "" };
  }
}

export async function setEmailTemplate(db, templateName, template) {
  const coll = db.collection('settings');
  const result = await coll.updateOne(
    { setting: "emailtemplate", templateName: templateName },
    { $set: { to: template.to, subject: template.subject, text: template.text, html: template.html } },
    { upsert: true }
  );
  return result;
}