import { ContextAwareNode } from './ContextAwareNode.js';
import { Config } from "@src/backend/config";
import { runAgentKit } from '../../agentKit.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

export class openAiAgentKitNode extends ContextAwareNode {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, channel, stateMachine, record, debuggingTurnedOn, keySource }) {
    const { Constants } = Config;

    if (nullUndefinedOrEmpty(params.prompt, true) && nullUndefinedOrEmpty(params.history)) {
      throw new Error("openAiAgentKitNode: history is required to construct agent input");
    }

    const historyMessages = stateMachine.convertToMessageList(params.history ?? [], {
      mediaTypes: ["text", "data"],
    });

    const agentResult = await runAgentKit({
      messages: historyMessages,
      agentBlueprint: params.agentBlueprint,
      connectorRefs: params.connectorRefs,
      appSurface: params.appSurface,
      metadata: params.observability ?? {},
      keySource,
      apiKey: params.apiKey,
      serverUrl: params.serverUrl,
      model: params.model,
    });

    const textOutput = agentResult.text ?? "";
    const result = {
      state: "completed",
      eventsEmitted: ["completed"],
      output: {
        result: {},
      },
      context: {
        agentResult: agentResult.raw,
      },
    };

    if (!nullUndefinedOrEmpty(textOutput, true)) {
      result.output.result.text = textOutput;
    }
    if (agentResult.raw) {
      result.output.result.data = agentResult.raw;
    }

    return result;
  }
}

export default openAiAgentKitNode;
