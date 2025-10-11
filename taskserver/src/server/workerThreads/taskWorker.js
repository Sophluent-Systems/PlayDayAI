import { claimTask } from '@src/backend/tasks';
import { runStateMachine } from '../runstatemachine';
import { InProcessSessionChannel } from '@src/common/pubsub/inprocesssessionchannel.js';
import { lookupAccount } from '@src/backend/accounts';
import ACL from 'acl2';
import { promisify } from 'util';
import { Constants } from "@src/common/defaultconfig";
import { getMachineIdentifier } from '../machineid';
import { threadClaimSession, threadSetInactive } from '../threads';
import { v4 as uuidv4 } from 'uuid';
import { workerData } from 'worker_threads';
import { getMongoDb } from '@src/backend/mongodb.js';

const machineID = await getMachineIdentifier();
const threadID = uuidv4();
console.error(`[taskworker] machineID=`, machineID, ` threadID=`, threadID);

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
};

async function cleanup(channel) {
  if (!channel) {
    return;
  }

  try {
    await channel.close();
  } catch (closeError) {
    console.error('[taskworker] Error closing channel: ', closeError);
  }
}

export default async ({ sessionID, port }) => {
  console.error(`[worker ${threadID}] Task worker started`);
  let result = "done";
  let channel = null;
  let activeSession = null;
  const expirationTimeMS = Constants.config.sessionUpdateTimeout;

  try {
    let { db, acl } = await updateDB();

    const successful = await threadClaimSession({
      db,
      sessionID,
      machineID,
      threadID,
      expirationTimeMS,
    });

    if (!successful) {
      console.error(`[worker ${threadID}] Session already claimed: `, sessionID);
      return;
    }

    activeSession = sessionID;

    let task = await claimTask(db, sessionID, machineID, threadID);

    channel = new InProcessSessionChannel({ port, sessionID });
    await channel.connect();

    while (task) {
      try {
        Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Task claimed: taskID=`, task.taskID);

        ({ db, acl } = await updateDB());
        const account = await lookupAccount(db, task.accountID, null, null);

        await runStateMachine(db, acl, account, channel, task, threadID);

        await task.setComplete();
        Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Task completed: taskID=`, task.taskID);

        task = await claimTask(db, sessionID, machineID, threadID);
        Constants.debug.logTaskSystem && console.error(`[worker ${threadID}] Next task: `, task ? task.taskID : "none");
      } catch (taskError) {
        console.error("[taskworker] Error running task: ", taskError);
        result = "error: " + taskError.message + "\n\n" + taskError.stack;
        break;
      }
    }

    if (activeSession) {
      console.error(`[worker ${threadID}] Setting session ${activeSession} thread inactive`);
      await threadSetInactive(db, activeSession);
      activeSession = null;
    } else {
      console.error(`[worker ${threadID}] No active session to set inactive`);
    }
  } catch (e) {
    console.error("[taskworker] Error in taskWorker: ", e);
    result = "error: " + e.message + "\n\n" + e.stack;
  } 

  if (channel) {
    //await cleanup(channel);
  }
  
  return result;
};
