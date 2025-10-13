# 2025 AI API Integration Plan

This document captures the integration work required to support the latest AI APIs (post–June 2025) inside PlayDayAI. It expands on earlier recommendations and adds configuration details for new credentials.

---

## New Node Types

### `videoGenerationNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/videoGenerationNode.js`)*
- **Inherits:** `nodeType` (`taskserver/src/server/stateMachine/nodeTypes/nodeType.js:1`)
- **Purpose:** Wrap OpenAI Sora 2 for text-to-video generation with optional reference assets.
- **Inputs:**
  - `prompt` (existing text)
  - `videoGenerationSettings` (new JSON; see “New Input Types”)
  - `referenceAssets` (existing file array from `fileStoreNode`)
- **Outputs:**
  - `videoAsset` (URI + metadata persisted via `fileStoreNode`)
  - `soraMetadata` (JSON: seed, duration, safety flags, cost)
- **Notes:** Reuse image-generation audit hooks; expose duration/frame-rate controls through builder metadata.

### `openAiAgentKitNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/openAiAgentKitNode.js`)*
- **Inherits:** `ContextAwareNode` (`taskserver/src/server/stateMachine/nodeTypes/ContextAwareNode.js:1`)
- **Purpose:** Execute OpenAI AgentKit workflows (Responses API + Apps SDK + Connector Registry).
- **Inputs:**
  - `conversation` (existing transcripts)
  - `agentBlueprint` (new JSON)
  - `connectorRefs` (new structured input)
  - `appSurface` (existing object for ChatKit hints; optional)
- **Outputs:**
  - `agentTrace` (OpenTelemetry bundle suitable for debugger UI)
  - `agentResult` (final tool output/state snapshot)
- **Notes:** Supports resume semantics; should surface tool usage events over WebSocket.

### `microsoftAgentFrameworkNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/microsoftAgentFrameworkNode.js`)*
- **Inherits:** `ContextAwareNode`
- **Purpose:** Run Microsoft Agent Framework pipelines combining Semantic Kernel, AutoGen, and MCP connectors.
- **Inputs:**
  - `agentConfig` (existing JSON; validated against Agent Framework schema)
  - `workflowVariables` (existing map for environment variables/secrets)
  - `azureResourceProfile` (new structured input)
- **Outputs:**
  - `agentEvents` (state transitions for visualization)
  - `artifactStoreRefs` (URIs emitted by connectors such as SharePoint/Elastic)
- **Notes:** Ensure connector credentials are pulled from secure storage via `keySource`.

### `uiAutomationNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/uiAutomationNode.js`)*
- **Inherits:** `nodeType`
- **Purpose:** Drive Google Gemini 2.5 Computer Use to automate browser/mobile UI interactions.
- **Inputs:**
  - `taskDescription` (existing text)
  - `viewport` (new blob/DOM snapshot)
  - `sessionState` (existing JSON for cookies/cursors)
- **Outputs:**
  - `actionPlan` (ordered list of click/type/scroll actions)
  - `updatedViewport` (latest screenshot for validation)
- **Notes:** Enforce per-step safety checks and configurable rate limits.

### `perplexitySearchNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/perplexitySearchNode.js`)*
- **Inherits:** `nodeType`
- **Purpose:** Retrieve ranked web snippets from the Perplexity Search API for grounding and RAG flows.
- **Inputs:**
  - `query` (existing text)
  - `searchConfig` (new JSON; freshness, locale, snippet count)
- **Outputs:**
  - `searchSnippets` (title, URL, excerpt, relevance score)
  - `searchDiagnostics` (latency, usage, fallback flags)
- **Notes:** Designed to feed `llmDataNode`; can stream partial results to the UI.

### `adsCampaignInsightsNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/adsCampaignInsightsNode.js`)*
- **Inherits:** `nodeType`
- **Purpose:** Query Google Ads via the open-source MCP server for campaign and ad group metrics.
- **Inputs:**
  - `customerContext` (new structured input with login/customer IDs)
  - `gaqlQuery` (existing text)
  - `timeRange` (existing object; optional)
