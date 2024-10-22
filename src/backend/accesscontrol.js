import { lookupAccountInfoByIDs } from '@src/backend/accounts';
import { Config } from "@src/backend/config";
import { getGameTitlesByIDs } from '@src/backend/games';
import { nullUndefinedOrEmpty } from '@src/common/objects';


  export async function isUserAllowed(acl, account, requiredAccess="service_basicAccess") {

    //
    // *** Must not depend on account.roles being set yet
    //

    try {
      if (Array.isArray(requiredAccess)) {
        for (let i = 0; i < requiredAccess.length; i++) {
          const allowed = await acl.isAllowed(account.accountID, 'service', requiredAccess[i]);
          if (allowed) {
            return true;
          }
        }
      } else {
        const allowed = await acl.isAllowed(account.accountID, 'service', requiredAccess);
        return allowed;
      }
    } catch (error) {
      console.error(`Access control (isUserAllowed) failed with: ${error.message}`);
      return false;
    }
  }

  /*
  
    How ACLs are applied:

    - Users can be in 3 roles (admin, creator, consumer)
    - Admins can access anything across the system
    - Each game (identified by gameID) has 3 roles (owner, editor, player)
    - Games have these detailed permissions: Constants.gamePermissions = [
              'play',
              'viewSource',
              'viewUserSessions',
              'viewTrainingData',
              'viewUsageData',
              'edit',
              'delete',
            ];
    - Game owners have all permissions to their game including deleting the game
    - Game editors can access anything in the game except deleting the game
    - Game players can only haver permission to play the game
    - Users in the creator role have the viewSource permission by default for all games
    - All users in the consumer role are in the player role for all games by default
    

  
  */


  export async function initGameACLs(acl, game) {
    const { Constants } = Config;

      try {
        // Create a game-specific resource identifier using its gameID
        const gameResource = `game_${game.gameID}`;

        await acl.allow([
            {
                roles: `game_owner_${game.gameID}`,
                allows: [
                    { resources: gameResource, permissions: Constants.gamePermissions }  // Owners have all permissions
                ]
            },
            {
                roles: `game_editor_${game.gameID}`,
                allows: [
                    { resources: gameResource, permissions: Constants.gamePermissions.filter(p => p !== 'game_delete') }  // Editors have all permissions except delete
                ]
            },
            {
                roles: `game_sourceViewer_${game.gameID}`,
                allows: [
                    { resources: gameResource, permissions: 'game_viewSource' }  // Editors have all permissions except delete
                ]
            },
            {
                roles: `game_player_${game.gameID}`,
                allows: [
                    { resources: gameResource, permissions: 'game_play' }  // Players can only play
                ]
            }
        ]);

        await acl.addUserRoles(game.creatorAccountID, `game_owner_${game.gameID}`);

        await acl.addRoleParents('creator', `game_sourceViewer_${game.gameID}`);

        await acl.addRoleParents('consumer', `game_player_${game.gameID}`);

        await acl.addRoleParents('admin', `game_owner_${game.gameID}`);

    } catch (error) {
        console.error('Error setting up roles and permissions for game:', game.gameID, error);
    }
};



export async function hasRight(acl, accountID, right) {

  switch (right.resourceType) {
    case "game":
      return await acl.isAllowed(accountID, `game_${right.resource}`, right.access);
  }

  throw new Error(`Unknown resource type: ${right.resourceType}`);
}



export async function getGameRightsForUser(acl, accountID, gameID) {
  const gameRightsID = `game_${gameID}`;
  const rights = await acl.allowedPermissions(accountID, gameRightsID);
  return rights?.[gameRightsID] ? rights[gameRightsID] : [];
}


export async function getAccountRolesAndBasicPermissions(db, acl, accountID) {
  const roles  = await acl.userRoles(accountID);

  let ret = {
    userRoles: [],
    gameRoles: {},
    servicePermissions: [],
  }

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    if (role.startsWith("game_")) {
      // split this into 3 parts separated by underscores
      const parts = role.split("_");
      const access = parts[1];
      const gameID = parts[2];
      if (!ret.gameRoles[gameID]) {
        ret.gameRoles[gameID] = {
          roles: [],
          url: '',
          title: '',
          gameID: gameID,
        }
      }
      ret.gameRoles[gameID].roles.push(`game_${access}`);
    } else {
      ret.userRoles.push(role);
    }
  }

  const gameIDs = Object.keys(ret.gameRoles);

  const allGameTitlesAndUrls = await getGameTitlesByIDs(db, gameIDs);

  for (let i = 0; i < allGameTitlesAndUrls.length; i++) {
    const gameInfo = allGameTitlesAndUrls[i];
    ret.gameRoles[gameInfo.gameID].url = gameInfo.url;
    ret.gameRoles[gameInfo.gameID].title = gameInfo.title;
  }

  const servicePerms = await acl.allowedPermissions(accountID, 'service');
  ret.servicePermissions = servicePerms.service;

  return ret;
}

