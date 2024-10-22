import { v4 as uuidv4 } from 'uuid';
import { getNestedObjectProperty, setNestedObjectProperty, nullUndefinedOrEmpty } from '@src/common/objects';
import { Config } from "@src/backend/config";
import { sanitizeVersionForNonEditor } from './gameversions';

export async function initializeNewGameSession(db, gameID, versionID, accountID) {
    var session = {
        accountID: accountID,
        gameID: gameID,
        sessionID: uuidv4(),
        versionID: versionID,
        latestUpdate: new Date(),
    }

    const coll = db.collection('gameSessions');
    await coll.insertOne(session);

    return session;
}

export async function saveGameSession(db, session, accountID) {
    try {
        const coll = db.collection('gameSessions');
        const query = {
            sessionID: session.sessionID,
        }
        if (accountID) {
            query.accountID = accountID;
        }
        var updateData = {
            latestUpdate: new Date(),
            usedScenarios: session.usedScenarios,
            llmContexts: session.llmContexts,
        }
        await coll.updateOne(query,{$set:  updateData}, {upsert: false});
        return updateData;
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    } 
}


export async function getGameSession(db, accountID, sessionID, hasEditorPermissions) {
  try {
    const coll = db.collection('gameSessions');
    var query = {sessionID: sessionID};
    if (!hasEditorPermissions) {
      query.accountID = accountID;
    }
    var result = await coll.aggregate([
      {
        $match: query
      },
      {
        $lookup: {
          from: "games",
          localField: "gameID",
          foreignField: "gameID",
          as: "gameInfo"
        }
      },
      {
        $unwind: "$gameInfo"
      },
      {
        $lookup: {
          from: "gameVersions",
          let: { versionId: "$versionID", gameId: "$gameID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$versionID", "$$versionId"] },
                    { $eq: ["$gameID", "$$gameId"] }
                  ]
                }
              }
            }
          ],
          as: "versionInfo"
        }
      },
      { $unwind: "$versionInfo" }
    ]).toArray();
    if (!result || !result[0]) {
      console.error('getGameSession not found: ', sessionID);
      return null;
    }
    let document = {...result[0]}
    delete document._id;
    delete document.gameInfo._id;
    delete document.versionInfo._id;
    return document;
  } catch (error) {
    console.error('Error fetching game session:', error);
    return null;
  }
}


export async function getMostRecentGameSessionForUser(db, accountID, gameID, versionName, canViewSource) {
  try {
    const coll = db.collection('gameSessions');
    var query = { accountID: accountID, gameID: gameID };
    var result = null;
    if (versionName) {
        result = await coll.aggregate([
          { $match: query },
          {
            $lookup: {
              from: "gameVersions",
              let: { versionId: "$versionID", versionName: versionName },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$versionID", "$$versionId"] },
                        { $eq: ["$versionName", "$$versionName"] }
                      ]
                    }
                  }
                }
              ],
              as: "versionInfo"
            }
          },
          { $unwind: "$versionInfo" }
        ]).sort({ latestUpdate: -1 }).limit(1).toArray();
    } else {
      result =await coll.aggregate([
        {
          $match: query
        },
        {
          $lookup: {
            from: "gameVersions",
            localField: "versionID",
            foreignField: "versionID",
            as: "versionInfo"
          }
        },
        {
          $unwind: "$versionInfo"
        }
      ]).sort({ latestUpdate: -1 }).limit(1).toArray();
    }
    if (!result || !result[0]) {
      return null;
    }
    var document = {...result[0]};
    delete document._id;
    delete document.versionInfo._id;
    if (!canViewSource) {
      document.versionInfo = sanitizeVersionForNonEditor(document.versionInfo);
    } else {
    }
    return document;
  } catch (error) {
    console.error('Error fetching games list:', error);
    return null;
  }
}


export async function getAllSessionsForGameEditor(db, gameID, versionID, accountID, hasEditorPermissions) {
  try {
    const coll = db.collection('gameSessions');
    var query = {gameID: gameID};
    if (versionID) {
      query.versionID = versionID;
    }
    if (accountID) {
      query.accountID = accountID;
    }
    var result = await coll.aggregate([
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
      },
      {
        $lookup: {
          from: "accounts",
          localField: "accountID",
          foreignField: "accountID",
          as: "account"
        }
      },
      {
        $unwind: "$account"
      },
      {
        $lookup: {
          from: "gameVersions",
          localField: "versionID",
          foreignField: "versionID",
          as: "versionInfo"
        }
      },
      {
        $unwind: "$versionInfo"
      }
    ]).toArray();
    result.forEach((session) => {
      delete session._id;
      delete session.game._id;
      delete session.account._id;
      delete session.versionInfo._id;
    });
    return result;
  } catch (error) {
    console.error('Error fetching games list:', error);
    throw error;
  }
}

