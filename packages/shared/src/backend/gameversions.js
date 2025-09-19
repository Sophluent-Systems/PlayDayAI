import { v4 as uuidv4 } from 'uuid';
import { Config } from "@src/backend/config";
import { COMPAT_generateUpdatesForVersion } from './backcompat';

export async function addGameVersion(db, gameID, versionName, initialState) {
    const { Constants } = Config;
    console.log('addGameVersion:', versionName)
    try {
        const coll = db.collection('gameVersions');
        const date = new Date();
        const newVersionInfo = {
            ...initialState,
            gameID: gameID,
            versionName: versionName,
            creationDate: date,
            lastUpdatedDate: date,
            stateMachineDescription: initialState?.stateMachineDescription || {},
            versionID: uuidv4(),
            engineVersion: Constants.engineVersion,
        }
        const result = await coll.insertOne(newVersionInfo);
        return newVersionInfo;
    } catch (error) {
        console.error('Error adding game version:', error);
        throw error;
    } 
}

export async function replaceAppVersion(db, gameID, versionName, updatedFields) {
    try {
        const coll = db.collection('gameVersions');
        var query = {gameID: gameID, versionName: versionName};
        var newVersion = {...updatedFields};
        newVersion.lastUpdatedDate = new Date();
        await coll.replaceOne(query,newVersion);
        return await getGameVersionDetails(db, gameID, versionName, true);
    } catch (error) {
        console.error('Error updating game draft:', error);
        throw error;
    } 
}


export async function updateAppVersionFields(db, gameID, versionID, update) {
    const coll = db.collection('gameVersions');
    var query = {gameID: gameID, versionID: versionID};
    const updateQuery = {
      $set: update
    }
    await coll.updateOne(query, updateQuery, {upsert: false});
}

async function applyEngineVersionUpdates(db, versionInfo) {
    const { Constants } = Config;
    if (versionInfo.engineVersion == Constants.engineVersion) {
        return versionInfo;
    }

    const updates = COMPAT_generateUpdatesForVersion(versionInfo);

    console.error(">> Updating version", versionInfo.versionName, " from ", versionInfo.engineVersion, " -> ", Constants.engineVersion, " with ", updates);

    updates.engineVersion = Constants.engineVersion;

    await updateAppVersionFields(db, versionInfo.gameID, versionInfo.versionID, updates);

    return {...versionInfo, ...updates};
}


export async function getGameVersionList(db, gameID, onlyPublished) {
    console.log('getGameVersionList:', gameID, onlyPublished)
    try {
        const coll = db.collection('gameVersions');
        var findQuery = {gameID: gameID};
        if (onlyPublished) {
            findQuery.published = true;
        }
        const cursor = coll.find(findQuery).sort({ creationDate: -1 });
        let list = await cursor.toArray();
        list = await Promise.all(list.map(version => applyEngineVersionUpdates(db, version)));
        let listWithFullNodes = [];
        if (list && list.length > 0) {
            for (let i=0; i<list.length; i++) {
                let version = list[i];
                delete version._id;
                listWithFullNodes.push(version);
            }
        }
        return listWithFullNodes;
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    }
}



export function sanitizeVersionForNonEditor(versionInfo) {
    var sanitizedVersion = {
        versionID: versionInfo.versionID,
        versionName: versionInfo.versionName,
        published: versionInfo.published,
        creationDate: versionInfo.creationDate,
        lastUpdatedDate: versionInfo.lastUpdatedDate,
        gameID: versionInfo.gameID,
        features: versionInfo.features,
        userTokenLimit: findUserTokenLimit(versionInfo?.stateMachineDescription),
    }
    return sanitizedVersion;
}

export async function getGameVersionDetails(db, gameID, versionName, hasEditPermissions=false) {
    try {
        const coll = db.collection('gameVersions');
        var query = {gameID: gameID, versionName: versionName};
        let result = await coll.aggregate([
            {
            $match: query
            },
            {
            $lookup: {
                from: "games",
                localField: "gameID",
                foreignField: "gameID",
                as: "game"
            }
            },
            {
            $unwind: "$game"
            }
        ]).toArray();
        let document = result[0];
        document = await applyEngineVersionUpdates(db, document);
        delete document._id;
        if (!hasEditPermissions) {
            document = sanitizeVersionForNonEditor(document);
        }
        return document;
    } catch (error) {
        console.error('Error getting game version:', error);
        return null;
    } 
}

export async function getBestPublishedVersionForGame(db, gameID, versionHint, hasEditPermissions) {
    try {
        const coll = db.collection('gameVersions');
        let version = null;
        if (versionHint) {
            version = await coll.findOne({gameID: gameID, versionName: versionHint});
            if (!version) {
                console.log("getBestPublishedVersionForGame: Could not find ", versionHint, "! Looking for another good version.");
                version = null;
            }
            if (!version.published && !hasEditPermissions) {
                console.log("getBestPublishedVersionForGame: ", versionHint, " was not published! Looking for another good version.");
                version = null;
            }
        }
        if (!version) {
            var query = {gameID: gameID};
            if (!hasEditPermissions) {
                query.published = true;
            }
            const publishedVersions = await coll.find(query).sort({ creationDate: -1 }).limit(1).toArray();
            if (publishedVersions.length > 0) {
                version = publishedVersions[0];
            }   
        }
        if (version) {
            delete version._id;
        }
        if (!hasEditPermissions) {
            version = sanitizeVersionForNonEditor(version);
        }
        return version;
    } catch (error) {
        console.error('Error updating game draft:', error);
        throw error;
    } 
}

export async function deleteGameVersion(db, gameID, versionName) {
    try {
      const coll = db.collection('gameVersions');
      await coll.deleteOne({gameID: gameID, versionName: versionName});
      return true;
    } catch (error) {
      console.error('Error deleting game verseion', verionName, ': ', error);
      throw error;
    }
}
