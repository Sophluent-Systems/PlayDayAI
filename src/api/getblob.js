// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { getBlobFromStorage } from '@src/backend/blobstorage';
import {  getGameSession } from '@src/backend/gamesessions';
import { nullUndefinedOrEmpty } from '../../src/common/objects';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    
    
    //
    // USER IS ALLOWED
    //

    const { blobID, sessionID } = req.body;

    //
    // GOT THE USER ACCOUNT
    //

    if (nullUndefinedOrEmpty(blobID) || nullUndefinedOrEmpty(sessionID)) {  
        res.status(400).json({
          error: {
            message: 'Invalid parameters',
          }
        });
        return;
      }


    let session = await getGameSession(db, account.accountID, sessionID, isAdmin);
    if (!session) {
        console.log("Couldn't find session ", sessionID);
        res.status(404).json({
          error: {
            message: `Session ${sessionID} could not be found.`,
          }
        });
        return;
    }
  
    //
    // WE HAVE A GAME SESSION
    //
  
    //
    // PARAMS LOOK GOOD
    //

    try {
        
        const storageEntry = await getBlobFromStorage(db, blobID);

        if (!storageEntry) {
            console.error("Blob not found: ", blobID);
            res.status(404).json({
              error: {
                message: `Blob ${blobID} could not be found.`,
              }
            });
            return;
        }

        let result = {
          mimeType: null,
          data: null,
          source: "url",
       }
        
       // construct the data URL, usable from React for playback from the MIME type and the base64 data
       const url = `data:${storageEntry.mimeType};base64,${storageEntry.data}`;
        
        res.status(200).json({ url: url, mimeType: storageEntry.mimeType });
    } catch (error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error rating response: ${error.message}`);
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