import { Config } from '@src/backend/config';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getAccountServiceKey } from '@src/backend/accounts';

const JSON_TYPE = 'application/json';

function resolveApiKey({ keySource, apiKey, accountKeyName }) {
  if (keySource?.source === 'account') {
    return getAccountServiceKey(keySource.account, accountKeyName);
  }
  return apiKey;
}

export async function submitTrainingJob({
  baseModel,
  trainingConfig,
  datasetArtifacts,
  endpoint,
  apiKey,
  keySource,
}) {
  const { Constants } = Config;

  if (nullUndefinedOrEmpty(baseModel, true)) {
    throw new Error('Tinker API: base model is required');
  }

  if (!Array.isArray(datasetArtifacts) || datasetArtifacts.length === 0) {
    throw new Error('Tinker API: at least one dataset artifact is required');
  }

  const resolvedKey = resolveApiKey({
    keySource,
    apiKey,
    accountKeyName: 'tinkerApiKey',
  });

  if (nullUndefinedOrEmpty(resolvedKey)) {
    throw new Error('Tinker API: missing API key');
  }

  const url =
    endpoint ??
    Constants.endpoints?.training?.tinker?.defaultUrl ??
    'https://api.tinker.ai/v1/jobs';

  const body = {
    base_model: baseModel,
    training_config: trainingConfig,
    datasets: datasetArtifacts,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      'Content-Type': JSON_TYPE,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`Tinker training job creation failed (${response.status}): ${failureText}`);
  }

  return response.json();
}

export async function fetchTrainingJobStatus({
  jobId,
  endpoint,
  apiKey,
  keySource,
}) {
  const { Constants } = Config;

  if (nullUndefinedOrEmpty(jobId, true)) {
    throw new Error('Tinker API: jobId is required for status polling');
  }

  const resolvedKey = resolveApiKey({
    keySource,
    apiKey,
    accountKeyName: 'tinkerApiKey',
  });

  if (nullUndefinedOrEmpty(resolvedKey)) {
    throw new Error('Tinker API: missing API key');
  }

  const baseUrl =
    endpoint ??
    Constants.endpoints?.training?.tinker?.statusUrl ??
    'https://api.tinker.ai/v1/jobs';

  const response = await fetch(`${baseUrl}/${jobId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${resolvedKey}`,
      'Content-Type': JSON_TYPE,
    },
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`Tinker training status fetch failed (${response.status}): ${failureText}`);
  }

  return response.json();
}