- **Outputs:**
  - `campaignMetrics` (JSON keyed by campaign/ad group)
  - `queryTranscript` (record of MCP requests for auditing)
- **Notes:** Default to read-only scopes; integrate access control checks before execution.

### `modelTrainingNode`
- *Status: Implemented (`taskserver/src/server/stateMachine/nodeTypes/modelTrainingNode.js`)*
- **Inherits:** `fileStoreNode` (`taskserver/src/server/stateMachine/nodeTypes/fileStoreNode.js:1`)
- **Purpose:** Submit fine-tuning jobs through Thinking Machines’ Tinker API (LoRA/RLHF).
- **Inputs:**
  - `baseModel` (existing select input referencing catalogued models)
  - `trainingDataset` (existing file array)
-  `trainingConfig` (new JSON; optimizer, epochs, checkpoints, GPU tier)
- **Outputs:**
  - `tuningJobStatus` (state + progress updates)
  - `fineTunedModelRef` (identifier for downstream `llmNode` usage)
- **Notes:** Long-running/async; rely on status polling and emit completion events.

---

[x] New input editors implemented

## New Input Types

Register the following schemas in `packages/shared/src/common/nodeMetadata.js` (and builder UI):

| Input Type | Description | Consumers |
|------------|-------------|-----------|
| `videoGenerationSettings` | `{ durationSeconds, frameRate, aspectRatio, stylePreset, safetySensitivity, negativePrompts[], cameraPath }` | `videoGenerationNode` |
| `agentBlueprint` | OpenAI AgentKit spec (`role`, `goals`, `tools`, `evaluators`, `memory`) | `openAiAgentKitNode` |
| `connectorRefs` | Array of `{ connectorId, authProfileId, scopes[] }` | `openAiAgentKitNode` |
| `azureResourceProfile` | `{ tenantId, subscriptionId, aiFoundryEndpoint, loggingWorkspaceId, telemetrySampleRate }` | `microsoftAgentFrameworkNode` |
| `viewport` | Screenshot/blob or structured DOM diff (base64) | `uiAutomationNode` |
| `searchConfig` | `{ freshnessWindow, locale, snippetLimit, safeMode, allowedDomains[] }` | `perplexitySearchNode` |
| `customerContext` | `{ loginCustomerId, customerId, oauthProfileId }` | `adsCampaignInsightsNode` |
| `trainingConfig` | `{ optimizer, learningRate, epochs, loraRank, targetTokens, checkpointInterval, gpuTier, evalDatasets[] }` | `modelTrainingNode` |

---

[x] Existing node support updated

## Existing Node Updates

- **`llmNode.js` (`taskserver/src/server/stateMachine/nodeTypes/llmNode.js:1`):**
  - Add adapters for OpenAI GPT-5 Pro, Anthropic Claude Sonnet 4.5, Google Gemini 2.5 text models.
  - Integrate OpenRouter routing to expose community/commercial models via a single provider entry.
  - Ensure support for expanded context windows, JSON `response_format`, and model-specific safety toggles.

- **`llmDataNode.js` (`taskserver/src/server/stateMachine/nodeTypes/llmDataNode.js:1`):**
  - Register Perplexity and Google Ads MCP as data providers.
  - Allow ingestion of upstream node outputs (`perplexitySearchNode`, `adsCampaignInsightsNode`).
  - Support OpenRouter retrieval/embedding models where available.

- **`codeBlockNode.js` (`taskserver/src/server/stateMachine/nodeTypes/codeBlockNode.js:1`):**
  - Surface GPT-5 Pro and Claude Sonnet 4.5 for extended coding sessions.
  - Handle longer execution traces and enforce sandbox resets to mitigate 30‑hour reasoning loops.

