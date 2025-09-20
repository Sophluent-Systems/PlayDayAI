import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { getGameSession, generateSessionForSendingToClient } from '@src/backend/gamesessions.js';
import { hasRight } from '@src/backend/accesscontrol';


async function handle(req, res) {
  const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('POST', req, res, ['service_basicAccess']);

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

  const { sessionID, gameID } = req.body ?? {};
  if (!sessionID || !sessionID.length) {
    res.status(400).json({
      error: {
        message: 'Invalid parameters',
      }
    });
    return;
  }

  const sessionCollection = db.collection('gameSessions');
  const sessionMetadata = await sessionCollection.findOne(
    { sessionID },
    { projection: { accountID: 1, gameID: 1 } }
  );

  if (!sessionMetadata) {
    res.status(404).json({
      error: {
        message: 'Session not found',
      }
    });
    return;
  }

  if (gameID && sessionMetadata.gameID && gameID !== sessionMetadata.gameID) {
    res.status(400).json({
      error: {
        message: 'Session does not belong to the specified game',
      }
    });
    return;
  }

  const targetGameID = sessionMetadata.gameID ?? gameID;
  if (!targetGameID) {
    res.status(500).json({
      error: {
        message: 'Session is missing associated game information',
      }
    });
    return;
  }

  const hasViewSessionPermissions = await hasRight(acl, account.accountID, { resourceType: 'game', resource: targetGameID, access: 'game_viewUserSessions' });
  const isSessionOwner = sessionMetadata.accountID === account.accountID;

  if (!isSessionOwner && !hasViewSessionPermissions) {
    res.status(403).json({
      error: {
        message: 'You do not have permission to view this session',
      }
    });
    return;
  }

  const session = await getGameSession(db, account.accountID, sessionID, hasViewSessionPermissions);
  if (!session) {
    res.status(404).json({
      error: {
        message: 'Session not found',
      }
    });
    return;
  }

  var clientSession = generateSessionForSendingToClient(session, hasViewSessionPermissions);
  res.status(200).json({ session: clientSession });
};
  

export default withApiAuthRequired(handle);
