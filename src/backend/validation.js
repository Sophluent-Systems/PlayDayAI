//
// DO NOT IMPORT 'CONSTANTS'... ON THE CRITICAL PATH OF RETRIEVING CONSTANTS
//
import { validateToken } from './auth';
import { isUserAllowed, getAccountRolesAndBasicPermissions, hasRight, setAccountRoles } from './accesscontrol';
import { lookupAccount, addNewAccount, updateAccountInfo, logAccountAccess } from './accounts';
import { getMongoClient } from '@src/backend/mongodb.js';
import ACL from 'acl2';
import { promisify } from 'util';
import { Config, loadConfig } from "@src/backend/config";
import { nullUndefinedOrEmpty } from '@src/common/objects';


async function getOrAddAccount(db, acl, user) {
  try {
      let account = await lookupAccount(db, null, user.sub, null);
      if (account) {
          return account;
      }

      // If we get here, we need to add a new account
      account = await addNewAccount(db, user.sub);
      account = await updateAccountInfo(db, user, account);

      await acl.addUserRoles(account.accountID, 'guest');

      return account;

  } catch (error) {
      console.error('getOrAddAccount failed unexpectedly: ', error);
      return null;
  } 
}

async function removeDeadAccounts(db) {
  
  const accountColl = db.collection('accounts');
  const allAccounts = await accountColl.find({email: null}).toArray();
  
  console.log("accounts found: ", allAccounts.length)

  for (let j = 0; j < allAccounts.length; j++) {

    const account = allAccounts[j];
    if (!account.email) {
      console.log("DELETING ", account.authID, account.email);
      await accountColl.deleteOne({ authID: account.authID });
    }
  }
}

async function commonAuthAndValidationInternal(user, accessToken, requiredAccess="service_basicAccess") {
  let result = {validationError: null}

  result.user = user;
  
  //
  // GET DB
  //

  const mongoClient = await getMongoClient();
  const db = mongoClient.db("pd");
  const acl_db = mongoClient.db("pd_acls")
  result.db = db;

  
  try {
    await loadConfig(db);
    result.Constants = Config.Constants;

    //
    // Get access control list (ACL) provider
    //
    const aclMongoBackend = new ACL.mongodbBackend({ client: mongoClient, db: acl_db, prefix: "acl_" });
    let acl = new ACL(aclMongoBackend);
    acl.allowAsync = promisify(acl.allow).bind(acl);
    acl.isAllowedAsync = promisify(acl.isAllowed).bind(acl);
    acl.allowedPermissionsAsync = promisify(acl.allowedPermissions).bind(acl);
    acl.addUserRolesAsync = promisify(acl.addUserRoles).bind(acl);
    acl.addRoleParentsAsync = promisify(acl.addRoleParents).bind(acl);
    result.acl = acl;

    let account = await getOrAddAccount(db, acl, user);
    if (!account) {
        console.log("Couldn't find or create an account for ", user.sub);

        return { validationError: { status: 404, message: `${user.sub} account could not be found.` }};
    }


    //
    // Check if user is allowed
    //

    if (!(await isUserAllowed(acl, account, requiredAccess))) {
     
      //
      // Special case -- if this account is the admin account, we need to create it
      // with the right roles
      //
      
      if (!nullUndefinedOrEmpty(process.env.AUTH_ADMIN_ACCOUNT) && 
          typeof user?.email === 'string' &&
          user.email === process.env.AUTH_ADMIN_ACCOUNT) {

          console.log("Identified admin account: ", user.email);
          await setAccountRoles(db, acl, account.accountID, ['consumer', 'creator', 'admin'], ['guest']);          
      } else {
        console.log(user.sub, "/", user.email, " is not allowed to access the service.");
        return { validationError: {status: 403, message: "You are not allowed to access the service." }};
      }
    }

    account = await logAccountAccess(db, user, account);
    
    //
    // Roles come here now that we're not retrieving account from the DB anymore
    //

    delete account.roles;
    const roles = await getAccountRolesAndBasicPermissions(db, acl, account.accountID);
    account.roles = roles;
    const isAdmin = roles.userRoles.includes("admin");

    result.accessToken = accessToken;
    result.isAdmin = isAdmin;
    result.account = account;
    return result;

  } catch (error) {
    console.error(`Error getting account for ${user.sub}: ${error.stack}`);
    return { validationError: { status: 500, message: `Error validating account for ${user.sub}: ${error}` }};
  }

}

export async function doAuthAndValidation(method, req, res, requiredAccess="service_basicAccess") {  
    //
    // CHECK METHOD
    //
  
    if (req.method != method) {
      console.warn("Method not allowed");
      return { validationError: {status: 405, message: 'Method not allowed' }};
    }
  
    //
    // CHECK AUTH (AUTH0)
    // 
  
    const { user, accessToken } = req;
    if (!user || !user.sub) {
        console.error("No user information found on request.");
        return { validationError: {status: 403, message: 'No user authenticated' }};
    }

    return await commonAuthAndValidationInternal(user, accessToken, requiredAccess);

}


export async function doAuthAndValidationToken(accessToken, requiredAccess="service_basicAccess") {
  console.log ("doAuthAndValidationToken")

  try {
    const user = await validateToken(accessToken);
    if (!user || !user.sub) {
        console.warn("validateToken: no user or email. received: ", user);
        throw new Error('No user authenticated');
    }
    
    return await commonAuthAndValidationInternal(user, accessToken, requiredAccess);

  } catch (error) {
    console.error('Error validating token: ', error);
    return { validationError: { status: 403, message: error.message }};
  }
}

export async function validateRequiredPermissions(acl, account, rightsRequired=[]) {

  const isAdmin = account.roles.servicePermissions.includes("service_modifyGlobalPermissions");

  try {
    
    if (!isAdmin && rightsRequired) {
      for (let i=0; i < rightsRequired.length; i++) {

        const rightRequired = rightsRequired[i];
        const hasPermission = await hasRight(acl, account.accountID, rightRequired);
        if (!hasPermission) {
          return { permissionsError: { status: 403, message: `${account.accountID} does not have permission for '${rightRequired.access}' on ${rightRequired.resource}` }};
        }
      }
    }

    return { permissionsError: null };
  } catch (error) {
    console.error(`Error getting account for ${account.accountID}: ${error.stack}`);
    return { permissionsError: { status: 500, message: `Error validating account for ${account.accountID}: ${error}` }};
  }
}
