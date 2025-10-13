import { v4 as uuidv4 } from 'uuid';
import { nullUndefinedOrEmpty  } from '@src/common/objects';
import { Config } from "@src/backend/config";

export async function addNewAccount(db, authID) {
    const { Constants } = Config;
    console.log('addNewAccount:', authID);

    try {
        const coll = db.collection('accounts');
        const newAccountInfo = {
            authID: authID,
            accountID: uuidv4(),
            createdDate: new Date(),
            ...Constants.defaultAccountInfo,
        }
        const document = await coll.insertOne(newAccountInfo);
        return newAccountInfo;
    } catch (error) {
        console.error('Error adding account:', authID);
        throw error;
    } 
}

export async function lookupAccount(db, accountID, authID, email=null) {
    if (!authID && !email && !accountID) {
        return null;
    }
    try {
        const coll = db.collection('accounts');
        let query = {};
        if (authID) {
            query.authID = authID;
        }
        if (accountID) {
            query.accountID = accountID;
        }
        if (email) {
            query.email = email;
        }
        const account = await coll.findOne(query);
        delete account._id;

        return account;
    } catch (error) {
        // Can be normal if we're just looking for an account that doesn't exist
        console.log('Error lookupAccount: accountID=', accountID, ' authID=', authID, ' email=', email, error);
        return null;
    } 
}



export async function lookupAccountInfoByIDs(db, accountIDs) {
    try {
        const coll = db.collection('accounts');
        const query = { accountID: { $in: accountIDs } };
        const projection = { _id: 0, email: 1, accountID: 1, authID: 1 }; 
  
        const results = await coll.find(query).project(projection).toArray();
        return results; // This will be an array of objects, each with a gameID and its corresponding url
  
    } catch (error) {
        console.error("Error fetching game URLs:", error);
        return [];
    } 
  }

export async function logAccountAccess(db, user, account) {
    // Update the account's lastAccessed date and update
    // the user's email or profile pic if they've changed

    let updateData = {
        lastAccessed: new Date(),
    }
    
    const coll = db.collection('accounts');
    if (user.email !== account.email) {
        updateData.email = user.email;
    }
    if (account.profile?.displayName != user.name) {
        updateData['profile.displayName'] = user.name;
    }
    if (user.picture !== account.profile?.profilePictureUrl) {
        updateData['profile.profilePictureUrl'] = user.picture;
    }
    
    // call async so this function returns immediately
    coll.updateOne({authID: user.sub},{$set:  updateData}, {upsert: true}).catch((error) => {
        console.error('Error logging account access:', error);
        // do not throw error here, as this is not a critical operation
    });

    return {...account, ...updateData};
}

export async function updateAccountInfo(db, user, account) {
    const allowedPreferences = [
        "editMode",
        "darkMode",
        "openAIkey",
        "anthropicKey",
        "googleLLMKey",
        "stabilityAIKey",
        "elevenLabsKey",
        "openaiAgentKitWebhookSecret",
        "openaiConnectorRegistryKey",
        "microsoftAgentFrameworkClientId",
        "microsoftAgentFrameworkClientSecret",
        "azureAiFoundryEndpoint",
        "azureEntraTenantId",
        "googleAdsServiceAccountKey",
        "perplexityApiKey",
        "ibmApiConnectKey",
        "ibmApiConnectSecret",
        "tinkerApiKey",
        "tinkerWebhookSecret",
        "openRouterApiKey",
        "temporalCloudApiKey",
        "accessRequestStatus",
        "accessRequestDate",
        "scrollingMode",
        "audioVolume",
        "audioPlaybackSpeed",
    ];
    const allowedProfile = [
        "displayName",
        "profilePictureUrl",
    ];
    const allowedDebugSettings = [
        "singleStep",
        "messageFilters",
        "seedOverrideEnabled",
        "seedOverrideValue",
        "showHidden",
    ];
    try {
        const coll = db.collection('accounts');
        let updateData = {  };
        if (nullUndefinedOrEmpty(account.profile?.displayName)) {
            updateData[`profile.displayName`] = user.name;
        }
        if (nullUndefinedOrEmpty(account.profile?.profilePictureUrl)) {
            updateData[`profile.profilePictureUrl`] = user.picture;
        }
        allowedPreferences.forEach(param => {
            if (!nullUndefinedOrEmpty(account.preferences[param], true)) {
                updateData[`preferences.${param}`] = account.preferences[param];
            }
        });
        allowedProfile.forEach(param => {
            if (!nullUndefinedOrEmpty(account.profile[param], true)) {
                updateData[`profile.${param}`] = account.profile[param];
            }
        });
        if (account.preferences.debugSettings) {
            allowedDebugSettings.forEach(param => {
                if (!nullUndefinedOrEmpty(account.preferences.debugSettings?.[param])) {
                    updateData[`preferences.debugSettings.${param}`] = account.preferences.debugSettings[param];
                }
            });
        }
        if (!nullUndefinedOrEmpty(user.email)) {
            updateData.email = user.email;
        }
        await coll.updateOne({authID: user.sub},{$set:  updateData}, {upsert: true});
        return await lookupAccount(db, null, user.sub);
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    } 
}

export async function getAllAccessRequests(db, filter=null) {
    try {
        const coll = db.collection('accounts');
        let query;
        if (!filter) {
            query  = {"preferences.accessRequestStatus": {$ne: null}};
        } else {
            query = {"preferences.accessRequestStatus": filter};
        }
        const options = {
            projection: { _id: 0, accountID: 1, email: 1, preferences: 1, accessCode: 1, accessApprovalDate: 1 },
        }
        const documents = await coll.find(query, options).toArray();
        return documents;
    } catch (error) {
        console.error('Error looking up accounts: ', error);
        throw error;
    } 
}


export async function accountApproveAccessRequest(db, accountID, newCode) {
    try {
        const coll = db.collection('accounts');
        await coll.updateOne({accountID: accountID}, 
            {
                $set: {
                    "preferences.accessRequestStatus": "approved",
                    "accessCode": newCode,
                    "accessApprovalDate": new Date(),
                }
            }
        );
    } catch (error) {
        console.error('Error approving access request:', error);
        throw error;
    } 
}

export async function accountDenyAccessRequest(db, accountID) {
    try {
        const coll = db.collection('accounts');
        await coll.updateOne({accountID: accountID}, 
            {
                $set: {
                    "preferences.accessRequestStatus": "denied",
                }
            }
        );
    } catch (error) {
        console.error('Error denying access request:', error);
        throw error;
    } 
}


export const getAccountServiceKey = (account, keyName) => {
    if (account.preferences && account.preferences[keyName]) {
        return account.preferences[keyName];
    }
    return null;
} 