export async function deleteGameSession(db, accountID, sessionID) {
  try {
    const coll = db.collection('gameSessions');
    const result = await coll.deleteOne({accountID: accountID, sessionID: sessionID});
    console.log("Deleted game session  accountID: ", accountID, " sessionID: ", sessionID, "-> (count): (", result.deletedCount, ")");
    return true;
  } catch (error) {
    console.error('Error fetching games list:', error);
    return false;
  }
}

export function starsOfLength(length) {
  var stars = '';
  for (var i = 0; i < length; i++) {
    stars += '*';
  }
  return stars;
}

export function stripHiddenFieldsFromSession(session, isAllowedToViewDetails) {
  const Constants = Config.Constants;
  
  session.versionInfo = {...session.versionInfo};
  if (!isAllowedToViewDetails) {
    const stateMachineDescription = session.versionInfo.stateMachineDescription;
    if (stateMachineDescription?.nodes && stateMachineDescription.nodes.length > 0) {
      session.versionInfo.stateMachineDescription.nodes = [];
      for (let i = 0; i < stateMachineDescription.nodes.length; i++) {
        const node = stateMachineDescription.nodes[i];
        if (node.isSourceNode) {
          session.versionInfo.stateMachineDescription.nodes.push({
            instanceName: node.instanceName,
            nodeType: node.nodeType,
            isSourceNode: true,
            instanceID: node.instanceID,
          });
        }
      }
    }
  }
  Constants.hiddenFields.forEach((field) => {
    const currentValue = getNestedObjectProperty(session.versionInfo, field);
    if (!nullUndefinedOrEmpty(currentValue)) {
      const stars = (typeof currentValue == 'string') ? starsOfLength(currentValue.length) : starsOfLength(4);
      setNestedObjectProperty(session, field, stars);
    }
  });
  return session;
}

export function generateSessionForSendingToClient(session, isAllowedToViewDetails) {
  
  let clientSession = {
    sessionID: session.sessionID,
    gameID: session.gameID,
    versionInfo: session.versionInfo,
    accountID: session.accountID,
  };
  if (!isAllowedToViewDetails) {
    clientSession.versionInfo = {
      versionName: session.versionInfo.versionName,
    }
    clientSession = stripHiddenFieldsFromSession(clientSession, isAllowedToViewDetails);
  }

  return clientSession;
}

export async function sessionClone(db, sessionID, accountID, assignedName) {
  const session = await getGameSession(db, accountID, sessionID, true);
  if (!session) {
    throw new Error('Session not found');
  }
  const newSession = {
    ...session,
    sessionID: uuidv4(),
    accountID: accountID,
    latestUpdate: new Date(),
    clonedFromSessionID: session.clonedFromSessionID ? session.clonedFromSessionID : session.sessionID,
    clonedFromAccountID: session.clonedFromAccountID ? session.clonedFromAccountID : session.accountID,
  }
  if (assignedName) {
    newSession.assignedName = assignedName;
  } else {
    // Get the original account's username
    const coll = db.collection('accounts');
    const result = await coll.findOne({accountID: newSession.clonedFromAccountID});
    newSession.assignedName = "Copied from " + (result.email ? result.email : result.accountID);
  }

  const coll = db.collection('gameSessions');
  await coll.insertOne(newSession);
  return newSession.sessionID;
}


export async function sessionRename(db, sessionID, newAssignedName) {
  try {
      const coll = db.collection('gameSessions');
      const query = {
        sessionID: sessionID,
      }
      const valuesToSet = {
        assignedName: newAssignedName,
        latestUpdate: new Date(),
      };
      var updateData = {
          $set: valuesToSet,
      }
      await coll.updateOne(query, updateData, {upsert: false});
      return true;
  } catch (error) {
      console.error('Error saving game session:', error);
      throw error;
  } 
}
