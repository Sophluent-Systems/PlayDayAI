import { v4 as uuidv4 } from 'uuid';
import { Config } from "@src/backend/config";
import { setGameRolesForUserGroup, getAllAccountPermissionsForGame } from './accesscontrol';
import { nullUndefinedOrEmpty } from '@src/common/objects';


export async function getGameInfoByUrl(db, gameUrl) {
    try {
        const coll = db.collection('games');
        const gameInfo = await coll.findOne({ url: gameUrl });
        delete gameInfo._id;
        return gameInfo;
    } catch (error) {
        console.error('Error fetching the allowList document:', error);
        throw error;
    } 
}

export async function getGameInfoByID(db, gameID) {
    try {
        const coll = db.collection('games');
        const gameInfo = await coll.findOne({ gameID: gameID });
        delete gameInfo._id;
        return gameInfo;
    } catch (error) {
        console.error('Error fetching the game document:', error);
        throw error;
    } 
}


export async function getGameTitlesByIDs(db, gameIDs) {
  try {
      const coll = db.collection('games');
      const query = { gameID: { $in: gameIDs } };
      const projection = { _id: 0, gameID: 1, url: 1, title: 1 }; // We only want gameID and url fields

      const results = await coll.find(query).project(projection).toArray();
      return results; // This will be an array of objects, each with a gameID and its corresponding url

  } catch (error) {
      console.error("Error fetching game URLs:", error);
      return [];
  } 
}

export async function createNewGame(db, gameUrl, title, accountID) {
    try {
        const coll = db.collection('games');
        const date = new Date();
        const newGameInfo = {
            url: gameUrl,
            title: title,
            creatorAccountID: accountID,
            gameID: uuidv4(),
            creationDate: date,
            lastModified: date,
            sharingSettings: {
              roles : {
                'game_owner': ['admin'],
                'game_editor': [],
                'game_sourceViewer': ['creator'],
                'game_player': ['consumer'],
              }

            }
        }
        await coll.insertOne(newGameInfo);
        return newGameInfo;
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    } 
}

export async function updateGameInfo(db, gameInfo, accountID, isAdmin) {
    try {
        const coll = db.collection('games');
        var query = {gameID: gameInfo.gameID};
        if (!isAdmin) {
            query.creatorAccountID = accountID;
        }
        var gameInfoToSet = {...gameInfo};
        gameInfoToSet.lastModified = new Date();
        await coll.updateOne(query,{$set:  gameInfoToSet});
        return await getGameInfoByID(db, gameInfo.gameID);
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    } 
}



export async function listAllGames(db, includeUnpublished, includeVersionsList) {
    try {
      const coll = db.collection('games');
      
      // Aggregation pipeline
      let pipeline = [
        {
          '$lookup': {
            'from': 'gameVersions', 
            'localField': 'gameID', 
            'foreignField': 'gameID', 
            'as': 'gameVersions'
          }
        }
      ];
  
      if (!includeUnpublished) {
        // Remove the $match stage if includeUnpublished is true
        pipeline.push({
          '$match': {
            'gameVersions.published': true
          }
        });
      }
      if (includeVersionsList) {
        // Add a $project stage to include the gameVersions field
        pipeline.push({
          '$project': {
            '_id': 0,
            'title': 1,
            'url': 1,
            'gameID': 1,
            'creatorAccountID': 1,
            'description': 1,
            'featuredIndex': 1,
            'versions': {
              '$map': {
                'input': '$gameVersions',
                'as': 'version',
                'in': {
                  'versionName': '$$version.versionName',
                  'versionID': '$$version.versionID',
                  'published': '$$version.published',
                }
              }
            }
          }
        });
      } else {
        // Add a $project stage to return only game info fields
        pipeline.push({
          '$project': {
            '_id': 0, 
            'title': 1, 
            'url': 1, 
            'gameID': 1, 
            'description': 1,
            'creatorAccountID': 1,
            'featuredIndex': 1,
          }
        });
      }
  
      let gamesList = await coll.aggregate(pipeline).toArray();
      return gamesList;
    } catch (error) {
      console.error('Error fetching games list:', JSON.stringify(error));
      throw error;
    }
}

export async function getAllSharingPermissionsForGame(db, acl, gameID) {
  let ret = {
    accounts: {},
    groups: {}
  }

  try {
    const coll = db.collection('games');
    const query = {gameID: gameID};
    const projection = { _id: 0, 'sharingSettings': 1 };
    const groupSharingSettings = await coll.findOne(query, {projection: projection});
    if (groupSharingSettings.sharingSettings) {
      ret.groups = groupSharingSettings.sharingSettings;
    }

    const allAccountPermissions = await getAllAccountPermissionsForGame(db, acl, gameID);
    ret.accounts = allAccountPermissions;
    return ret;

  } catch (error) {
    console.error('Error fetching game sharing settings:', error);
    throw error;
  }
}

export async function updateGameGroupPermissions(db, acl, gameID, gameRole, userGroups) {
  const { Constants } = Config;
  console.error('updateGameGroupPermissions: gameID=', gameID, 'gameRole=', gameRole, 'userGroups=', userGroups)

  if (!gameRole || nullUndefinedOrEmpty(userGroups, true) || !Constants.gameRoles.includes(gameRole) || !userGroups.every(g => Constants.userRoles.includes(g))) {
    throw new Error("updateGameGroupPermissions: Invalid parameters");
  }

  try {
    await setGameRolesForUserGroup(acl, gameID, gameRole, userGroups);

    const coll = db.collection('games');
    const query = {gameID: gameID};
    const update = {
      $set: {
        [`sharingSettings.roles.${gameRole}`]: userGroups
      }
    };
    await coll.updateOne(query, update);
    return true;
  } catch (error) {
    console.error('Error setting game group sharing settings:', error);
    throw error;
  }
}

export async function updateAllPermissionsForGame(db, acl, gameID, gameRole, userGroups) {

  await updateGameGroupPermissions(db, acl, gameID, gameRole, userGroups);
  
  
}

export async function deleteGameAndAllData(db, gameID) {
    try {
      await db.collection('gameVersions').deleteMany({gameID: gameID});
      await db.collection('gameSessions').deleteMany({gameID: gameID});
      await db.collection('games').deleteMany({gameID: gameID});
      return true;
    } catch (error) {
      console.error('Error deleting game ', gameID, ': ', error);
      throw error;
    }
}

