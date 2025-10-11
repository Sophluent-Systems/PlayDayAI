import { MessagesPubServer } from './messagespubserver';

/**
 * In-process MessagesPubServer implementation that communicates through a Node.js MessagePort.
 * The host process is responsible for forwarding serialized messages to the WebSocket connection.
 */
export class InProcessSessionChannel extends MessagesPubServer {
  constructor({ port, channelName = null, sessionID = null } = {}) {
    if (!port) {
      throw new Error('InProcessSessionChannel requires a MessagePort instance.');
    }
    super(channelName, sessionID, false);
    this.port = port;
    this.isClosed = false;
    this.port.start?.();
    this.port.on('message', (event) => {
      if (this.isClosed) {
        return;
      }
      const { type, payload } = event || {};
      if (type === 'incoming' && typeof payload === 'string') {
        this.onmessage(payload);
      } else if (type === 'disconnect') {
        this.close();
      }
    });
  }

  async connect() {
    return true;
  }

  async publish(message) {
    if (this.isClosed) {
      throw new Error('Attempted to publish on a closed InProcessSessionChannel.');
    }
    this.port.postMessage({
      type: 'outgoing',
      payload: message,
    });
    return true;
  }

  close() {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    try {
      this.port.postMessage({ type: 'closed' });
    } catch (_) {
      // ignore failures during close
    }
    this.port.close();
    super.close();
  }
}
