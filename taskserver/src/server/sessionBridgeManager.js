import { MessageChannel } from 'worker_threads';
const MAX_BUFFERED_MESSAGES = 100;

class SessionBridge {
  constructor(sessionID) {
    this.sessionID = sessionID;
    this.wsChannel = null;
    this.hostPort = null;
    this.workerActive = false;
    this.bufferedMessages = [];
    this.pendingPromise = null;
    this.lastError = null;
  }

  hasActiveWorker() {
    return this.workerActive;
  }

  attachWebSocket(wsChannel) {
    this.wsChannel = wsChannel;
    this.flushBufferedMessages();
  }

  detachWebSocket(wsChannel) {
    if (this.wsChannel === wsChannel) {
      this.wsChannel = null;
    }
  }

  flushBufferedMessages() {
    if (!this.wsChannel || this.bufferedMessages.length === 0) {
      return;
    }
    const queue = [...this.bufferedMessages];
    this.bufferedMessages = [];
    queue.forEach(({ command, data }) => {
      this.forwardToClient(command, data);
    });
  }

  forwardToClient(command, data) {
    if (!this.wsChannel) {
      this.bufferedMessages.push({ command, data });
      if (this.bufferedMessages.length > MAX_BUFFERED_MESSAGES) {
        this.bufferedMessages.shift();
      }
      return;
    }

    if (command === 'stateMachineCommand') {
      return;
    }

    try {
      this.wsChannel.proxyCommand(command, data);
    } catch (error) {
      console.error(`[SessionBridge] Error forwarding message to client`, error);
      this.bufferedMessages.push({ command, data });
    }
  }

  sendToClient(command, data) {
    this.forwardToClient(command, data);
  }

  handleWorkerMessage(event) {
    const { type, payload } = event || {};

    if (type === 'outgoing' && typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const { command, data } = parsed || {};
        if (command) {
          this.forwardToClient(command, data);
        }
      } catch (error) {
        console.error(`[SessionBridge] Failed to parse worker message`, error);
      }
    }

    if (type === 'status') {
      this.lastStatus = payload;
    }

    if (type === 'closed') {
      this.cleanupPort();
    }
  }

  cleanupPort() {
    if (this.hostPort) {
      try {
        this.hostPort.removeAllListeners('message');
        this.hostPort.close();
      } catch (_) {
        // ignore cleanup errors
      }
      this.hostPort = null;
    }
    this.workerActive = false;
  }

  createWorkerPort() {
    if (this.workerActive) {
      throw new Error(`Session ${this.sessionID} already has an active worker`);
    }

    const { port1, port2 } = new MessageChannel();
    port1.on('message', (event) => this.handleWorkerMessage(event));
    this.hostPort = port1;
    this.workerActive = true;
    port1.start?.();
    return port2;
  }

  sendCommand(command, data) {
    if (!this.workerActive || !this.hostPort) {
      return false;
    }
    const payload = JSON.stringify({
      command,
      data,
      verification: { sessionID: this.sessionID, messageIndex: 0 },
    });
    try {
      this.hostPort.postMessage({ type: 'incoming', payload });
      return true;
    } catch (error) {
      console.error(`[SessionBridge] Failed to send command to worker`, error);
      return false;
    }
  }

  notifyWorkerPromise(promise) {
    this.pendingPromise = promise;
    promise
      .then(() => {
        this.cleanupPort();
      })
      .catch((error) => {
        this.lastError = error;
        console.error(`[SessionBridge] Worker for session ${this.sessionID} failed`, error);
        this.cleanupPort();
      })
      .finally(() => {
        this.pendingPromise = null;
      });
  }

  getStatus() {
    return {
      sessionID: this.sessionID,
      workerActive: this.workerActive,
      pendingMessages: this.bufferedMessages.length,
      lastError: this.lastError ? `${this.lastError.message}` : null,
    };
  }
}

const bridges = new Map();

export function getSessionBridge(sessionID) {
  if (!bridges.has(sessionID)) {
    bridges.set(sessionID, new SessionBridge(sessionID));
  }
  return bridges.get(sessionID);
}

export function attachWebSocketToBridge(sessionID, wsChannel) {
  const bridge = getSessionBridge(sessionID);
  bridge.attachWebSocket(wsChannel);
  return bridge;
}

export function detachWebSocketFromBridge(sessionID, wsChannel) {
  const bridge = bridges.get(sessionID);
  if (bridge) {
    bridge.detachWebSocket(wsChannel);
  }
}

export function activeSessionCount() {
  let count = 0;
  bridges.forEach((bridge) => {
    if (bridge.wsChannel) {
      count += 1;
    }
  });
  return count;
}

export function runningWorkerCount() {
  let count = 0;
  bridges.forEach((bridge) => {
    if (bridge.hasActiveWorker()) {
      count += 1;
    }
  });
  return count;
}

export function getBridgeSummaries() {
  const result = [];
  bridges.forEach((bridge) => {
    result.push(bridge.getStatus());
  });
  return result;
}
