// pages/api/gameInfo.js
import { withApiAuthRequired, getSession } from '@src/backend/auth';
import { listAllGames } from '@src/backend/games.js';
import { doAuthAndValidation } from '@src/backend/validation';


async function handle(req, res) {
    const { validationError, db, user, acl, account, isAdmin } = await doAuthAndValidation('GET', req, res, ['service_basicAccess']);

    if (validationError) {
      res.status(validationError.status).json({ error: { message: validationError.message } });
      return;
    }

    //
    // THE USER IS ALLOWED TO ACCESS THE BACKEND
    //

    
    const hasEditPermissions = account.roles?.servicePermissions?.includes("service_editMode") || account.roles?.servicePermissions?.includes("service_modifyGlobalPermissions");

    try {
        const gamesList = await listAllGames(db, hasEditPermissions, hasEditPermissions);

        // Set Cache-Control header to 5 minutes
        //res.setHeader('Cache-Control', 'max-age=300');
        res.status(200).json(gamesList);

    } catch (error) {
        console.log("Error listing games", error);
        res.status(404).json({
        error: {
            message: 'Error listing games',
        },
        });
    }
}

export default withApiAuthRequired(handle);