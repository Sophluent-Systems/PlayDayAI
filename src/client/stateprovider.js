import React from 'react';
import { stateManager } from './statemanager.js';
import { topLevelStateController } from './toplevelstatecontroller.js';

export function StateProvider(props) {
  const { isSandbox, children } = props;
  const state = topLevelStateController({ isSandbox });

  return (
    <stateManager.Provider value={state}>
      {children}
    </stateManager.Provider>
  );
}