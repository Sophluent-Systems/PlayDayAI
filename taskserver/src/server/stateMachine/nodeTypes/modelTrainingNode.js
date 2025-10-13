import { fileStoreNode } from './fileStoreNode.js';
import { submitTrainingJob, fetchTrainingJobStatus } from '../../tinker/client.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

const TERMINAL_STATUSES = new Set(['completed', 'succeeded', 'failed', 'cancelled']);
const FAILURE_STATUSES = new Set(['failed', 'cancelled']);

const DEFAULT_TRAINING_CONFIG = {
  optimizer: 'adamw',
  learningRate: 1e-4,
  epochs: 3,
  loraRank: 16,
  targetTokens: 200000,
  checkpointInterval: 1000,
  gpuTier: 'A10',
  evalDatasets: [],
  pollIntervalSeconds: 5,
  maxPollAttempts: 12,
};

function normalizeTrainingConfig(config = {}) {
  return {
    ...DEFAULT_TRAINING_CONFIG,
    ...config,
    learningRate: typeof config.learningRate === 'number' ? config.learningRate : DEFAULT_TRAINING_CONFIG.learningRate,
    epochs: Number.isFinite(config.epochs) ? config.epochs : DEFAULT_TRAINING_CONFIG.epochs,
    loraRank: Number.isFinite(config.loraRank) ? config.loraRank : DEFAULT_TRAINING_CONFIG.loraRank,
    targetTokens: Number.isFinite(config.targetTokens) ? config.targetTokens : DEFAULT_TRAINING_CONFIG.targetTokens,
    checkpointInterval: Number.isFinite(config.checkpointInterval) ? config.checkpointInterval : DEFAULT_TRAINING_CONFIG.checkpointInterval,
    pollIntervalSeconds: Number.isFinite(config.pollIntervalSeconds) ? config.pollIntervalSeconds : DEFAULT_TRAINING_CONFIG.pollIntervalSeconds,
    maxPollAttempts: Number.isFinite(config.maxPollAttempts) ? config.maxPollAttempts : DEFAULT_TRAINING_CONFIG.maxPollAttempts,
    evalDatasets: Array.isArray(config.evalDatasets) ? config.evalDatasets : DEFAULT_TRAINING_CONFIG.evalDatasets,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJobId(response) {
  return response?.job_id ?? response?.jobId ?? response?.id ?? null;
}

function extractJobStatus(response) {
  return (response?.status ?? response?.state ?? '').toLowerCase();
}

export class modelTrainingNode extends fileStoreNode {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, keySource, record }) {
    if (nullUndefinedOrEmpty(params?.baseModel, true)) {
      throw new Error('modelTrainingNode: baseModel is required');
    }

    const trainingDataset = Array.isArray(params.trainingDataset) ? params.trainingDataset : [];
    if (trainingDataset.length === 0) {
      throw new Error('modelTrainingNode: trainingDataset must include at least one file reference');
    }

    const trainingConfig = normalizeTrainingConfig(params.trainingConfig);
    const endpoint = params.serverUrl;
    const statusEndpoint = params.statusUrl ?? endpoint;

    let jobInfo = record?.context?.trainingJob ?? null;
    let latestResponse = null;

    if (!jobInfo) {
      const submission = await submitTrainingJob({
        baseModel: params.baseModel,
        trainingConfig,
        datasetArtifacts: trainingDataset,
        endpoint,
        apiKey: params.apiKey,
        keySource,
      });
      const submittedJobId = extractJobId(submission);
      if (!submittedJobId) {
        throw new Error('modelTrainingNode: Unable to determine job ID from submission response');
      }
      jobInfo = {
        jobId: submittedJobId,
        status: extractJobStatus(submission) || 'submitted',
        submittedAt: new Date().toISOString(),
      };
      latestResponse = submission;
    }

    let currentStatus = jobInfo.status;
    let attempts = 0;

    while (!TERMINAL_STATUSES.has(currentStatus) && attempts < trainingConfig.maxPollAttempts) {
      await delay(trainingConfig.pollIntervalSeconds * 1000);
      latestResponse = await fetchTrainingJobStatus({
        jobId: jobInfo.jobId,
        endpoint: statusEndpoint,
        apiKey: params.apiKey,
        keySource,
      });
      currentStatus = extractJobStatus(latestResponse) || currentStatus;
      attempts += 1;
    }

    jobInfo = {
      ...jobInfo,
      status: currentStatus,
      lastPolledAt: new Date().toISOString(),
      pollAttempts: (jobInfo.pollAttempts ?? 0) + attempts,
    };

    const isTerminal = TERMINAL_STATUSES.has(currentStatus);
    const isFailure = FAILURE_STATUSES.has(currentStatus);

    const output = {
      result: {
        jobId: jobInfo.jobId,
        status: currentStatus,
        details: latestResponse,
        pending: !isTerminal,
      },
    };

    const context = {
      trainingJob: jobInfo,
      trainingConfig,
      trainingDataset,
    };

    if (!isTerminal) {
      return {
        state: 'waitingForExternalInput',
        eventsEmitted: [],
        waitingFor: ['trainingJobCompletion'],
        output,
        context,
      };
    }

    if (isFailure) {
      return {
        state: 'failed',
        eventsEmitted: [],
        output,
        context,
        error: new Error(`Training job ${jobInfo.jobId} ${currentStatus}`),
      };
    }

    return {
      state: 'completed',
      eventsEmitted: ['completed'],
      output,
      context,
    };
  }
}

export default modelTrainingNode;
