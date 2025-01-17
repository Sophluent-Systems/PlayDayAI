import { 
  getGameSession,
} from '@src/backend/gamesessions';
import { Config } from "@src/backend/config";
import { getRandomInt } from '@src/common/math';
import { hasRight } from '@src/backend/accesscontrol';
import { StateMachine } from './stateMachine/stateMachine';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { threadHeartbeat } from '@src/backend/threads';

// This function is called from taskWorker.js

export async function runStateMachine(db, acl, account, channel, task, threadID) {
  const { Constants } = Config;

  Constants.debug.logTaskSystem && console.log("runStateMachine starting... ");
  
  const params = task.getParams();
  const { sessionID, seed, singleStep } = params;

  if (nullUndefinedOrEmpty(sessionID)) {
    console.log("Invalid parameters", JSON.stringify(params));
    await channel.sendCommand("error", 'Invalid parameters');
    return;
  }

  // Proceed with the rest of the function as before, replacing HTTP responses with WebSocket messages
  let session = await getGameSession(db, account.accountID, sessionID, false);
  if (sessionID && !session) {
    console.log("Couldn't find session ", sessionID);
    await channel.sendCommand("error", `Session ${sessionID} could not be found.`);
    return;
  }

  try {

    //
    // WE HAVE A GAME SESSION
    //


    const hasEditPermissions = await hasRight(acl, account.accountID, {resourceType: "game", resource: session.gameInfo.gameID, access: ["game_edit"]});

    //
    // WE HAVE THE GAME VERSION TO PLAY
    //

    // Create temporary context (not written) to track the state of the conversation
    session.temp = {};
    session.temp.hasEditPermissions = hasEditPermissions;
    session.temp.debuggingTurnedOn = hasEditPermissions && (account.preferences?.editMode ? true : false);
    // use request seed first, then "global" seed, then none
    session.temp.seedOverrided = false;
    if ((typeof seed == "number") || account.preferences?.debugSettings?.seedOverrideEnabled) {
      session.temp.seedOverrided = true;
      session.temp.seed = (typeof seed == "number") ? seed : account.preferences.debugSettings.seedOverrideValue;
      if (typeof session.temp.seed != "number") {
        try { 
          session.temp.seed = parseInt(session.temp.seed);
        } catch(err) {
          console.warn(`Failed to parse seed of ${session.temp.seed} with ${err}`);
          session.temp.seed = -1;
        }
      }
    } else {
      session.temp.seed = getRandomInt(1, 99999999);
    }
    console.log("SEED: ", session.temp.seed);

    session.temp.stateMachine = new StateMachine(db, session);
    await session.temp.stateMachine.load();
    
    let halt = null;
    let active = true;
    let stepLimit = singleStep ? 1 : Constants.config.hardCodedStepLimit;
    console.error("STEP LIMIT: ", stepLimit, `(singleStep: ${singleStep})`);
    console.error("DEBUGGING TURNED ON: ", session.temp.debuggingTurnedOn ? "YES" : "NO")

    const incomingCommandHandler = {
      "stateMachineCommand": (command, data) => {
        Constants.debug.logStateMachine && console.error(`[received command]: ${data.command}`);
        switch (data.command) {
          case "halt":
            halt = "User requested halt";
            return true;
          case "continuation":
            console.error("   ^^^ Continuation command received, active=", active, " halt=", halt);
            return (halt == null) && active;
          default:
            console.error(`Unknown command: ${data.command}`);
            return false;
        }
      },
    }

    channel.subscribe(incomingCommandHandler);

    const wasCancelled = () => {
      return halt;
    }

    //
    // Pre-node, we're about to process
    //
    const onPreNode = async ({ record, runInfo }) => {
      // nothing for now
    }

    //
    // Post-node, on success OR failure of the node (state machine errors not handled here)
    //
    const onPostNode = async ({ runInfo, record, results }) => {
        
      if (results.state == "waitingForExternalInput") {
          await channel.sendCommand("statemachinestatusupdate", 
            {
              state: results.state, 
              waitingFor: results.waitingFor, 
              nodeInstanceID: runInfo.nodeInstance.fullNodeDescription.instanceID,
              maximumInputLength: runInfo.nodeInstance.fullNodeDescription.params.tokenLimit,
              conversational: runInfo.nodeInstance.fullNodeDescription.params.conversational || false,
            });
      }

      //
      // Push out the timeout for this task
      //

      task.resetExpirationTime();
      threadHeartbeat(db, sessionID);
    }

    const onStateMachineError = async (error) => {
      const errorToSend = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      };

      // Something really bad happend -- halt the queue immediately
      halt = "State machine failure: " + errorToSend.message;

      // report to the caller
      console.error("### StateMachine internal error: ", errorToSend.message, "\n", errorToSend.stack);
      await channel.sendCommand("statemachinestatusupdate", {state: "error", errorDetails: errorToSend});
    }

    //
    //
    //
    // STATE MACHINE WORK IS DONE HERE -- DRAIN THE QUEUE
    //
    //
    //

    await channel.sendCommand("statemachinestatusupdate", {state: "started"});
  
    //
    // Let callers know what we're up to
    //


    await session.temp.stateMachine.drainQueue({ 
      stepLimit: stepLimit, 
      channel, 
      seed, 
      debuggingTurnedOn: session.temp.debuggingTurnedOn,
      account, // account of the caller
      onPreNode,
      onPostNode,
      onStateMachineError,
      wasCancelled,
      debugID: threadID,
    });
    
    active = false;
    await channel.sendCommand("statemachinestatusupdate", {state: "stopped"});
      
  } catch(error) {
    const errorMessage = error.message ? error.message : error.response?.status;
    console.log("runStateMachine error: ", errorMessage);
    console.log(error.stack);
    await channel.sendCommand("error", {message: errorMessage});
  }
};
  
