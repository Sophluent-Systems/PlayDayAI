// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { getRecord } from '@src/backend/records';
import { 
  getGameSession,
  updateSingleMessageInGameSession_Atomic
} from '@src/backend/gamesessions';
import { rateLLMResponse } from '@src/backend/ailogging.js';
import { hasRight } from '@src/backend/accesscontrol.js';
import { openPubSubChannel } from '@src/common/pubsub/pubsubapi.js';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }
    
    
    //
    // USER IS ALLOWED
    //

    //
    // GOT THE USER ACCOUNT
    //

    if (((typeof req.body.playerRating === 'undefined' || req.body.playerRating === null) && (typeof req.body.adminRating === 'undefined' || req.body.adminRating === null)  && (typeof req.body.automationRating === 'undefined' || req.body.automationRating === null)) ||
        (!req.body.sessionID) ||
        ((typeof req.body.recordID === "undefined" || req.body.recordID === null))) {  
        res.status(400).json({
          error: {
            message: 'Invalid parameters',
          }
        });
        return;
      }


    let session = await getGameSession(db, account.accountID, req.body.sessionID, isAdmin);
    if (req.body.sessionID) {
        if (!session) {
            console.log("Couldn't find session ", req.body.sessionID);
            res.status(404).json({
              error: {
                message: `Session ${req.body.sessionID} could not be found.`,
              }
            });
            return;
        }
    } 
  
  //
  // WE HAVE A GAME SESSION
  //
  

    const hasEditPermissions = await hasRight(acl, account.accountID, {resourceType: "game", resource: session.gameInfo.gameID, access: ["game_edit"]});
    
    if (req.body.adminRating && !hasEditPermissions) {
        console.log("User ", account.accountID, " is not allowed to rate session ", req.body.sessionID);
        res.status(403).json({
          error: {
            message: `User ${account.accountID} is not allowed to rate session ${req.body.sessionID}.`,
          }
        });
        return;
    }

    //
    // Find the record
    //
    let record = await getRecord(db, req.body.recordID);

    if (!record) {
        console.log("rateresponse: Couldn't find message ", req.body.recordID);
        console.log("session: ", session.sessionID);
        res.status(404).json({
          error: {
            message: `Message ${req.body.messageIndex} could not be found.`,
          }
        });
        return;
    }


    //
    // Is this record type reviewable?
    //

    if (!record.properties?.reviewable) {
      // bad request
      console.log("Message is not reviewable  properties=", record.properties );
      res.status(400).json({
        error: {
          message: 'Message is not reviewable',
        }
      });
      return;
    }

    //
    // PARAMS LOOK GOOD
    //

    try {

        let ratings = {}
        if (typeof req.body.playerRating !== "undefined") {
          ratings.playerRating = req.body.playerRating;
        }
        if (typeof req.body.adminRating !== "undefined") {
          ratings.adminRating = req.body.adminRating;
        }
        if (typeof req.body.automationRating !== "undefined") {
          ratings.automationRating = req.body.automationRating;
        }
        const updates = await rateLLMResponse(db, session.sessionID, req.body.recordID, ratings);

        const workerChannel = await openPubSubChannel(`session_${session.sessionID}`, session.sessionID);
        
        await workerChannel.sendField(req.body.recordID, "ratings", ratings, { bypassRecordExistenceCheck: true });

        res.status(200).json({ updates: updates });
    } catch (error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
        res.status(error.response.status).json(error.response.data);
      } else {
        console.error(`Error rating response: ${error}`);
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