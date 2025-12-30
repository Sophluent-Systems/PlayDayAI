import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getPendingRecordForNodeInstance, updateRecord } from '@src/backend/records';
import { messageFromRecord, getNodeByInstanceID } from '@src/backend/messageHistory';
import { enqueueSessionCommand, getActiveSessionMachine } from '@src/backend/sessionCommands';
import { getAccountServiceKey } from '@src/backend/accounts';

export const SUPPORTED_INPUT_TYPES = [
  'text',
  'audio',
  'image',
  'video',
];

function validateMediaTypes(mediaTypes) {
  if (nullUndefinedOrEmpty(mediaTypes) || typeof mediaTypes !== 'object') {
    throw new Error('Invalid parameter - missing mediaTypes');
  }
}

function resolveSupportedTypes(nodeInstance) {
  const params = nodeInstance?.params ?? {};
  const resolved = new Set();

  if (Array.isArray(params.supportedTypes)) {
    params.supportedTypes.forEach((type) => {
      if (SUPPORTED_INPUT_TYPES.includes(type)) {
        resolved.add(type);
      }
    });
  }

  const modes = Array.isArray(params.supportedModes) ? params.supportedModes : [];
  modes.forEach((mode) => {
    if (mode === 'text' || mode === 'stt') {
      resolved.add('text');
    }
    if (mode === 'audio' || mode === 'stt') {
      resolved.add('audio');
    }
  });

  if (resolved.size === 0) {
    resolved.add('text');
  }

  return Array.from(resolved);
}

function resolveConfiguredApiKey(apiKeyConfig) {
  if (typeof apiKeyConfig !== 'string') {
    return apiKeyConfig ?? null;
  }

  if (!apiKeyConfig.startsWith('setting:')) {
    return apiKeyConfig;
  }

  const [, remainder] = apiKeyConfig.split(':');
  if (!remainder) {
    return null;
  }

  const [settingName, fallbackKey] = remainder.split(';');
  if (settingName && fallbackKey && !fallbackKey.includes('xxxxxxxx')) {
    return fallbackKey;
  }
  return null;
}