- **`imageGeneratorNode.js` (`taskserver/src/server/stateMachine/nodeTypes/imageGeneratorNode.js:1`):**
  - Add Google Imagen 4 (Gemini API) as a provider.
  - Capture SynthID watermark metadata for provenance in outputs.

- **`sttNode.js` / `ttsNode.js`:**
  - Extend provider registry to include OpenRouter-hosted speech models (where permitted by policy).

- **Builder/UI layers (`packages/shared/...`):**
  - Update node metadata to expose new nodes and input editors.
  - Extend chatbot and debugging views to understand AgentKit/Microsoft agent traces and UI automation streams.

- **Scheduler / worker threads (`taskserver/src/server/workerThreads/taskWorker.js`):**
  - Add OpenRouter HTTP client with retry/backoff aligned to their rate-limit headers.
  - Support asynchronous status polling for `modelTrainingNode`.

---

## Configuration & API Keys

- [x] API key inventory documented in code and settings UI

Add the following environment variables (with secure storage) to support new integrations:

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Required for GPT-5 Pro, Sora 2, Responses API, AgentKit. (Existing, ensure scope includes new endpoints.) |
| `OPENAI_AGENTKIT_WEBHOOK_SECRET` | Verifies callbacks from OpenAI Apps SDK hosts. |
| `OPENAI_CONNECTOR_REGISTRY_KEY` | Grants access to Connector Registry actions used by AgentKit. |
| `MICROSOFT_AGENT_FRAMEWORK_CLIENT_ID` | OAuth client for Microsoft Agent Framework. |
| `MICROSOFT_AGENT_FRAMEWORK_CLIENT_SECRET` | Companion secret for the client ID. |
| `AZURE_AI_FOUNDRY_ENDPOINT` | Endpoint base for Agent Framework tool invocations. |
| `AZURE_ENTRA_TENANT_ID` | Tenant context for Azure authentication. |
| `GOOGLE_GEMINI_API_KEY` | Required for Gemini 2.5 Computer Use and Imagen 4 APIs. |
| `GOOGLE_ADS_MCP_SERVICE_ACCOUNT_KEY_PATH` | Path to service account JSON for Google Ads MCP server. |
| `PERPLEXITY_API_KEY` | Access token for the Perplexity Search API. |
| `IBM_API_CONNECT_KEY` | Credentials for IBM DataPower Nano Gateway/API Developer Studio (API Connect). |
| `IBM_API_CONNECT_SECRET` | Companion secret (store securely). |
| `TINKER_API_KEY` | Authentication for Thinking Machines Tinker fine-tuning API. |
| `TINKER_WEBHOOK_SECRET` | Validates training job callbacks. |
| `OPENROUTER_API_KEY` | Enables OpenRouter as a unified model provider. |
| `TEMPORAL_CLOUD_API_KEY` *(optional)* | If adopting Temporal’s durable agent orchestration. |

Update `packages/shared/src/common/defaultconfig.js` and deployment manifests to reference these keys, and extend settings UI (if applicable) to allow environment-specific overrides.

---

## Reference Links

- OpenAI DevDay 2025 (GPT-5 Pro, Sora 2, AgentKit, Apps SDK): https://www.infoq.com/news/2025/10/openai-dev-day/
- Microsoft Agent Framework preview: https://www.infoq.com/news/2025/10/microsoft-agent-framework/
- Google Gemini 2.5 Computer Use model: https://www.infoq.com/news/2025/10/gemini-computer-use/
- Google Ads MCP server release: https://ppc.land/google-releases-open-source-mcp-server-for-ads-api-integration/
- Perplexity Search API launch: https://www.infoq.com/news/2025/09/perplexity-search-api/
- Thinking Machines Tinker API: https://www.infoq.com/news/2025/10/thinking-machines-tinker/
- Claude Sonnet 4.5 announcement: https://www.infoq.com/news/2025/10/claude-sonnet-4-5/
- Temporal + OpenAI Agents integration: https://www.infoq.com/news/2025/09/temporal-aiagent/
