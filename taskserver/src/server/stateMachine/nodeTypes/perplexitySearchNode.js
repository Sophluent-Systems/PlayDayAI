import { nodeType } from './nodeType.js';
import { runPerplexitySearch } from '../../perplexity.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

export class perplexitySearchNode extends nodeType {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, keySource }) {
    if (nullUndefinedOrEmpty(params?.query, true)) {
      throw new Error("perplexitySearchNode: query is required");
    }

    const result = await runPerplexitySearch({
      query: params.query,
      searchConfig: params.searchConfig,
      keySource,
      apiKey: params.apiKey,
      serverUrl: params.serverUrl,
    });

    return {
      state: "completed",
      eventsEmitted: ["completed"],
      output: {
        result: {
          snippets: result.snippets,
          raw: result.raw,
        },
      },
      context: {
        query: params.query,
        searchConfig: params.searchConfig,
        rawResponse: result.raw,
      },
    };
  }
}

export default perplexitySearchNode;