export async function getAllAccountPermissionsForGame(db, acl, gameID) {
  const { Constants } = Config;

  let accountsWithRoles = {};

  for (let i = 0; i < Constants.gameRoles.length; i++) {

      let accountsForthisRole = await acl.roleUsers(`${Constants.gameRoles[i]}_${gameID}`);

      for (let j = 0; j < accountsForthisRole.length; j++) {
        if (!accountsWithRoles[accountsForthisRole[j]]) {
          accountsWithRoles[accountsForthisRole[j]] = { roles: [], email: '', authID: ''}
        }
        accountsWithRoles[accountsForthisRole[j]].roles.push(Constants.gameRoles[i]);
      }
  }

  // Create an array from all the keys in accountsWithRoles
  const accountIDs = Object.keys(accountsWithRoles);

  // Fetch the account info for all the accountIDs
  const accountInfo = await lookupAccountInfoByIDs(db, accountIDs);

  // Add the account info to the accountsWithRoles object
  for (let i = 0; i < accountInfo.length; i++) {
    const account = accountInfo[i];
    accountsWithRoles[account.accountID].email = account.email;
    accountsWithRoles[account.accountID].authID = account.authID;
  }

  return accountsWithRoles;
}


export async function setAccountRoles(db, acl, accountID, rolesToAdd=[], rolesToRemove=[]) {

  if (rolesToAdd) {
    console.log("adding roles: ", accountID, rolesToAdd)
    await acl.addUserRoles(accountID, rolesToAdd);
  }
  if (rolesToRemove) {
    console.log("removing roles: ", accountID, rolesToRemove)
    await acl.removeUserRoles(accountID, rolesToRemove);
  }

  return await getAccountRolesAndBasicPermissions(db, acl, accountID);
}

export async function setGameRolesForAccount(acl, accountID, gameID, rolesToAdd=[], rolesToRemove=[]) {

  if (rolesToAdd) {
      console.log("adding roles: ", accountID, rolesToAdd);

      let rolesWithGameID = [];
      for (let i=0; i < rolesToAdd.length; i++) {
        rolesWithGameID.push(`${rolesToAdd[i]}_${gameID}`);
      }

      await acl.addUserRoles(accountID, rolesWithGameID);
  }

  if (rolesToRemove) {
    console.log("removing roles: ", accountID, rolesToRemove)
    
    let rolesWithGameID = [];
    for (let i=0; i < rolesToRemove.length; i++) {
      rolesWithGameID.push(`${rolesToRemove[i]}_${gameID}`);
    }

    await acl.removeUserRoles(accountID, rolesWithGameID);
  }

  return await getAccountRolesAndBasicPermissions(acl, accountID);
}

export async function setGameRolesForUserGroup(acl, gameID, gameRole, userGroups) {
  const { Constants } = Config;
  
  console.error("setGameRolesForUserGroup: gameID=", gameID, " gameRole=", gameRole, " userGroups=", userGroups);

  if (!gameRole || nullUndefinedOrEmpty(userGroups, true) || !Constants.gameRoles.includes(gameRole) || !userGroups.every(g => Constants.userRoles.includes(g))) {
    throw new Error("setGameRolesForUserGroup: Invalid parameters");
  }

  const fullGameRole = `${gameRole}_${gameID}`;
  
  // Create an array of the user groups to remove
  let userGroupsToRemove = [];
  for (let i = 0; i < Constants.userRoles.length; i++) {
    if (!userGroups.includes(Constants.userRoles[i])) {
      userGroupsToRemove.push(Constants.userRoles[i]);
    }
  }

  console.error("userGroupsToRemove: ", userGroupsToRemove);

  for (let i = 0; i < userGroupsToRemove.length; i++) {
    await acl.removeRoleParents(userGroupsToRemove[i], fullGameRole);
  }
  
  console.error("userGroupsToAdd: ", userGroups);

  for (let i = 0; i < userGroups.length; i++) {
    await acl.addRoleParents(userGroups[i], fullGameRole);
  }
}


  export async function oneTimeSpecialAction(acl) {
      console.log("ONE TIME SPECIAL ACTION!!");
      
      /*
      try {
      await acl.allow([
        {
            roles: `admin`,
            allows: [
                { resources: 'service', permissions: Constants.servicePermissions }  // Owners have all permissions
            ]
        },
        {
          roles: `creator`,
          allows: [
              { resources: 'service', permissions: ['service_basicAccess', 'service_editMode'] }  // Owners have all permissions
          ]
        },
        {
          roles: `consumer`,
          allows: [
              { resources: 'service', permissions: 'service_basicAccess' }  // Owners have all permissions
          ]
        },
        {
          roles: `guest`,
          allows: [
              { resources: 'service', permissions: [] }  //Guests have no permissions
          ]
        },
    ]);
  } catch (error) {
    console.error('Error setting up roles and permissions for service:', error);
  }
  */
  }
