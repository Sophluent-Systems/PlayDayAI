// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/authWithToken';
import { getGameInfoByUrl } from '@src/backend/games.js';
import { doAuthAndValidation } from '@src/backend/validation';



async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('GET', req, res, ['service_basicAccess']);

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }
    
    
    //
    // USER IS ALLOWED
    //


    //
    // THE USER ALLOWED TO ACCESS THE BACKEND
    //

    const { game, mode } = req.query;

    try {
        const gameInfo = await getGameInfoByUrl(db, game);
        if (typeof gameInfo.prompts !== 'undefined') {
            delete gameInfo.prompt;
        }
        res.status(200).json(gameInfo);

    } catch (error) {
        res.status(404).json({
        error: {
            message: 'Could not find the game specified',
        },
        });
    }
}

export default withApiAuthRequired(handle);