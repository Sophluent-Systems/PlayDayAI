import { nodeType } from './nodeType.js';
import { runGoogleAdsMCPQuery } from '../../googleAds/mcpClient.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

export class adsCampaignInsightsNode extends nodeType {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, keySource }) {
    if (nullUndefinedOrEmpty(params?.gaqlQuery, true)) {
      throw new Error("adsCampaignInsightsNode: GAQL query is required");
    }

    const result = await runGoogleAdsMCPQuery({
      customerContext: params.customerContext,
      gaqlQuery: params.gaqlQuery,
      endpoint: params.serverUrl,
      apiKey: params.apiKey,
      keySource,
    });

    return {
      state: "completed",
      eventsEmitted: ["completed"],
      output: {
        result: {
          rows: result.rows,
          raw: result.raw,
        },
      },
      context: {
        customerContext: params.customerContext,
        gaqlQuery: params.gaqlQuery,
        rawResponse: result.raw,
      },
    };
  }
}

export default adsCampaignInsightsNode;
