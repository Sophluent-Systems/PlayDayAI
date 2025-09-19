import { nullUndefinedOrEmpty } from "@src/common/objects";
import { getNodePersonaDetails } from "@src/common/personainfo";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { ImportError } from "@src/common/errors";
import { getAllRecordsForSession } from "@src/backend/records";

export function getNodeByInstanceID(versionInfo, instanceID) {
  const nodes = versionInfo?.stateMachineDescription?.nodes;
  if (!nodes || nodes.length === 0) {
    return null;
  }
  return nodes.find((node) => node.instanceID === instanceID) || null;
}

function getRecordHistoryForAncestor(records, ancestorRecord) {
  let history = [];

  if (ancestorRecord.inputs && ancestorRecord.inputs.length > 0) {
    for (const input of ancestorRecord.inputs) {
      const inputRecord = records.find((record) => record.recordID === input.recordID);
      if (inputRecord) {
        history = history.concat(getRecordHistoryForAncestor(records, inputRecord));
      }
    }
  }

  history.push(ancestorRecord);
  return history;
}

export function filterRecords(records = [], params = {}) {
  const {
    includeDeleted = false,
    includeFailed = false,
    includeWaitingForExternalInput = false,
    spanSelectionMode,
    startingSpan = 0,
    endingSpan = 0,
    includedNodes,
    ancestorsOfTypes,
    fromAncestorID,
    states,
    skipDeleted,
  } = params;

  let filteredRecords = Array.isArray(records) ? [...records] : [];

  if (!nullUndefinedOrEmpty(states)) {
    if (!Array.isArray(states)) {
      throw new Error('states must be an array');
    }
    filteredRecords = filteredRecords.filter((record) => states.includes(record.state));
  }

  if (!nullUndefinedOrEmpty(ancestorsOfTypes) && fromAncestorID) {
    const ancestorRecord = filteredRecords.find((record) => record.recordID === fromAncestorID);
    if (!ancestorRecord) {
      throw new Error('fromAncestorID not found: ' + fromAncestorID);
    }
    filteredRecords = getRecordHistoryForAncestor(filteredRecords, ancestorRecord);
  }

  const allowDeleted = skipDeleted ? false : includeDeleted;

  filteredRecords = filteredRecords.filter((record) => {
    if (record.deleted && !allowDeleted) {
      return false;
    }
    if (record.state === 'failed' && !includeFailed) {
      return false;
    }
    if (record.state === 'waitingForExternalInput' && !includeWaitingForExternalInput) {
      return false;
    }
    return true;
  });

  if (!nullUndefinedOrEmpty(includedNodes)) {
    if (!Array.isArray(includedNodes)) {
      throw new Error('includedNodes must be an array');
    }
    filteredRecords = filteredRecords.filter((record) => includedNodes.includes(record.nodeInstanceID));
  }

  if (!nullUndefinedOrEmpty(spanSelectionMode) && spanSelectionMode !== 'full') {
    if (spanSelectionMode === 'exclude') {
      if (startingSpan + endingSpan >= filteredRecords.length) {
        return [];
      }
      if (startingSpan > 0) {
        filteredRecords = filteredRecords.slice(startingSpan);
      }
      if (endingSpan > 0) {
        filteredRecords = filteredRecords.slice(0, filteredRecords.length - endingSpan);
      }
    } else if (spanSelectionMode === 'include') {
      if (startingSpan + endingSpan >= filteredRecords.length) {
        // include everything
        return [...filteredRecords];
      }
      let subset = [];
      if (startingSpan > 0) {
        subset = subset.concat(filteredRecords.slice(0, startingSpan));
      }
      if (endingSpan > 0) {
        subset = subset.concat(filteredRecords.slice(-endingSpan));
      }
      filteredRecords = subset;
    }
  }

  return filteredRecords;
}

export function messageFromRecord(versionInfo, record, params = {}) {
  const { includeDebugInfo, appendPersonaIdentity } = params;
  const node = getNodeByInstanceID(versionInfo, record.nodeInstanceID);
  if (!node) {
    console.error('messageFromRecord: node not found for record', record.recordID, '...ignoring it');
    return null;
  }

  const message = {
    executionTime: record.executionTime,
    completionTime: record.completionTime,
    startTime: record.startTime,
    recordID: record.recordID,
    nodeInstanceID: record.nodeInstanceID,
    state: record.state,
    nodeAttributes: getMetadataForNodeType(node.nodeType).nodeAttributes,
  };

  const defaultOutputField = message.nodeAttributes.defaultOutputField;
  const defaultOutput = record.output?.[defaultOutputField];
  message.content = defaultOutput || {};

  if (message.nodeAttributes?.userInput && Object.keys(message.content).length === 0) {
    const outputKeys = record.output ? Object.keys(record.output) : [];
    message.content.text = 'Input received: ' + (outputKeys.length > 0 ? outputKeys.join(', ') : 'none');
  }

  if (!nullUndefinedOrEmpty(node.personaLocation)) {
    const persona = getNodePersonaDetails(versionInfo, node);
    message.persona = persona;
    message.personaSource = node.personaLocation.source;
    if (appendPersonaIdentity) {
      const hasCustomPersona = message.personaSource === 'version';
      if (hasCustomPersona && persona && !nullUndefinedOrEmpty(message.content?.text)) {
        message.content.text = `${persona.displayName}: ${message.content.text}`;
      }
    }
  } else {
    message.persona = null;
    message.personaSource = null;
  }

  if (record.error) {
    if (includeDebugInfo) {
      const errorObject = ImportError(record.error);
      message.error = errorObject.export();
    } else {
      message.error = { name: record.error.name, message: record.error.message };
    }
  }

  if (includeDebugInfo) {
    message.nodeType = node.nodeType;
    message.instanceName = node.instanceName;
    message.hideOutput = node.hideOutput ? true : false;
  }

  if (message.nodeAttributes?.userInput) {
    message.role = 'user';
  } else if (!nullUndefinedOrEmpty(message.content.text)) {
    message.role = 'assistant';
  } else if (!nullUndefinedOrEmpty(message.content)) {
    message.role = Object.keys(message.content)[0];
  } else {
    message.role = 'assistant';
  }

  return message;
}

function applyMediaTypeFilter(messages, mediaTypes) {
  if (nullUndefinedOrEmpty(mediaTypes)) {
    return messages;
  }
  if (!Array.isArray(mediaTypes)) {
    throw new Error('mediaTypes must be an array');
  }
  return messages.filter((message) => {
    return mediaTypes.some((type) => !nullUndefinedOrEmpty(message.content?.[type]));
  });
}

export function exportRecordsAsMessageList(versionInfo, records = [], params = {}) {
  if (!versionInfo) {
    return [];
  }

  const { preFiltered, mediaTypes, ...rest } = params;

  const workingRecords = preFiltered ? [...records] : filterRecords(records, rest);
  if (workingRecords.length === 0) {
    return [];
  }

  const messages = [];
  for (const record of workingRecords) {
    const message = messageFromRecord(versionInfo, record, rest);
    if (message) {
      messages.push(message);
    }
  }

  return applyMediaTypeFilter(messages, mediaTypes);
}

export async function exportSessionMessageList(db, session, params = {}) {
  if (!session) {
    return [];
  }
  const { sortNewestFirst = false } = params;
  const versionInfo = session.versionInfo;
  if (!versionInfo) {
    return [];
  }
  const records = await getAllRecordsForSession(db, session.sessionID, sortNewestFirst, true);
  return exportRecordsAsMessageList(versionInfo, records, params);
}
