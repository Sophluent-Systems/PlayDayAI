import { ContextAwareNode } from './ContextAwareNode.js';
import { runMicrosoftAgentWorkflow } from '../../microsoftAgentFramework.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

function ensureObject(value, options = {}) {
  const { name } = options;
  if (value == null) {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      const descriptor = name ? `${name} ` : "";
      throw new Error(`microsoftAgentFrameworkNode: Unable to parse ${descriptor}JSON: ${error.message}`);
    }
  }
  return null;
}

export class microsoftAgentFrameworkNode extends ContextAwareNode {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, channel, stateMachine, record, keySource }) {
    if (nullUndefinedOrEmpty(params?.agentConfig)) {
      throw new Error("microsoftAgentFrameworkNode: agentConfig is required");
    }

    const historyMessages = stateMachine.convertToMessageList(params.history ?? [], {
      mediaTypes: ["text", "data"],
    });

    const workflowVariables = ensureObject(params.workflowVariables, { name: "workflowVariables" }) ?? {};
    const agentConfig = ensureObject(params.agentConfig, { name: "agentConfig" }) ?? {};
    const metadata = ensureObject(params.observability, { name: "observability" }) ?? params.observability ?? {};

    const runResult = await runMicrosoftAgentWorkflow({
      messages: historyMessages,
      agentConfig,
      workflowVariables,
      azureResourceProfile: params.azureResourceProfile,
      keySource,
      apiKey: params.apiKey,
      serverUrl: params.serverUrl,
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      tenantId: params.tenantId,
      metadata,
      scope: params.scope,
    });

    if (Array.isArray(runResult.events) && runResult.events.length > 0) {
      try {
        await channel.sendCommand("agentFrameworkEvents", {
          recordID: record?.recordID,
          events: runResult.events,
        });
      } catch (commandError) {
        console.error("microsoftAgentFrameworkNode: Failed to publish agent events", commandError);
      }
    }

    const output = {
      result: {
        text: runResult.text,
        data: runResult.raw,
      },
      agentEvents: {
        data: runResult.events,
      },
      artifactStoreRefs: {
        data: runResult.artifacts,
      },
    };

    return {
      state: "completed",
      eventsEmitted: ["completed"],
      output,
      context: {
        agentRun: runResult.raw,
        azureResourceProfile: runResult.profile,
      },
    };
  }
}

export default microsoftAgentFrameworkNode;
