
import { Config } from "@src/backend/config";

  export function getMostRecentCompressedMessage(fullMessageHistory) {
    var compressedMessage = null;
    for (var i = fullMessageHistory.length - 1; i >= 0; i--) {
      if (fullMessageHistory[i].role == 'compressed' && !fullMessageHistory[i].deleted) {
        compressedMessage = fullMessageHistory[i];
        break;
      }
    }
  
    return compressedMessage;
  }
  
  export function getServerMessageIndiciesAccountingForCompression(fullMessageHistory) {
    const { Constants } = Config;

    var compressedMessage = getMostRecentCompressedMessage(fullMessageHistory);
    if (compressedMessage) {
      Constants.debug.logCompression && console.log("Most recent compressed message: ", JSON.stringify(compressedMessage));
      Constants.debug.logCompression && console.log("rangeStart: ", compressedMessage.rangeStart, " rangeEnd: ", compressedMessage.rangeEnd);
    }
    
    const rolesToInclude = ['system', 'user', 'assistant'];
    var addedCompressedMessage = false;
    var serverMessageIndices = [];
    fullMessageHistory.forEach((message, arrayIndex) => {
        const includeThisMessage = (!compressedMessage || 
              message.index < compressedMessage.rangeStart ||
              message.index > compressedMessage.rangeEnd) &&
              rolesToInclude.includes(message.role) &&
              typeof message.content == 'string' &&
              !message.deleted;
  
        Constants.debug.logCompression && console.log("   ", message.index, " ", message.role, " -> ", includeThisMessage);
        
        if (includeThisMessage) {
              serverMessageIndices.push(message.index);
        }
  
        if (compressedMessage && !addedCompressedMessage && 
          (message.index < compressedMessage.rangeStart)) {
            Constants.debug.logCompression && console.log("  -", compressedMessage.index, " ", compressedMessage.role, " -> true");
            serverMessageIndices.push(compressedMessage.index);
            addedCompressedMessage = true;
        }
    });
  
    return serverMessageIndices;
  }

  export function generateTempMessageListFromIndicesList(fullMessageHistory, indicesList, formatForServer, fieldsToInclude=['role', 'content']) {
    var messageList = [];
    for (var i = 0; i < fullMessageHistory.length; i++) {
      if (indicesList.includes(fullMessageHistory[i].index)) {
        let message = {};
  
        //
        // Only include requested fields
        //
        if (fieldsToInclude) {
          for (var j = 0; j < fieldsToInclude.length; j++) {
            message[fieldsToInclude[j]] = fullMessageHistory[i][fieldsToInclude[j]];
          }
        } else {
          message = {...fullMessageHistory[i]};
        }
  
        //
        // Remove propriaetary field values, like "compressed" and convert to server-friendly values
        //
        if (formatForServer) {
          if (message.role == 'compressed') {
            message.role = 'system';
          }
        }
  
        //
        // Add the message
        //
        messageList.push(message);
      }
    }
  
    return messageList;
  }