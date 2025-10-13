import { nodeType } from './nodeType.js';
import { runComputerUseAutomation } from '../../uiAutomation.js';
import { nullUndefinedOrEmpty } from '@src/common/objects.js';

const MAX_STEPS_UPPER_BOUND = 60;
const DEFAULT_MAX_STEPS = 20;
const DEFAULT_STEP_DELAY_MS = 500;

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export class uiAutomationNode extends nodeType {
  constructor({ db, session, fullNodeDescription }) {
    super({ db, session, fullNodeDescription });
  }

  async runImpl({ params, keySource }) {
    if (nullUndefinedOrEmpty(params?.taskDescription, true)) {
      throw new Error("uiAutomationNode: taskDescription is required");
    }

    const requestedMaxSteps = normalizeNumber(params.maxSteps, DEFAULT_MAX_STEPS);
    if (requestedMaxSteps > MAX_STEPS_UPPER_BOUND) {
      throw new Error(
        `uiAutomationNode: Requested maxSteps (${requestedMaxSteps}) exceeds allowed limit (${MAX_STEPS_UPPER_BOUND})`
      );
    }

    const result = await runComputerUseAutomation({
      taskDescription: params.taskDescription,
      viewport: params.viewport,
      sessionState: params.sessionState,
      keySource,
      apiKey: params.apiKey,
      serverUrl: params.serverUrl,
      model: params.model,
      safetySettings: params.safetySettings,
      maxSteps: requestedMaxSteps,
      stepDelayMs: normalizeNumber(params.stepDelayMs, DEFAULT_STEP_DELAY_MS),
      metadata: params.metadata,
    });

    if (result.actions.length > requestedMaxSteps) {
      throw new Error(
        `uiAutomationNode: Provider returned ${result.actions.length} actions, exceeding requested maxSteps=${requestedMaxSteps}`
      );
    }

    const output = {
      result: {
        text: result.text,
        data: {
          actions: result.actions,
          updatedViewport: result.updatedViewport,
          sessionState: result.sessionState,
        },
      },
      actionPlan: {
        data: result.actions,
      },
      updatedViewport: {
        data: result.updatedViewport,
      },
    };

    return {
      state: "completed",
      eventsEmitted: ["completed"],
      output,
      context: {
        actionPlan: result.actions,
        sessionState: result.sessionState,
        updatedViewport: result.updatedViewport,
      },
    };
  }
}

export default uiAutomationNode;