async function performSpeechToText({ audioEntry, nodeInstance, account }) {
  const params = nodeInstance?.params ?? {};
  const sttConfig = params.stt ?? {};
  if (sttConfig.enabled === false) {
    return null;
  }

  const serverUrl = sttConfig.serverUrl || 'https://api.openai.com/v1/audio/transcriptions';
  const model = sttConfig.model || 'gpt-4o-transcribe';
  const accountKeyName = sttConfig.accountKeyName || 'openAIkey';

  let apiKey = null;
  if (account && sttConfig.useAccountKey !== false) {
    apiKey = getAccountServiceKey(account, accountKeyName);
  }
  if (!apiKey) {
    apiKey = resolveConfiguredApiKey(sttConfig.apiKey);
  }

  if (!apiKey) {
    throw new Error('Speech-to-text configuration is missing an API key');
  }

  const mimeType = audioEntry.mimeType || 'audio/mpeg';
  const fileExtension = mimeType.split('/')[1] || 'mpeg';
  const buffer = Buffer.from(audioEntry.data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });

  const formData = new FormData();
  formData.append('model', model);
  formData.append('response_format', 'text');
  formData.append('file', blob, `audio.${fileExtension}`);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(serverUrl, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Speech-to-text request failed (${response.status}): ${errorText || response.statusText}`);
  }

  return {
    text: await response.text(),
    model,
  };
}

export async function applyUserInputToPendingRecord({
  db,
  session,
  account,
  nodeInstanceID,
  mediaTypes,
  Constants,
  inputMode = null,
}) {
  validateMediaTypes(mediaTypes);

  const inputTypes = Object.keys(mediaTypes);

  if (inputTypes.length === 0) {
    throw new Error('Invalid parameter - no media types supplied');
  }

  const pendingRecord = await getPendingRecordForNodeInstance(
    db,
    session.sessionID,
    nodeInstanceID,
  );

  if (!pendingRecord) {
    throw new Error('The system was not expecting new input from the user');
  }

  console.error('[userInput] resolved pending record', {
    sessionID: session.sessionID,
    nodeInstanceID,
    recordID: pendingRecord.recordID,
    waitingFor: pendingRecord.waitingFor,
    requestedTypes: inputTypes,
  });

  if (pendingRecord.waitingFor) {
    const waitingFor = Array.isArray(pendingRecord.waitingFor)
      ? pendingRecord.waitingFor
      : [pendingRecord.waitingFor];
    const missingTypes = inputTypes.filter((inputType) => !waitingFor.includes(inputType));
    if (missingTypes.length > 0) {
      throw new Error(`Input types [${missingTypes.join(', ')}] not expected for node ${nodeInstanceID}`);
    }
  }

  if (pendingRecord.state === 'completed' || pendingRecord.state === 'error') {
    throw new Error(`Found a pending record, but it had the wrong state (${pendingRecord.state})`);
  }

  let nodeInstance = getNodeByInstanceID(session.versionInfo, nodeInstanceID);
  if (!nodeInstance && pendingRecord.context?.resolvedNodeDefinition) {
    nodeInstance = pendingRecord.context.resolvedNodeDefinition;
  }
  if (!nodeInstance) {
    nodeInstance = {
      nodeType: pendingRecord.nodeType,
      instanceID: pendingRecord.nodeInstanceID,
      params: pendingRecord.params ?? pendingRecord.context?.resolvedNodeDefinition?.params ?? {},
    };
    console.error('[userInput] reconstructed nodeInstance from pending record context', {
      recordID: pendingRecord.recordID,
      nodeType: nodeInstance.nodeType,
      instanceID: nodeInstance.instanceID,
    });
  } else {
    console.error('[userInput] located nodeInstance from session', {
      nodeType: nodeInstance.nodeType,
      instanceID: nodeInstance.instanceID,
      hasComponentPath: Array.isArray(nodeInstance.componentPathSegments) && nodeInstance.componentPathSegments.length > 0,
    });
  }

  if (!nodeInstance) {
    throw new Error('Invalid parameter - nodeInstanceID not found');
  }

  const supportedTypes = resolveSupportedTypes(nodeInstance);

  inputTypes.forEach((inputType) => {
    if (!SUPPORTED_INPUT_TYPES.includes(inputType)) {
      throw new Error(`Invalid parameter -- unsupported input type: ${inputType}`);
    }

    const typeIsSupported = nodeInstance.nodeType !== 'externalTextInput'
      ? supportedTypes.includes(inputType)
      : inputType === 'text';

    if (!typeIsSupported) {
      throw new Error(`Invalid parameter -- input type ${inputType} not supported for node ${nodeInstance.instanceName}`);
    }
  });

  const eventSet = new Set(['completed']);

  const contextUpdate = {
    ...(pendingRecord.context ?? {}),
  };
  if (inputMode) {
    contextUpdate.inputMode = inputMode;
  }

  const now = new Date();
  const recordUpdate = {
    eventsEmitted: [],
    output: {},
    completionTime: now,
    lastModifiedTime: now,
    pending: false,
    state: 'completed',
    context: contextUpdate,
  };

  inputTypes.forEach((inputType) => {
    if (inputType === 'text') {
      let finalText = mediaTypes[inputType].data;

      const userTokenLimit = nodeInstance.params.tokenLimit;

      if (!nullUndefinedOrEmpty(userTokenLimit) && finalText.length > userTokenLimit) {
        finalText = finalText.substring(0, userTokenLimit);
      }

      recordUpdate.output.text = { text: finalText };
      recordUpdate.output.result = { text: finalText };
      eventSet.add('on_text');
    } else {
      const mediaEntry = mediaTypes[inputType];

      if (!Constants.supportedMimeTypes.includes(mediaEntry.mimeType)) {
        throw new Error(`Invalid parameter -- unsupported MIME type: ${mediaEntry.mimeType}`);
      }

      if (nullUndefinedOrEmpty(mediaEntry.data)) {
        throw new Error(`Invalid parameter -- missing media payload for ${inputType}`);
      }

      if (inputType === 'audio') {
        if (inputMode === 'stt') {
          recordUpdate.context = {
            ...recordUpdate.context,
            rawAudio: mediaEntry,
          };
        } else {
          eventSet.add('on_audio');
          recordUpdate.output.audio = {
            audio: mediaEntry,
          };
        }
      } else {
        recordUpdate.output[inputType] = {
          [inputType]: mediaEntry,
        };
        eventSet.add(`on_${inputType}`);
      }
    }
  });

  const audioEntryForTranscription = mediaTypes.audio ?? pendingRecord.context?.rawAudio;
  if (audioEntryForTranscription && !recordUpdate.context?.rawAudio) {
    recordUpdate.context = {
      ...recordUpdate.context,
      rawAudio: audioEntryForTranscription,
    };
  }

  let transcriptionResult = null;
  if (inputMode === 'stt' && audioEntryForTranscription) {
    try {
      transcriptionResult = await performSpeechToText({
        audioEntry: audioEntryForTranscription,
        nodeInstance,
        account,
      });
    } catch (error) {
      console.error('[userInput] Speech-to-text conversion failed', error);
      throw error;
    }
  }

  if (transcriptionResult?.text) {
    const transcriptionText = transcriptionResult.text;
    recordUpdate.output.text = { text: transcriptionText };
    recordUpdate.output.result = { text: transcriptionText };
    recordUpdate.context = {
      ...recordUpdate.context,
      transcription: {
        text: transcriptionText,
        model: transcriptionResult.model,
        completedAt: new Date().toISOString(),
      },
    };
    if (!recordUpdate.eventsEmitted.includes('on_text')) {
      eventSet.add('on_text');
    }
  } else if (!recordUpdate.output.result && recordUpdate.output.text) {
    recordUpdate.output.result = recordUpdate.output.text;
  }

  recordUpdate.eventsEmitted = Array.from(eventSet);

  if (recordUpdate.context && Object.keys(recordUpdate.context).length === 0) {
    delete recordUpdate.context;
  }

  await updateRecord(db, pendingRecord.recordID, recordUpdate, pendingRecord.state);

  console.error('[userInput] record updated', {
    recordID: pendingRecord.recordID,
    nodeInstanceID: pendingRecord.nodeInstanceID,
    newState: recordUpdate.state,
    events: recordUpdate.eventsEmitted,
    emittedKeys: Object.keys(recordUpdate.output || {}),
    componentPath: recordUpdate.context?.componentPathSegments,
    waitReasons: recordUpdate.context?.waitReasons,
  });

  const mergedRecord = {
    ...pendingRecord,
    ...recordUpdate,
  };

  const updatedUserMessage = messageFromRecord(
    session.versionInfo,
    mergedRecord,
  );

  const activeInfo = await getActiveSessionMachine(db, session.sessionID);

  await enqueueSessionCommand(
    db,
    session.sessionID,
    'message:full',
    updatedUserMessage,
    { target: 'client', machineID: activeInfo?.machineID ?? null },
  );

  console.error('[userInput] enqueued updated message', {
    recordID: pendingRecord.recordID,
    sessionID: session.sessionID,
    machineID: activeInfo?.machineID ?? null,
  });

  return {
    recordID: pendingRecord.recordID,
    nodeInstanceID: mergedRecord.nodeInstanceID,
    inputTypes,
  };
}
