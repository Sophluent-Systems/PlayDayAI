

export function getMostRecentMessageOfType(messages, types, startingIndex=-1) {
    let realStartingIndex = startingIndex;
    if (startingIndex < 0) {
      realStartingIndex = messages.length + realStartingIndex;
    }
    if (realStartingIndex < 0) {
      return -1;
    }
    for(let i = realStartingIndex; i >= 0; i--) {
      const msg = messages[i];
      if (types.includes(msg.role) && !messages[i].deleted) {
        return i;
      }
    }
    
    return -1;
}


export function getMostRecentMessageOfTypeSincePreviousTypes(messages, sinceTypes, ofTypes, startingIndex, includeAllMessagesIfNotFound=true) {
  let realStartingIndex = startingIndex;
  if (startingIndex < 0) {
    realStartingIndex = messages.length + realStartingIndex;
  }

  let sinceIndex = -1;
  for(let i = realStartingIndex; (i >= 0 && i < messages.length); i--) {
    const msg = messages[i];
    if (sinceTypes.includes(msg.role) && !msg.deleted) {
      sinceIndex = i;
      break;
    }
  }

  if (sinceIndex == -1 && includeAllMessagesIfNotFound) {
    sinceIndex = 0;
  }

  if (sinceIndex >= 0) {
    for(let i =  messages.length-1; i > sinceIndex; i--) {
      const msg = messages[i];
      if (ofTypes.includes(msg.role) && !msg.deleted) {
        return i;
      }
    }
  }
  
  return -1;
}


export function findMessageIndexByRecordID(messages, recordID) {
  var retval = -1;
  for(var i = messages.length-1; i >= 0; i--) {
    let message = messages[i];
    if (message.recordID == recordID) {
      retval = i;
      break;
    }
  };
  return retval;
}


export function getTurnCount(fullMessageHistory, ignoreDeleted=true) {
  let turnCount = 0;
  
  fullMessageHistory.map((message) => {
      if (message.role === 'user' &&
          (ignoreDeleted || !message.deleted)) {
          turnCount++;
      }
  })
  
  return turnCount;
}



  