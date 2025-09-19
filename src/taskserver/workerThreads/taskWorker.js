// taskWorker.js
import { claimTask } from '@src/backend/tasks';
import { runStateMachine } from '@src/taskserver/runstatemachine';
import { openPubSubChannel } from '@src/common/pubsub/pubsubapi.js';
import { lookupAccount } from '@src/backend/accounts';
import ACL from 'acl2';
import { promisify } from 'util';
import { Constants } from "@src/common/defaultconfig";
import { getMachineIdentifier } from '@src/taskserver/machineid';
import { threadClaimSession, threadSetInactive } from '@src/taskserver/threads';
import { v4 as uuidv4 } from 'uuid';
import { workerData } from 'worker_threads';
import { getMongoDb } from '@src/backend/mongodb.js';


const machineID = await getMachineIdentifier();
const threadID = uuidv4();
console.error("[taskworker] machineID=", machineID, " threadID=", threadID);

const updateDB = async () => {
  const db = await getMongoDb("pd");
  const acl_db = await getMongoDb("pd_acls");
  
  const aclMongoBackend = new ACL.mongodbBackend({ client: workerData.mongoClient, db: acl_db, prefix: "acl_" });
  const acl = new ACL(aclMongoBackend);

  acl.allowAsync = promisify(acl.allow).bind(acl);
  acl.isAllowedAsync = promisify(acl.isAllowed).bind(acl);
  acl.allowedPermissionsAsync = promisify(acl.allowedPermissions).bind(acl);
  acl.addUserRolesAsync = promisify(acl.addUserRoles).bind(acl);
  acl.addRoleParentsAsync = promisify(acl.addRoleParents).bind(acl);

  return { db, acl };
}
async function cleanup(channel, db) {
  if (channel) {
    await channel.close();
  }
  // No need to close the db connection as it's managed by the Singleton
}

export default async ({ sessionID }) => {
    
    console.error(`[worker ${threadID}] Task worker started`);
    let result = "done";
    let channel = null;

    try {
      let dbInfo = await updateDB();
      let db = dbInfo.db;
      let acl = dbInfo.acl;
      
      const expirationTimeMS = Constants.config.sessionUpdateTimeout;

      const successful = await threadClaimSession(
          db, 
          sessionID, 
          machineID, 
          threadID, 
          expirationTimeMS);

      if (!successful) {
        console.error(`[worker ${threadID}] Session already claimed: `, sessionID);
        return;
      }

      let activeSession = sessionID;


      try {

        let task = await claimTask(db, sessionID, machineID, threadID);
        
        while (task) {
          Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Task claimed: taskID=`, task.taskID);

          dbInfo = await updateDB();
          db = dbInfo.db;
          acl = dbInfo.acl;

          const channel = await openPubSubChannel(`session_${task.sessionID}`, task.sessionID);

          let account = await lookupAccount(db, task.accountID, null, null);

          Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Running state machine`)

          await runStateMachine(db, acl, account, channel, task, threadID);
          await task.setComplete();
          Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Task completed: taskID=`, task.taskID);

          task = await claimTask(db, sessionID, machineID, threadID);

          Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Next task: `, task ? task.taskID : "none");
        }
      } catch (e) {
        console.error("[taskworker] Error running task: ", e);
        result = "error: " + e.message + "\n\n" + e.stack;
      }

      if (activeSession) {
        console.error(`[worker ${threadID}] Setting session inactive: `, activeSession);
        await threadSetInactive(db, activeSession);
        activeSession = null;
      } else {
        console.error(`[worker ${threadID}] No active session to set inactive`);
      }
      
      await cleanup(channel, db);

    } catch (e) {
      console.error("[taskworker] Error in taskWorker.js setup code: ", e);
      result = "error: " + e.message + "\n\n" + e.stack;
    }

    
    return result;
  };

